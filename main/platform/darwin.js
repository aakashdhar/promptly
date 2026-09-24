'use strict';

// Everything that knows where macOS keeps things. A win32.js with the same exports
// is all a Windows port needs on the main-process side.

const path = require('path');
const { exec } = require('child_process');

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

function runShell(script) {
  return new Promise((resolve) => {
    exec(`zsh -lc '${script}'`, (err, stdout) => {
      if (!err && stdout.trim()) { resolve(stdout.trim()); return; }
      exec(`bash -lc '${script}'`, (err2, stdout2) => {
        resolve(!err2 && stdout2.trim() ? stdout2.trim() : null);
      });
    });
  });
}

// Last-resort lookup through the user's login shell, which a packaged app doesn't inherit.
function shellWhich(name) {
  const nvmInit = 'export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh";';
  return runShell(`${nvmInit} which ${name}`);
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

// Screenshots of the window the user is talking about: the system capture tool, and sips to
// shrink the result (Claude doesn't need a 5K image, and a smaller one is faster to send).
const SCREENCAPTURE_PATH = '/usr/sbin/screencapture';
const SIPS_PATH = '/usr/bin/sips';
const SCREEN_RECORDING_SETTINGS_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture';

function screenCaptureArgs(windowId, file) {
  // -x no sound, -o no window shadow, -l one window by its number
  return ['-x', '-o', '-t', 'jpg', `-l${windowId}`, file];
}

function shrinkImageArgs(file, maxEdge) {
  return ['-Z', String(maxEdge), file];
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
  return new Promise((resolve) => exec(`tccutil reset Microphone ${bundleId}`, () => resolve()));
}

function resetScreenRecordingPermission(bundleId) {
  return new Promise((resolve) => exec(`tccutil reset ScreenCapture ${bundleId}`, () => resolve()));
}

function removeInstalledApp() {
  return new Promise((resolve) => exec('rm -rf "/Applications/Promptly.app"', () => resolve()));
}

module.exports = {
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
  resetScreenRecordingPermission,
  removeInstalledApp,
  SCREENCAPTURE_PATH,
  SIPS_PATH,
  SCREEN_RECORDING_SETTINGS_URL,
  screenCaptureArgs,
  shrinkImageArgs,
};
