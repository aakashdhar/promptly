'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
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
    const inNvm = platform.nodeVersionBinDirs(home, fs.readdirSync).map((d) => path.join(d, name)).find(exists);
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
function makeClaudeEnv(binPath, env = process.env) {
  const originalDir = path.dirname(binPath);
  let resolvedDir = originalDir;
  try { resolvedDir = path.dirname(fs.realpathSync(binPath)); } catch { /* use original */ }
  const base = env.PATH || platform.DEFAULT_PATH;
  const dirs = [originalDir, resolvedDir].filter((d, i, a) => a.indexOf(d) === i && !base.includes(d));
  return { ...env, PATH: dirs.length ? dirs.join(platform.PATH_DELIMITER) + platform.PATH_DELIMITER + base : base };
}

module.exports = {
  PYTHON_WHISPER,
  resolveClaudePath,
  resolveWhisperPath,
  resolveFfmpegPath,
  makeClaudeEnv,
};
