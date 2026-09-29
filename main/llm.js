'use strict';

const { spawn } = require('child_process');
const { makeClaudeEnv, terminate } = require('./binaries');
const platform = require('./platform');

const DEFAULT_MODEL = 'claude-sonnet-5';
// Earlier defaults. Settings saved while one of these was the default follow the new default.
const RETIRED_DEFAULTS = ['claude-sonnet-4-6'];

// Replaces Claude Code's agent system prompt: Promptly only needs text in, text out.
const SYSTEM_PROMPT = "Follow the user's instructions exactly and output only what they ask for.";

// Flags that make `claude -p` a plain text transform: no tools, no MCP servers, and no
// session files written to ~/.claude for every prompt. Older CLIs reject some of these,
// so a run that fails with "unknown option" is retried once without them.
const LEAN_FLAGS = ['--tools', '', '--no-session-persistence', '--strict-mcp-config', '--system-prompt', SYSTEM_PROMPT];
// Streams text as it's written: JSON events on stdout, with partial text deltas.
const STREAM_FLAGS = ['--output-format', 'stream-json', '--include-partial-messages', '--verbose'];

// Reads stream-json lines: text deltas as they arrive, and the final result event.
function createStreamParser(onDelta) {
  let buffer = '';
  let text = '';
  let result = null;
  function feed(chunk) {
    buffer += chunk;
    drain();
  }
  function drain() {
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
  // The process has ended: a last line without a newline (often the result) still counts.
  function flush() {
    if (buffer.trim()) { buffer += '\n'; drain(); }
  }
  return { feed, flush, text: () => text, result: () => result };
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
  // Processes this runner stopped on purpose; any other signal is a crash, not a cancel.
  const stoppedByUs = new WeakSet();

  function runOnce(prompt, { timeoutMs, slowWarningMs, lean, onDelta, thinking = true }) {
    const streaming = lean && typeof onDelta === 'function';
    const parser = streaming ? createStreamParser(onDelta) : null;
    return new Promise((resolve) => {
      const claudePath = getClaudePath();
      if (!claudePath) {
        resolve({ success: false, error: 'Claude CLI not found. Install via npm i -g @anthropic-ai/claude-code', errorType: 'unknown' });
        return;
      }
      const args = ['-p', '--model', getModel() || DEFAULT_MODEL, ...(lean ? LEAN_FLAGS : []), ...(streaming ? STREAM_FLAGS : [])];
      // The CLI thinks before answering by default; for a long answer that can add minutes
      // without making it better, so callers can turn it off.
      const env = thinking ? makeClaudeEnv(claudePath) : { ...makeClaudeEnv(claudePath), MAX_THINKING_TOKENS: '0' };
      // On Windows an npm-installed claude.cmd goes through cmd.exe; the prompt still goes on stdin.
      const child = spawnImpl(...platform.spawnArgs(claudePath, args, { env }));
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
        stoppedByUs.add(child);
        terminate(child);
        finish({ success: false, error: 'Claude took too long — try again', timedOut: true, errorType: 'timeout' });
      }, timeoutMs);
      // Decode as a stream, so a character split across two chunks (₹, Devanagari, emoji) stays whole.
      child.stdout.setEncoding?.('utf8');
      child.stderr.setEncoding?.('utf8');
      child.stdout.on('data', (d) => {
        const chunk = String(d);
        if (parser) parser.feed(chunk); else stdout += chunk;
      });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.stdin.on('error', () => { /* child exited before reading stdin; close handler reports it */ });
      child.stdin.end(prompt);
      // A killed process may leave grandchildren holding its stdout open, which delays
      // 'close' indefinitely; 'exit' fires as soon as the process itself is gone.
      child.on('exit', (_code, signal) => {
        if (!signal) return;
        if (stoppedByUs.has(child)) finish({ success: false, error: 'Cancelled', errorType: 'cancelled', cancelled: true });
        else finish({ success: false, error: `Claude stopped unexpectedly (${signal}) — try again`, errorType: 'unknown' });
      });
      child.on('close', (code) => {
        if (parser) {
          parser.flush();
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
  // thinking: false skips extended thinking for this call.
  async function run(prompt, { timeoutMs = 45000, slowWarningMs = 30000, onDelta, thinking = true } = {}) {
    const result = await runOnce(prompt, { timeoutMs, slowWarningMs, lean: leanFlagsSupported, onDelta, thinking });
    if (!result.success && leanFlagsSupported && isUnknownOptionError(result.stderr || '')) {
      leanFlagsSupported = false;
      return strip(await runOnce(prompt, { timeoutMs, slowWarningMs, lean: false, thinking }));
    }
    return strip(result);
  }

  function strip(result) {
    const { stderr: _stderr, ...rest } = result;
    return rest;
  }

  function cancelAll() {
    for (const child of children) { stoppedByUs.add(child); terminate(child); }
    children.clear();
  }

  // The CLI's version line, or null. Kept here so every claude process starts the same way.
  function version() {
    const claudePath = getClaudePath();
    if (!claudePath) return Promise.resolve(null);
    return new Promise((resolve) => {
      const child = spawnImpl(...platform.spawnArgs(claudePath, ['--version'], { env: makeClaudeEnv(claudePath) }));
      let out = '';
      const timer = setTimeout(() => terminate(child), 5000);
      child.stdout?.setEncoding?.('utf8');
      child.stdout?.on('data', (d) => { out += String(d); });
      child.on('error', () => { clearTimeout(timer); resolve(null); });
      child.on('close', (code) => { clearTimeout(timer); resolve(code === 0 ? out.trim() || null : null); });
    });
  }

  return { run, cancelAll, version };
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

// Picks who answers each call (D-AI-PROVIDERS): Claude Code by default; the user's own API key
// when Claude Code isn't ready (mode 'auto') or when they chose it (mode 'api'). Without a saved
// key it is always Claude Code, whatever the mode says. Same run() and result shape either way,
// plus `provider`. apiOptions are passed to every API call (the Dictation clean-up asks for the
// fast model). beforeRun lets the app re-check Claude Code before a call would go to the key, so
// "Claude Code first" heals on its own. Claude calls go through exactly as before.
function createAiRouter({ claude, api, getMode = () => 'auto', isClaudeReady = () => true, hasKey = () => false, apiOptions = {}, onClaudeAuthError = () => {}, beforeRun = async () => {} }) {
  function active() {
    if (!hasKey()) return 'claude';
    const mode = getMode();
    if (mode === 'claude') return 'claude';
    if (mode === 'api') return 'api';
    return isClaudeReady() ? 'claude' : 'api';
  }
  async function run(prompt, opts = {}) {
    if (active() === 'api') await beforeRun();
    if (active() === 'api') return api.run(prompt, { timeoutMs: opts.timeoutMs, onDelta: opts.onDelta, ...apiOptions });
    const result = await claude.run(prompt, opts);
    if (result.errorType === 'auth') onClaudeAuthError();
    return { ...result, provider: 'claude' };
  }
  function cancelAll() {
    claude.cancelAll();
    api.cancelAll();
  }
  return { run, cancelAll, active, version: (...a) => claude.version(...a) };
}

// Whether Claude Code can answer now, for the router (D-AI-PROVIDERS). Unknown until the first
// status check, and then Claude Code counts as ready if it was found. Once it looks unavailable,
// recheckIfStale() looks again (at most every recheckMs, straight away after a sign-in error), so
// someone with a key goes back to Claude Code by themselves after `claude login`, a slow startup
// check, or installing Claude Code while Promptly is open. A timeout never decides it.
function createClaudeReadiness({ getClaudePath, setClaudePath = () => {}, resolvePath = async () => null, getStatus, recheckMs = 15000, now = () => Date.now() }) {
  let ready = null;
  let lastCheck = -Infinity; // never checked: the first recheck runs at once
  let inFlight = null;
  const isReady = () => (ready === null ? !!getClaudePath() : ready);
  function note(status) {
    ready = !!(status && status.installed && status.loggedIn !== false);
    lastCheck = now();
  }
  function authFailed() {
    ready = false;
    lastCheck = -Infinity; // look again on the next call, e.g. the retry after `claude login`
  }
  function working() {
    ready = true;
    lastCheck = now();
  }
  async function recheckIfStale() {
    if (isReady() || now() - lastCheck < recheckMs) return;
    if (!inFlight) {
      lastCheck = now();
      inFlight = (async () => {
        let claudePath = getClaudePath();
        if (!claudePath) {
          claudePath = await resolvePath();
          if (claudePath) setClaudePath(claudePath);
        }
        if (claudePath) note(await getStatus(claudePath));
      })().catch(() => {}).finally(() => { inFlight = null; });
    }
    await inFlight;
  }
  return { isReady, note, authFailed, working, recheckIfStale };
}

module.exports = { DEFAULT_MODEL, RETIRED_DEFAULTS, createClaudeRunner, createAiRouter, createClaudeReadiness, createStreamParser, classifyError, parseJsonOutput };
