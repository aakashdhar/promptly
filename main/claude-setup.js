'use strict';

// Helps someone get Claude Code working without leaving Promptly for long: checks whether it's
// installed and signed in, and opens Terminal with the exact command to install or sign in.
// Promptly only ever uses the Claude Code CLI for AI (see DECISIONS.md D-CLI-ONLY).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { makeClaudeEnv } = require('./binaries');
const platform = require('./platform');

// Anthropic's official installer for this system (main/platform). It puts `claude` where
// binaries.js already looks.
const INSTALL_COMMAND = platform.INSTALL_COMMAND;

function execJson(file, args, env, timeoutMs) {
  return new Promise((resolve) => {
    execFile(...platform.spawnArgs(file, args, { env, timeout: timeoutMs }), (err, stdout) => {
      if (err && !stdout) { resolve(null); return; }
      try { resolve(JSON.parse(stdout)); } catch { resolve(null); }
    });
  });
}

function execText(file, args, env, timeoutMs) {
  return new Promise((resolve) => {
    execFile(...platform.spawnArgs(file, args, { env, timeout: timeoutMs }), (err, stdout) => resolve(err ? null : stdout.trim() || null));
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

// PowerShell single quotes: '' stands for one '.
function psQuote(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

// The same kind of script for Windows: a .ps1 run in its own PowerShell window. Saved with a
// byte-order mark so Windows PowerShell 5.1 reads the text as UTF-8.
function writePowerShellScript(dir, name, lines) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.ps1`);
  const body = [
    `$Host.UI.RawUI.WindowTitle = ${psQuote(name)}`,
    'Clear-Host',
    ...lines,
    "Write-Host ''",
    "Write-Host 'You can close this window and go back to Promptly — it will notice on its own.'",
    '',
  ].join('\r\n');
  fs.writeFileSync(file, `\ufeff${body}`);
  return file;
}

// plat is only passed by tests, to write the Windows script on a Mac.
function installScript(dir, plat = platform) {
  if (plat.SETUP_SCRIPT === 'powershell') {
    return writePowerShellScript(dir, 'Install Claude Code', [
      "Write-Host 'Installing Claude Code for Promptly…'",
      "Write-Host ''",
      `Write-Host ${psQuote(`> ${plat.INSTALL_COMMAND}`)}`,
      plat.INSTALL_COMMAND,
    ]);
  }
  return writeTerminalScript(dir, 'Install Claude Code', [
    'echo "Installing Claude Code for Promptly…"',
    'echo',
    `echo "$ ${INSTALL_COMMAND}"`,
    INSTALL_COMMAND,
  ]);
}

function loginScript(dir, claudePath, plat = platform) {
  if (plat.SETUP_SCRIPT === 'powershell') {
    return writePowerShellScript(dir, 'Sign in to Claude Code', [
      "Write-Host 'Signing in to Claude Code for Promptly. Your browser will open to finish signing in.'",
      "Write-Host ''",
      `& ${psQuote(claudePath)} auth login`,
    ]);
  }
  return writeTerminalScript(dir, 'Sign in to Claude Code', [
    'echo "Signing in to Claude Code for Promptly. Your browser will open to finish signing in."',
    'echo',
    `${shellQuote(claudePath)} auth login`,
  ]);
}

function defaultScriptDir() {
  return path.join(os.tmpdir(), 'promptly-setup');
}

module.exports = { INSTALL_COMMAND, getClaudeStatus, installScript, loginScript, shellQuote, psQuote, defaultScriptDir };
