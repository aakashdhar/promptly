'use strict';

const fs = require('fs');
const { spawn } = require('child_process');
const { makeClaudeEnv, terminate } = require('./binaries');
const platform = require('./platform');

const DEFAULT_MODEL = 'claude-sonnet-5';
// Earlier defaults. Settings saved while one of these was the default follow the new default.
const RETIRED_DEFAULTS = ['claude-sonnet-4-6'];

// Replaces Claude Code's agent system prompt: Promptly only needs text in, text out.
const SYSTEM_PROMPT = "Follow the user's instructions exactly and output only what they ask for.";

// Flags that make `claude -p` a plain text transform: no tools (`--tools ''`, put in front of
// these by runOnce), no MCP servers, and no session files written to ~/.claude for every prompt.
// Older CLIs reject some of these, so a run that fails with "unknown option" is retried once
// without them. A tool run (Look deeper) names its own tools instead of '' and keeps the rest:
// --strict-mcp-config is what keeps the user's own MCP tools (Gmail, Slack) out of it.
const LEAN_FLAGS = ['--no-session-persistence', '--strict-mcp-config', '--system-prompt', SYSTEM_PROMPT];
// Skips start-up work a text transform never needs: slash commands and skills, and update
// checks and telemetry. It took the Dictation clean-up from 3-5 s to about 2 s. The user's own
// Claude Code settings still load: skipping them (2.22.1) also dropped their effort level, so
// Claude thought longer and "As a prompt" ran past its time limit. If a quick start fails,
// run() retries without these and stops using them.
const QUICK_START_FLAGS = ['--disable-slash-commands'];
const QUICK_START_ENV = { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };
// Streams text as it's written: JSON events on stdout, with partial text deltas.
const STREAM_FLAGS = ['--output-format', 'stream-json', '--include-partial-messages', '--verbose'];
// A tool run (Look deeper) may only read. Anything else, a flag-looking entry included, never
// reaches the command line, even if a caller slips.
const READ_ONLY_TOOLS = ['Read', 'Grep', 'Glob'];
// A tool run always has a turn cap: 12 (spec §27) unless the caller asks for 1-50.
const DEFAULT_MAX_TURNS = 12;
const MAX_TURNS_LIMIT = 50;

// Reads stream-json lines: text deltas as they arrive, the tools that ran, and the final result event.
// Text Claude writes before a tool call is it thinking aloud, not the answer. It is dropped the moment
// the call starts and onDelta('') takes it off the screen, so the answer still streams and the last
// text onDelta gives is always the answer so far. onTool({ name, input }) hears a call only once its
// result comes back without an error: a read Claude Code refused (outside cwd) never counts.
function createStreamParser(onDelta, onTool) {
  let buffer = '';
  let text = '';
  let result = null;
  const pending = new Map();
  function feed(chunk) {
    buffer += chunk;
    drain();
  }
  function dropThinkingAloud() {
    if (!text) return;
    text = '';
    onDelta('');
  }
  function drain() {
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      const streamed = event.type === 'stream_event' ? event.event : null;
      const delta = streamed?.type === 'content_block_delta' && streamed.delta?.type === 'text_delta' ? streamed.delta.text : null;
      if (delta) {
        text += delta;
        onDelta(text);
      }
      // The call's start streams in well before its full assistant event.
      if (streamed?.type === 'content_block_start' && streamed.content_block?.type === 'tool_use') dropThinkingAloud();
      if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
        for (const block of event.message.content) {
          if (block?.type !== 'tool_use') continue;
          dropThinkingAloud();
          if (block.id) pending.set(block.id, { name: block.name, input: block.input ?? {} });
        }
      }
      if (event.type === 'user' && Array.isArray(event.message?.content)) {
        for (const block of event.message.content) {
          if (block?.type !== 'tool_result' || !pending.has(block.tool_use_id)) continue;
          const call = pending.get(block.tool_use_id);
          pending.delete(block.tool_use_id);
          if (block.is_error === true) continue;
          try { onTool?.(call); } catch { /* the caller's slip must not end the run */ }
        }
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

// Spawning in a missing folder fails as "spawn … ENOENT", and in one Claude can't open as "spawn …
// EACCES": both read as Claude Code being broken. In a file, spawn throws.
function canEnter(dir) {
  try {
    if (!fs.statSync(dir).isDirectory()) return false;
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function folderUnusable() {
  return { success: false, error: "The folder for Claude to look in is missing or can't be opened", errorType: 'unknown' };
}

function turnCap(maxTurns) {
  return Number.isInteger(maxTurns) && maxTurns >= 1 && maxTurns <= MAX_TURNS_LIMIT ? maxTurns : DEFAULT_MAX_TURNS;
}

// Runs Claude through the CLI. The prompt is written to stdin rather than passed as an
// argument, so it never shows up in `ps` and isn't bound by command-line length limits.
function createClaudeRunner({ getClaudePath, getModel = () => DEFAULT_MODEL, onSlow = () => {}, children = new Set(), spawnImpl = spawn }) {
  let leanFlagsSupported = true;
  let quickStartSupported = true;
  // Processes this runner stopped on purpose; any other signal is a crash, not a cancel.
  const stoppedByUs = new WeakSet();

  // run() checks cwd, tools and maxTurns first, and sends a tool run only with lean flags.
  function runOnce(prompt, { timeoutMs, slowWarningMs, lean, quick = false, onDelta, thinking = true, cwd, tools = null, maxTurns, onTool }) {
    // A tool run always streams, so each file Claude opens can be seen.
    const streaming = lean && (typeof onDelta === 'function' || !!tools);
    const parser = streaming ? createStreamParser(typeof onDelta === 'function' ? onDelta : () => {}, onTool) : null;
    return new Promise((resolve) => {
      const claudePath = getClaudePath();
      if (!claudePath) {
        resolve({ success: false, error: 'Claude CLI not found. Install via npm i -g @anthropic-ai/claude-code', errorType: 'unknown' });
        return;
      }
      const toolFlags = tools ? ['--tools', ...tools] : ['--tools', ''];
      // A tool run always asks for the default permission mode, so a user's own setting (e.g.
      // bypassPermissions or extra folders) can't widen what Claude may read.
      const turnFlags = tools ? ['--max-turns', String(maxTurns), '--permission-mode', 'default'] : [];
      const args = ['-p', '--model', getModel() || DEFAULT_MODEL, ...(lean ? [...toolFlags, ...LEAN_FLAGS, ...turnFlags] : []), ...(lean && quick ? QUICK_START_FLAGS : []), ...(streaming ? STREAM_FLAGS : [])];
      let child;
      try {
        // The CLI thinks before answering by default; for a long answer that can add minutes
        // without making it better, so callers can turn it off.
        const env = { ...makeClaudeEnv(claudePath), ...(lean && quick ? QUICK_START_ENV : {}), ...(thinking ? {} : { MAX_THINKING_TOKENS: '0' }) };
        // On Windows an npm-installed claude.cmd goes through cmd.exe; the prompt still goes on stdin.
        child = spawnImpl(...platform.spawnArgs(claudePath, args, cwd ? { env, cwd } : { env }));
      } catch (err) {
        // Some spawn failures throw instead of emitting 'error'; a run always resolves.
        resolve(cwd && !canEnter(cwd) ? folderUnusable() : { success: false, error: err?.message || 'Claude CLI error', errorType: 'unknown' });
        return;
      }
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
          // Out of turns with nothing written after the last tool call fails, so the caller can ask
          // again without the files. Claude Code 2.1 always stops on a tool call when out of turns;
          // the text branch keeps an answer a CLI might write before stopping.
          if (tools && result?.subtype === 'error_max_turns') {
            const out = parser.text().trim();
            finish(out ? { success: true, prompt: out } : { success: false, error: 'Claude opened too many files without answering — try again', errorType: 'max-turns' });
            return;
          }
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
      // A folder removed after run() checked it fails as "spawn … ENOENT" too.
      child.on('error', (err) => finish(cwd && !canEnter(cwd) ? folderUnusable() : { success: false, error: err.message || 'Claude CLI error', errorType: 'unknown' }));
    });
  }

  // onDelta(textSoFar) streams the answer as it's written (skipped on CLIs without the flags).
  // thinking: false skips extended thinking for this call.
  // tools (a subset of ['Read', 'Grep', 'Glob']) lets Claude open files in cwd for at most maxTurns
  // turns (1-50, else 12); onTool({ name, input }) hears each tool call that succeeded. The user's
  // settings still load.
  async function run(prompt, { timeoutMs = 45000, slowWarningMs = 30000, onDelta, thinking = true, cwd, tools, maxTurns, onTool } = {}) {
    const opts = { timeoutMs, slowWarningMs, onDelta, thinking, cwd };
    if (tools && !(Array.isArray(tools) && tools.length === 0)) return runWithTools(prompt, opts, tools, maxTurns, onTool);
    if (cwd && !canEnter(cwd)) return folderUnusable();
    const quick = leanFlagsSupported && quickStartSupported;
    let result = await runOnce(prompt, { ...opts, lean: leanFlagsSupported, quick });
    // A quick start that failed outright (not a cancel or timeout) gets one ordinary run; if that
    // one works, the quick start was the problem and later calls skip it.
    if (quick && !result.success && !result.cancelled && !result.timedOut && !isUnknownOptionError(result.stderr || '')) {
      const plain = await runOnce(prompt, { ...opts, lean: true });
      if (plain.success) quickStartSupported = false;
      return strip(plain);
    }
    if (!result.success && leanFlagsSupported && isUnknownOptionError(result.stderr || '')) {
      leanFlagsSupported = false;
      return strip(await runOnce(prompt, { ...opts, lean: false }));
    }
    return strip(result);
  }

  // Only ordinary runs learn which flags this CLI takes: a tool run that fails leaves them alone, and
  // the caller asks again without tools (an ordinary run, which learns as usual).
  async function runWithTools(prompt, opts, tools, maxTurns, onTool) {
    if (!Array.isArray(tools) || !tools.every((t) => READ_ONLY_TOOLS.includes(t))) {
      return { success: false, error: 'Unsupported tool', errorType: 'unknown' };
    }
    // Without a folder Claude would read from wherever Promptly happens to run.
    if (!opts.cwd || !canEnter(opts.cwd)) return folderUnusable();
    // Without the lean flags a tool run would get every tool (Bash, Edit…) and the user's MCP
    // servers, so on a CLI that rejects them it doesn't run.
    if (!leanFlagsSupported) {
      return { success: false, error: "This version of Claude Code can't look through the files — update it", errorType: 'unknown' };
    }
    let opened = 0;
    const toolOpts = {
      ...opts,
      lean: true,
      tools: [...new Set(tools)],
      maxTurns: turnCap(maxTurns),
      onTool: (call) => { opened += 1; onTool?.(call); },
    };
    const quick = quickStartSupported;
    const result = await runOnce(prompt, { ...toolOpts, quick });
    // The quick start gets one more try without it only when the run failed before any tool ran: a
    // start-up failure is the kind it can cause, a long run isn't paid for twice, and no file is
    // reported by both runs.
    if (quick && !opened && quickStartMayBeToBlame(result) && canEnter(opts.cwd)) {
      return strip(await runOnce(prompt, { ...toolOpts, quick: false }));
    }
    return strip(result);
  }

  // Not a cancel, timeout or running out of turns, and not an option the CLI rejects unless it is
  // a quick-start one.
  function quickStartMayBeToBlame(result) {
    if (result.success || result.cancelled || result.timedOut || result.errorType === 'max-turns') return false;
    const stderr = result.stderr || '';
    return !isUnknownOptionError(stderr) || QUICK_START_FLAGS.some((flag) => stderr.includes(flag));
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
