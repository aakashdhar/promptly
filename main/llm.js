'use strict';

const { spawn } = require('child_process');
const { makeClaudeEnv } = require('./binaries');

const DEFAULT_MODEL = 'claude-sonnet-4-6';

// Replaces Claude Code's agent system prompt: Promptly only needs text in, text out.
const SYSTEM_PROMPT = "Follow the user's instructions exactly and output only what they ask for.";

// Flags that make `claude -p` a plain text transform: no tools, no MCP servers, and no
// session files written to ~/.claude for every prompt. Older CLIs reject some of these,
// so a run that fails with "unknown option" is retried once without them.
const LEAN_FLAGS = ['--tools', '', '--no-session-persistence', '--strict-mcp-config', '--system-prompt', SYSTEM_PROMPT];
// Streams text as it's written: JSON events on stdout, with partial text deltas.
const STREAM_FLAGS = ['--output-format', 'stream-json', '--include-partial-messages', '--verbose'];
// Sends the prompt as a JSON message on stdin, which is how images (screenshots) get in.
const MESSAGE_INPUT_FLAGS = ['--input-format', 'stream-json'];

// One user message: images first, then the text, as Claude's content blocks.
function buildInputMessage(prompt, images) {
  const content = [
    ...images.map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } })),
    { type: 'text', text: prompt },
  ];
  return JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n';
}

// Reads stream-json lines: text deltas as they arrive, and the final result event.
function createStreamParser(onDelta) {
  let buffer = '';
  let text = '';
  let result = null;
  function feed(chunk) {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      const delta = event.type === 'stream_event' && event.event?.type === 'content_block_delta' && event.event.delta?.type === 'text_delta'
        ? event.event.delta.text : null;
      if (delta) {
        text += delta;
        onDelta(text);
      }
      if (event.type === 'result') result = event;
    }
  }
  return { feed, text: () => text, result: () => result };
}

function classifyError(stderr, stdout) {
  const combined = `${stderr}${stdout}`.toLowerCase();
  if (combined.includes('not authenticated') || combined.includes('login') || combined.includes('unauthorized')) return 'auth';
  return 'unknown';
}

function isUnknownOptionError(stderr) {
  return /unknown option|unknown argument|unrecognized option/i.test(stderr);
}

// Runs Claude through the CLI. The prompt is written to stdin rather than passed as an
// argument, so it never shows up in `ps` and isn't bound by command-line length limits.
function createClaudeRunner({ getClaudePath, getModel = () => DEFAULT_MODEL, onSlow = () => {}, children = new Set(), spawnImpl = spawn }) {
  let leanFlagsSupported = true;

  function runOnce(prompt, { timeoutMs, slowWarningMs, lean, onDelta, images = [] }) {
    // Message input needs stream-json output too, so a run with images always streams.
    const withImages = lean && images.length > 0;
    const streaming = lean && (typeof onDelta === 'function' || withImages);
    const parser = streaming ? createStreamParser(typeof onDelta === 'function' ? onDelta : () => {}) : null;
    return new Promise((resolve) => {
      const claudePath = getClaudePath();
      if (!claudePath) {
        resolve({ success: false, error: 'Claude CLI not found. Install via npm i -g @anthropic-ai/claude-code', errorType: 'unknown' });
        return;
      }
      const args = ['-p', '--model', getModel() || DEFAULT_MODEL, ...(lean ? LEAN_FLAGS : []), ...(streaming ? STREAM_FLAGS : []), ...(withImages ? MESSAGE_INPUT_FLAGS : [])];
      const child = spawnImpl(claudePath, args, { env: makeClaudeEnv(claudePath) });
      children.add(child);
      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(slowTimer);
        clearTimeout(killTimer);
        children.delete(child);
        resolve(result);
      };
      const slowTimer = slowWarningMs ? setTimeout(onSlow, slowWarningMs) : null;
      const killTimer = setTimeout(() => {
        child.kill();
        finish({ success: false, error: 'Claude took too long — try again', timedOut: true, errorType: 'timeout' });
      }, timeoutMs);
      child.stdout.on('data', (d) => {
        const chunk = d.toString();
        if (parser) parser.feed(chunk); else stdout += chunk;
      });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.stdin.on('error', () => { /* child exited before reading stdin; close handler reports it */ });
      child.stdin.end(withImages ? buildInputMessage(prompt, images) : prompt);
      // A killed process may leave grandchildren holding its stdout open, which delays
      // 'close' indefinitely; 'exit' fires as soon as the process itself is gone.
      child.on('exit', (_code, signal) => {
        if (signal) finish({ success: false, error: 'Cancelled', errorType: 'cancelled', cancelled: true });
      });
      child.on('close', (code) => {
        if (parser) {
          const result = parser.result();
          if (result && !result.is_error && code === 0) {
            const out = String(result.result ?? parser.text()).trim();
            finish(out ? { success: true, prompt: out } : { success: false, error: 'Claude returned an empty response — try again', errorType: 'empty' });
            return;
          }
          const message = (result && typeof result.result === 'string' && result.result) || stderr.trim() || 'Claude CLI error';
          finish({ success: false, error: message, errorType: classifyError(`${message} ${stderr}`, ''), stderr });
          return;
        }
        if (code !== 0) {
          finish({ success: false, error: stderr.trim() || 'Claude CLI error', errorType: classifyError(stderr, stdout), stderr });
          return;
        }
        const out = stdout.trim();
        if (!out) { finish({ success: false, error: 'Claude returned an empty response — try again', errorType: 'empty' }); return; }
        finish({ success: true, prompt: out });
      });
      child.on('error', (err) => finish({ success: false, error: err.message || 'Claude CLI error', errorType: 'unknown' }));
    });
  }

  // onDelta(textSoFar) streams the answer as it's written (skipped on CLIs without the flags).
  // images: [{ mediaType, data (base64) }] sent alongside the prompt; an old CLI without
  // message input gets the text alone.
  async function run(prompt, { timeoutMs = 45000, slowWarningMs = 30000, onDelta, images = [] } = {}) {
    const result = await runOnce(prompt, { timeoutMs, slowWarningMs, lean: leanFlagsSupported, onDelta, images });
    if (!result.success && leanFlagsSupported && isUnknownOptionError(result.stderr || '')) {
      leanFlagsSupported = false;
      return strip(await runOnce(prompt, { timeoutMs, slowWarningMs, lean: false }));
    }
    return strip(result);
  }

  function strip(result) {
    const { stderr: _stderr, ...rest } = result;
    return rest;
  }

  function cancelAll() {
    for (const child of children) {
      try { child.kill(); } catch { /* already exited */ }
    }
    children.clear();
  }

  return { run, cancelAll };
}

// Claude often wraps JSON in ```json fences; strip them before parsing.
function parseJsonOutput(raw) {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('No JSON object in response');
  }
}

module.exports = { DEFAULT_MODEL, createClaudeRunner, createStreamParser, buildInputMessage, classifyError, parseJsonOutput };
