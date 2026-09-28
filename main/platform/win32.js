'use strict';

// Everything that knows where Windows keeps things — the same exports as darwin.js.
// Scheduled harnesses (Task Scheduler) are placeholders until phase 2: they answer
// "nothing here" so callers take the same paths as on a Mac with nothing scheduled.

const fs = require('fs');
const { execFile } = require('child_process');
// Windows paths are built with path.win32 so they come out the same when tests run on a Mac.
const path = require('path').win32;

const NOT_YET = { ok: false, error: 'Not on Windows yet' };
const UNINSTALLER = 'Uninstall Promptly.exe';

const PATH_DELIMITER = ';';
const SYSTEM_ROOT = process.env.SystemRoot || 'C:\\Windows';
const DEFAULT_PATH = [
  path.join(SYSTEM_ROOT, 'System32'),
  SYSTEM_ROOT,
  path.join(SYSTEM_ROOT, 'System32', 'WindowsPowerShell', 'v1.0'),
].join(PATH_DELIMITER);

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

// The per-user folders, from the environment when set and from the profile folder otherwise
// (a packaged app launched from Explorer always has them; tests pass their own).
function folders(home, env = process.env) {
  return {
    appData: env.APPDATA || path.join(home, 'AppData', 'Roaming'),
    localAppData: env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'),
    programData: env.ProgramData || 'C:\\ProgramData',
    programFiles: env.ProgramFiles || 'C:\\Program Files',
  };
}

// Python.org installs per version (Python39 … Python313), per user or for everyone.
const PYTHON_VERSIONS = ['39', '310', '311', '312', '313'];
function pythonScriptDirs(home, env) {
  const { appData, localAppData, programFiles } = folders(home, env);
  return PYTHON_VERSIONS.flatMap((v) => [
    path.join(appData, 'Python', `Python${v}`, 'Scripts'),
    path.join(localAppData, 'Programs', 'Python', `Python${v}`, 'Scripts'),
    path.join(programFiles, `Python${v}`, 'Scripts'),
  ]);
}

// Package-manager folders that hold command-line tools: Scoop, Chocolatey, winget.
function packageManagerDirs(home, env) {
  const { localAppData, programData } = folders(home, env);
  return [
    path.join(home, 'scoop', 'shims'),
    path.join(programData, 'chocolatey', 'bin'),
    path.join(localAppData, 'Microsoft', 'WinGet', 'Links'),
  ];
}

// Real executables first (.exe), then npm's .cmd launchers.
function binaryCandidates(name, home, env = process.env) {
  const { appData, localAppData, programFiles } = folders(home, env);
  const managers = packageManagerDirs(home, env);
  switch (name) {
    case 'claude':
      return [
        path.join(home, '.local', 'bin', 'claude.exe'),                 // Claude Code's own installer
        path.join(localAppData, 'Programs', 'claude', 'claude.exe'),
        ...managers.map((d) => path.join(d, 'claude.exe')),
        path.join(localAppData, 'Volta', 'bin', 'claude.exe'),
        path.join(appData, 'npm', 'claude.cmd'),                        // npm install -g
        path.join(env.NVM_SYMLINK || path.join(programFiles, 'nodejs'), 'claude.cmd'), // nvm-windows' active Node
        ...managers.map((d) => path.join(d, 'claude.cmd')),
      ];
    case 'whisper':
      return [
        ...pythonScriptDirs(home, env).map((d) => path.join(d, 'whisper.exe')),
        path.join(home, '.local', 'bin', 'whisper.exe'),                // pipx
        ...managers.map((d) => path.join(d, 'whisper.exe')),
      ];
    case 'ffmpeg':
      return [
        ...managers.map((d) => path.join(d, 'ffmpeg.exe')),
        path.join(programFiles, 'ffmpeg', 'bin', 'ffmpeg.exe'),
        'C:\\ffmpeg\\bin\\ffmpeg.exe',
      ];
    default:
      return [];
  }
}

// nvm-windows keeps each Node version in %APPDATA%\nvm\v<version>; npm globals sit beside node.exe.
function nodeVersionBinDirs(home, readdir, env = process.env) {
  const nvmDir = env.NVM_HOME || path.join(folders(home, env).appData, 'nvm');
  try { return readdir(nvmDir).filter((v) => /^v\d/.test(v)).map((v) => path.join(nvmDir, v)); } catch { return []; }
}

// Scoop and Chocolatey shims are real executables that run as they are.
function isShim() {
  return false;
}

// A WSL-only install isn't usable from a Windows app, so paths inside WSL are never returned.
const isWslPath = (p) => /^\\\\wsl(\$|\.localhost)\\/i.test(p);

// Last-resort lookup on the user's PATH. where.exe prints every match, one per line (CRLF).
function shellWhich(name, { run = execFile, fileExists = exists } = {}) {
  return new Promise((resolve) => {
    run('where.exe', [name], { timeout: 5000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve(null);
      const found = String(stdout || '').split(/\r?\n/).map((l) => l.trim())
        .find((l) => l && path.isAbsolute(l) && !isWslPath(l) && fileExists(l));
      resolve(found || null);
    });
  });
}

async function resolveShim(_name, shimPath) {
  return shimPath;
}

// `python3 -m whisper` is a Mac/Linux spelling; Windows uses whisper.exe from the lists above.
async function hasPythonWhisperModule() {
  return false;
}

function whisperPathDirs(home, env = process.env) {
  return [...pythonScriptDirs(home, env), path.join(home, '.local', 'bin'), ...packageManagerDirs(home, env)];
}

// Windows Python uses the system certificate store; nothing to point it at.
const SSL_ENV = {};

// openai-whisper caches models in ~/.cache/whisper on Windows too.
function whisperModelCacheDirs(home) {
  return [path.join(home, '.cache', 'whisper')];
}

function uninstallDataPaths(home, _bundleId, env = process.env) {
  const { appData, localAppData } = folders(home, env);
  return [path.join(appData, 'Promptly'), path.join(localAppData, 'Promptly')];
}

// Windows has no per-app microphone grant to take back.
async function resetMicrophonePermission() {
  return { ok: true };
}

// The install folder Promptly is running from, or null when running unpackaged.
function appBundlePath(exePath, { fileExists = exists } = {}) {
  const dir = path.dirname(exePath);
  return fileExists(path.join(dir, UNINSTALLER)) ? dir : null;
}

// The uninstall script is macOS-only; Windows uses the installer's own uninstaller.
function uninstallScriptPath() {
  return null;
}

// Runs the NSIS uninstaller silently.
function removeInstalledApp(installDir, { run = execFile } = {}) {
  if (!installDir) return Promise.resolve({ ok: false, error: 'Not running from an installed app' });
  return new Promise((resolve) => {
    run(path.join(installDir, UNINSTALLER), ['/S'], { timeout: 60000, windowsHide: true },
      (err) => resolve(err ? { ok: false, error: err.message } : { ok: true }));
  });
}

// Settings pages Promptly sends people to. Windows has no Accessibility permission.
const PRIVACY_SETTINGS = {
  accessibility: null,
  microphone: 'ms-settings:privacy-microphone',
};

// ── Scheduled harnesses (Task Scheduler, phase 2) ──

const SCHEDULE_PATH = '';

function launchAgentsDir() {
  return null;
}

async function loadLaunchAgent() {
  return NOT_YET;
}

// Nothing was scheduled, so there's nothing to stop.
async function unloadLaunchAgent() {
  return { ok: true };
}

function harnessLaunchAgents() {
  return [];
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
  uninstallScriptPath,
  removeInstalledApp,
};
