'use strict';

// Everything that knows where macOS keeps things. A win32.js with the same exports
// is all a Windows port needs on the main-process side.

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PATH_DELIMITER = ':';
const DEFAULT_PATH = '/usr/local/bin:/usr/bin:/bin';

function binaryCandidates(name, home) {
  switch (name) {
    case 'claude':
      return [
        '/usr/local/bin/claude',
        '/usr/bin/claude',
        path.join(home, '.local/bin/claude'),
        path.join(home, '.npm-global/bin/claude'),
        path.join(home, 'node_modules/.bin/claude'),
        '/opt/homebrew/bin/claude',
        '/opt/local/bin/claude',
        path.join(home, '.volta/bin/claude'),
        path.join(home, 'n/bin/claude'),
      ];
    case 'whisper':
      return [
        '/usr/local/bin/whisper',
        '/usr/bin/whisper',
        path.join(home, '.pyenv/shims/whisper'),
        path.join(home, '.local/bin/whisper'),
        path.join(home, '.local/pipx/venvs/openai-whisper/bin/whisper'),
        path.join(home, 'Library/Python/3.9/bin/whisper'),
        path.join(home, 'Library/Python/3.10/bin/whisper'),
        path.join(home, 'Library/Python/3.11/bin/whisper'),
        path.join(home, 'Library/Python/3.12/bin/whisper'),
        '/opt/homebrew/bin/whisper',
        '/opt/local/bin/whisper',
      ];
    case 'ffmpeg':
      return [
        '/usr/local/bin/ffmpeg',
        '/opt/homebrew/bin/ffmpeg',
        path.join(home, '.local/bin/ffmpeg'),
        '/usr/bin/ffmpeg',
      ];
    default:
      return [];
  }
}

// nvm installs each Node version into its own bin dir; npm globals land there.
function nodeVersionBinDirs(home, readdir) {
  const nvmDir = path.join(home, '.nvm', 'versions', 'node');
  try { return readdir(nvmDir).map((v) => path.join(nvmDir, v, 'bin')); } catch { return []; }
}

function isShim(binPath) {
  return binPath.includes('.pyenv/shims/');
}

// Runs a script in the user's login shell (zsh, then bash) and returns the last line it
// printed. Login profiles can print banners or wait on a prompt, so only the last line counts
// and the shell gets 5 s.
function runShell(script) {
  const lastLine = (out) => String(out || '').trim().split('\n').map((l) => l.trim()).filter(Boolean).pop() || null;
  const attempt = (shell) => new Promise((resolve) => {
    execFile(shell, ['-lc', script], { timeout: 5000 }, (err, stdout) => resolve(err ? null : lastLine(stdout)));
  });
  return attempt('zsh').then((out) => out || attempt('bash'));
}

// Last-resort lookup through the user's login shell, which a packaged app doesn't inherit.
async function shellWhich(name) {
  const nvmInit = 'export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh";';
  const found = await runShell(`${nvmInit} command -v ${name}`);
  return found && found.startsWith('/') ? found : null;
}

// pyenv/conda shims need their tool initialised; resolve to the real binary instead.
async function resolveShim(name, shimPath) {
  return (await runShell(`pyenv which ${name} 2>/dev/null`)) || shimPath;
}

async function hasPythonWhisperModule() {
  return !!(await runShell('python3 -m whisper --help > /dev/null 2>&1 && echo found'));
}

// Extra PATH entries for Whisper (Python + ffmpeg live in many places on macOS).
function whisperPathDirs(home) {
  return [
    '/usr/local/bin', '/usr/bin', '/bin', '/opt/homebrew/bin', '/opt/homebrew/sbin', '/opt/local/bin',
    path.join(home, '.local/bin'), path.join(home, '.pyenv/bin'), path.join(home, '.pyenv/shims'),
    path.join(home, 'anaconda3/bin'), path.join(home, 'miniconda3/bin'), path.join(home, 'miniforge3/bin'),
    '/usr/local/opt/ffmpeg/bin',
  ];
}

// Python.org's macOS installer doesn't use the system keychain; point it at the system
// CA bundle so Whisper can download models over HTTPS.
const SSL_ENV = {
  SSL_CERT_FILE: '/etc/ssl/cert.pem',
  REQUESTS_CA_BUNDLE: '/etc/ssl/cert.pem',
};

function whisperModelCacheDirs(home) {
  return [path.join(home, '.cache', 'whisper'), path.join(home, 'Library', 'Caches', 'whisper')];
}

function uninstallDataPaths(home, bundleId) {
  return [
    path.join(home, 'Library', 'Application Support', 'promptly'),
    path.join(home, 'Library', 'Logs', 'promptly'),
    path.join(home, 'Library', 'Preferences', `${bundleId}.plist`),
    path.join(home, 'Library', 'Saved Application State', `${bundleId}.savedState`),
  ];
}

function resetMicrophonePermission(bundleId) {
  return new Promise((resolve) => execFile('tccutil', ['reset', 'Microphone', bundleId], { timeout: 10000 }, (err) => resolve({ ok: !err })));
}

// The .app bundle Promptly is running from (it may not be in /Applications), or null when
// running unpackaged. exe is .../Promptly.app/Contents/MacOS/Promptly.
function appBundlePath(exePath) {
  const bundle = path.resolve(exePath, '..', '..', '..');
  return bundle.endsWith('.app') ? bundle : null;
}

async function removeInstalledApp(bundlePath) {
  if (!bundlePath) return { ok: false, error: 'Not running from an installed app' };
  try {
    await fs.promises.rm(bundlePath, { recursive: true, force: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// System Settings panes Promptly sends people to.
const PRIVACY_SETTINGS = {
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
};

// ── Scheduled harnesses (launchd) ──

// launchd starts jobs with a bare PATH; the harness needs claude, git, node and Homebrew tools.
const SCHEDULE_PATH = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';

function launchAgentsDir(home) {
  return path.join(home, 'Library', 'LaunchAgents');
}

function launchctl(args) {
  return new Promise((resolve) => {
    execFile('launchctl', args, { timeout: 10000 }, (err, _stdout, stderr) => resolve(err ? { ok: false, error: (stderr || err.message).trim() } : { ok: true }));
  });
}

const guiDomain = () => `gui/${process.getuid()}`;

// Replaces a loaded job with the same label, then loads the plist.
async function loadLaunchAgent(plistPath, label) {
  await launchctl(['bootout', `${guiDomain()}/${label}`]);
  return launchctl(['bootstrap', guiDomain(), plistPath]);
}

// A job that isn't loaded counts as stopped.
async function unloadLaunchAgent(label) {
  const r = await launchctl(['bootout', `${guiDomain()}/${label}`]);
  return r.ok || /no such process|could not find/i.test(r.error) ? { ok: true } : r;
}

// Every harness job Promptly created, for uninstall.
function harnessLaunchAgents(home) {
  const dir = launchAgentsDir(home);
  try {
    return fs.readdirSync(dir).filter((f) => /^com\.promptly\.harness\..+\.plist$/.test(f))
      .map((f) => ({ label: f.slice(0, -'.plist'.length), plistPath: path.join(dir, f) }));
  } catch { return []; }
}

module.exports = {
  PRIVACY_SETTINGS,
  SCHEDULE_PATH,
  launchAgentsDir,
  loadLaunchAgent,
  unloadLaunchAgent,
  harnessLaunchAgents,
  PATH_DELIMITER,
  DEFAULT_PATH,
  SSL_ENV,
  binaryCandidates,
  nodeVersionBinDirs,
  isShim,
  shellWhich,
  resolveShim,
  hasPythonWhisperModule,
  whisperPathDirs,
  whisperModelCacheDirs,
  uninstallDataPaths,
  resetMicrophonePermission,
  appBundlePath,
  removeInstalledApp,
};
