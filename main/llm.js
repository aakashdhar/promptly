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

  function runOnce(prompt, { timeoutMs, slowWarningMs, lean }) {
    return new Promise((resolve) => {
      const claudePath = getClaudePath();
      if (!claudePath) {
        resolve({ success: false, error: 'Claude CLI not found. Install via npm i -g @anthropic-ai/claude-code', errorType: 'unknown' });
        return;
      }
      const args = ['-p', '--model', getModel() || DEFAULT_MODEL, ...(lean ? LEAN_FLAGS : [])];
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
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.stdin.on('error', () => { /* child exited before reading stdin; close handler reports it */ });
      child.stdin.end(prompt);
      // A killed process may leave grandchildren holding its stdout open, which delays
      // 'close' indefinitely; 'exit' fires as soon as the process itself is gone.
      child.on('exit', (_code, signal) => {
        if (signal) finish({ success: false, error: 'Cancelled', errorType: 'cancelled', cancelled: true });
      });
      child.on('close', (code) => {
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

  async function run(prompt, { timeoutMs = 45000, slowWarningMs = 30000 } = {}) {
    const result = await runOnce(prompt, { timeoutMs, slowWarningMs, lean: leanFlagsSupported });
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

module.exports = { DEFAULT_MODEL, createClaudeRunner, classifyError, parseJsonOutput };
