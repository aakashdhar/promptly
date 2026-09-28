'use strict';

const fs = require('fs');
const os = require('os');
const platform = require('./platform');

const PYTHON_WHISPER = 'python3 -m whisper';

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function storedPath(value) {
  const p = (value || '').trim();
  return p && exists(p) ? p : null;
}

// Order: path saved in Settings → well-known locations → nvm versions → login shell.
async function resolveBinary(name, stored, { home = os.homedir(), searchNodeVersions = false } = {}) {
  const saved = storedPath(stored);
  if (saved) return saved;
  const found = platform.binaryCandidates(name, home).find(exists);
  if (found) return found;
  if (searchNodeVersions) {
    const inNvm = platform.nodeVersionBinDirs(home, fs.readdirSync)
      .flatMap((d) => platform.executableNames(name).map((n) => platform.paths.join(d, n))).find(exists);
    if (inNvm) return inNvm;
  }
  return platform.shellWhich(name);
}

function resolveClaudePath(stored, opts) {
  return resolveBinary('claude', stored, { ...opts, searchNodeVersions: true });
}

async function resolveWhisperPath(stored, opts) {
  let p = await resolveBinary('whisper', stored, { ...opts, searchNodeVersions: true });
  if (!p && await platform.hasPythonWhisperModule()) return PYTHON_WHISPER;
  if (p && platform.isShim(p)) p = await platform.resolveShim('whisper', p);
  return p;
}

function resolveFfmpegPath(stored, opts) {
  return resolveBinary('ffmpeg', stored, opts);
}

// Claude CLI is a Node.js script (#!/usr/bin/env node). In a packaged .app the PATH is
// minimal and excludes nvm's bin dir, so add the binary's own dir (which holds `node` for
// nvm installs) and the dir its symlink resolves to (covers /usr/local/bin symlinks).
// plat is only passed by tests, to build a Windows environment on a Mac.
function makeClaudeEnv(binPath, env = process.env, plat = platform) {
  const originalDir = plat.paths.dirname(binPath);
  let resolvedDir = originalDir;
  try { resolvedDir = plat.paths.dirname(fs.realpathSync(binPath)); } catch { /* use original */ }
  // Windows spells it Path, and a copied environment is no longer case-insensitive: keep one key.
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
  const base = env[pathKey] || plat.DEFAULT_PATH;
  const present = new Set(base.split(plat.PATH_DELIMITER));
  const dirs = [originalDir, resolvedDir].filter((d, i, a) => a.indexOf(d) === i && !present.has(d));
  // Claude Code reports "logged out" when it can't tell who the user is (USER on macOS, USERNAME on Windows).
  let username = '';
  try { username = os.userInfo().username; } catch { /* leave unset */ }
  const userVars = username ? Object.fromEntries(plat.USER_ENV_VARS.filter((v) => !env[v]).map((v) => [v, username])) : {};
  return {
    ...env,
    ...userVars,
    [pathKey]: dirs.length ? dirs.join(plat.PATH_DELIMITER) + plat.PATH_DELIMITER + base : base,
  };
}

// Asks a child process to stop, and forces it if it's still running after graceMs: a CLI
// that ignores SIGTERM would otherwise keep working (and spending) after a cancel or quit.
function terminate(child, graceMs = 3000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (platform.killTree(child)) return;
  try { child.kill(); } catch { return; }
  const force = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) {
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
    }
  }, graceMs);
  force.unref?.();
}

module.exports = {
  terminate,
  PYTHON_WHISPER,
  resolveClaudePath,
  resolveWhisperPath,
  resolveFfmpegPath,
  makeClaudeEnv,
};
