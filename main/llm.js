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
// Skips start-up work a text transform never needs: slash commands and skills, and update
// checks and telemetry. It took the Dictation clean-up from 3-5 s to about 2 s. The user's own
// Claude Code settings still load: skipping them (2.22.1) also dropped their effort level, so
// Claude thought longer and "As a prompt" ran past its time limit. If a quick start fails,
// run() retries without these and stops using them.
const QUICK_START_FLAGS = ['--disable-slash-commands'];
const QUICK_START_ENV = { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };
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
  let quickStartSupported = true;
  // Processes this runner stopped on purpose; any other signal is a crash, not a cancel.
  const stoppedByUs = new WeakSet();

  function runOnce(prompt, { timeoutMs, slowWarningMs, lean, quick = false, onDelta, thinking = true }) {
    const streaming = lean && typeof onDelta === 'function';
    const parser = streaming ? createStreamParser(onDelta) : null;
    return new Promise((resolve) => {
      const claudePath = getClaudePath();
      if (!claudePath) {
        resolve({ success: false, error: 'Claude CLI not found. Install via npm i -g @anthropic-ai/claude-code', errorType: 'unknown' });
        return;
      }
      const args = ['-p', '--model', getModel() || DEFAULT_MODEL, ...(lean ? LEAN_FLAGS : []), ...(lean && quick ? QUICK_START_FLAGS : []), ...(streaming ? STREAM_FLAGS : [])];
      // The CLI thinks before answering by default; for a long answer that can add minutes
      // without making it better, so callers can turn it off.
      const env = { ...makeClaudeEnv(claudePath), ...(lean && quick ? QUICK_START_ENV : {}), ...(thinking ? {} : { MAX_THINKING_TOKENS: '0' }) };
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
    const quick = leanFlagsSupported && quickStartSupported;
    let result = await runOnce(prompt, { timeoutMs, slowWarningMs, lean: leanFlagsSupported, quick, onDelta, thinking });
    // A quick start that failed outright (not a cancel or timeout) gets one ordinary run; if
    // that one works, the quick start was the problem and later calls skip it.
    if (quick && !result.success && !result.cancelled && !result.timedOut && !isUnknownOptionError(result.stderr || '')) {
      const plain = await runOnce(prompt, { timeoutMs, slowWarningMs, lean: true, onDelta, thinking });
      if (plain.success) quickStartSupported = false;
      return strip(plain);
    }
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

// Why a finished Claude call means Claude Code can't answer right now, or null. Timeouts (a cold
// start can be slow) and cancels never count; neither does an ordinary error.
function claudeUnavailable(result) {
  if (!result || result.success || result.cancelled || result.errorType === 'timeout' || result.errorType === 'cancelled') return null;
  if (result.errorType === 'auth') return 'auth';
  const text = String(result.error || '');
  if (/usage limit|hit your limit|credit balance|out of credits|quota/i.test(text)) return 'limit';
  if (/CLI not found|ENOENT|spawn .* (EACCES|ENOENT)/i.test(text)) return 'broken';
  return null;
}

// Picks who answers each call (D-AI-PROVIDERS): Claude Code by default; the user's own API key
// when Claude Code isn't ready (mode 'auto') or when they chose it (mode 'api'). Without a saved
// key it is always Claude Code, whatever the mode says. Same run() and result shape either way,
// plus `provider`. apiOptions are passed to every API call (the Dictation clean-up asks for the
// fast model). Claude calls go through exactly as before.
// In Automatic with a key, a Claude call turned away (sign-in, usage limit or credit, Claude Code
// missing) is answered by the key instead, so the person never sees it fail; onApiRoute lets the
// app look at Claude Code again in the background, never holding up the call.
function createAiRouter({ claude, api, getMode = () => 'auto', isClaudeReady = () => true, hasKey = () => false, apiOptions = {}, onClaudeUnavailable = () => {}, onApiRoute = () => {} }) {
  function active() {
    if (!hasKey()) return 'claude';
    const mode = getMode();
    if (mode === 'claude') return 'claude';
    if (mode === 'api') return 'api';
    return isClaudeReady() ? 'claude' : 'api';
  }
  const callApi = (prompt, opts) => api.run(prompt, { timeoutMs: opts.timeoutMs, onDelta: opts.onDelta, ...apiOptions });
  async function run(prompt, opts = {}) {
    if (active() === 'api') {
      onApiRoute();
      return callApi(prompt, opts);
    }
    const result = await claude.run(prompt, opts);
    const why = claudeUnavailable(result);
    if (why) {
      onClaudeUnavailable(why);
      if (getMode() === 'auto' && hasKey()) return callApi(prompt, opts);
    }
    return { ...result, provider: 'claude' };
  }
  function cancelAll() {
    claude.cancelAll();
    api.cancelAll();
  }
  return { run, cancelAll, active, version: (...a) => claude.version(...a) };
}

// Whether Claude Code can answer now, for the router (D-AI-PROVIDERS). Only matters to someone
// with a saved key: without one the router always picks Claude Code.
// - Unknown until the first status check; then Claude Code counts as ready while it's on disk.
// - Turned away by a real call (or Check Claude): the key answers for a while (retryMs by reason),
//   then Claude Code is tried again with a real call. Status checks can't cut that short: `claude
//   auth status` can say "signed in" for a token Claude rejects. Only a working call can.
// - Not installed / not signed in by a status check: looked at again in the background, every
//   recheckMs while Claude Code is on disk, every missingRecheckMs while it isn't (finding it means
//   a login-shell lookup, so not often). A status check that timed out on an installed Claude Code
//   decides nothing.
function createClaudeReadiness({ getClaudePath, setClaudePath = () => {}, resolvePath = async () => null, getStatus, recheckMs = 30000, missingRecheckMs = 300000, retryMs = { auth: 60000, limit: 900000, broken: 600000 }, now = () => Date.now() }) {
  let ready = null;
  let lastCheck = -Infinity;
  let retryAt = 0;
  let inFlight = null;
  function isReady() {
    if (!getClaudePath()) return false;
    if (ready === false && retryAt && now() >= retryAt) { ready = null; retryAt = 0; }
    return ready === null ? true : ready;
  }
  function note(status) {
    lastCheck = now();
    if (retryAt && now() < retryAt) return;
    // On disk but neither `--version` nor `auth status` answered in time: a slow start, not a verdict.
    if (status && status.installed === false && status.path) return;
    ready = !!(status && status.installed && status.loggedIn !== false);
    retryAt = 0;
  }
  function unavailable(reason = 'auth') {
    ready = false;
    retryAt = now() + (retryMs[reason] ?? retryMs.auth);
  }
  function working() {
    ready = true;
    retryAt = 0;
    lastCheck = now();
  }
  // Fire and forget from the router; returns the check's promise for tests.
  function recheckIfStale() {
    if (isReady() || retryAt || inFlight) return inFlight || Promise.resolve();
    if (now() - lastCheck < (getClaudePath() ? recheckMs : missingRecheckMs)) return Promise.resolve();
    lastCheck = now();
    inFlight = (async () => {
      let claudePath = getClaudePath();
      if (!claudePath) {
        claudePath = await resolvePath();
        if (claudePath) setClaudePath(claudePath);
      }
      if (claudePath) note(await getStatus(claudePath));
    })().catch(() => {}).finally(() => { inFlight = null; });
    return inFlight;
  }
  return { isReady, note, unavailable, working, recheckIfStale };
}

module.exports = { DEFAULT_MODEL, RETIRED_DEFAULTS, createClaudeRunner, createAiRouter, createClaudeReadiness, claudeUnavailable, createStreamParser, classifyError, parseJsonOutput };
