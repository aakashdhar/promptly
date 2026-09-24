'use strict';

// Helps someone get Claude Code working without leaving Promptly for long: checks whether it's
// installed and signed in, and opens Terminal with the exact command to install or sign in.
// Promptly only ever uses the Claude Code CLI for AI (see DECISIONS.md D-CLI-ONLY).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { makeClaudeEnv } = require('./binaries');

// Anthropic's official native installer. It puts `claude` in ~/.local/bin, which
// binaries.js already searches.
const INSTALL_COMMAND = 'curl -fsSL https://claude.ai/install.sh | bash';

function execJson(file, args, env, timeoutMs) {
  return new Promise((resolve) => {
    execFile(file, args, { env, timeout: timeoutMs }, (err, stdout) => {
      if (err && !stdout) { resolve(null); return; }
      try { resolve(JSON.parse(stdout)); } catch { resolve(null); }
    });
  });
}

function execText(file, args, env, timeoutMs) {
  return new Promise((resolve) => {
    execFile(file, args, { env, timeout: timeoutMs }, (err, stdout) => resolve(err ? null : stdout.trim() || null));
  });
}

// { installed, path, version, loggedIn } — loggedIn is null when this CLI can't report it.
async function getClaudeStatus(claudePath) {
  if (!claudePath || !fs.existsSync(claudePath)) return { installed: false, path: null, version: null, loggedIn: false };
  const env = makeClaudeEnv(claudePath);
  const [version, auth] = await Promise.all([
    execText(claudePath, ['--version'], env, 8000),
    execJson(claudePath, ['auth', 'status', '--json'], env, 8000),
  ]);
  if (!version && !auth) return { installed: false, path: claudePath, version: null, loggedIn: false };
  const loggedIn = auth && typeof auth.loggedIn === 'boolean' ? auth.loggedIn : null;
  return { installed: true, path: claudePath, version, loggedIn };
}

function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

// Writes a .command script and opens it, which runs it in a new Terminal window. No
// Automation permission is needed, and the person sees exactly what runs.
function writeTerminalScript(dir, name, lines) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.command`);
  const body = [
    '#!/bin/bash',
    'clear',
    ...lines,
    'echo',
    'echo "You can close this window and go back to Promptly — it will notice on its own."',
    '',
  ].join('\n');
  fs.writeFileSync(file, body, { mode: 0o755 });
  return file;
}

function installScript(dir) {
  return writeTerminalScript(dir, 'Install Claude Code', [
    'echo "Installing Claude Code for Promptly…"',
    'echo',
    `echo "$ ${INSTALL_COMMAND}"`,
    INSTALL_COMMAND,
  ]);
}

function loginScript(dir, claudePath) {
  return writeTerminalScript(dir, 'Sign in to Claude Code', [
    'echo "Signing in to Claude Code for Promptly. Your browser will open to finish signing in."',
    'echo',
    `${shellQuote(claudePath)} auth login`,
  ]);
}

function defaultScriptDir() {
  return path.join(os.tmpdir(), 'promptly-setup');
}

module.exports = { INSTALL_COMMAND, getClaudeStatus, installScript, loginScript, shellQuote, defaultScriptDir };
