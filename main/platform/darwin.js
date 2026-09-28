'use strict';

// Everything that knows where macOS keeps things. A win32.js with the same exports
// is all a Windows port needs on the main-process side.

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { uninstallCommand } = require('../uninstall');

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

// The uninstall script inside the installed app (package.json extraFiles → Contents/uninstall.sh).
function uninstallScriptPath(resourcesPath) {
  return path.join(resourcesPath, '..', 'uninstall.sh');
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

// The built-in speech engine's file name (vendor/whisper → Contents/Resources/whisper).
const WHISPER_CLI = 'whisper-cli';

// ── Claude Code setup ──

// Anthropic's official native installer; puts `claude` in ~/.local/bin.
const INSTALL_COMMAND = 'curl -fsSL https://claude.ai/install.sh | bash';
// Setup scripts are bash .command files, which open in Terminal.
const SETUP_SCRIPT = 'bash';
const SETUP_TERMINAL = 'Terminal';
// Setup screen wording that differs by system, keyed by splash.html's data-copy names.
// Empty on a Mac: the splash's own text is the Mac wording.
const SETUP_COPY = {};

// Opening a .command runs it in a new Terminal window; no Automation permission needed.
// openPath is Electron's shell.openPath (resolves '' or an error message).
function openSetupScript(file, { openPath }) {
  return openPath(file);
}

// Nothing extra to install on a Mac.
async function checkPrerequisites() {
  return { gitMissing: false };
}

// The Mac's binaries run from inside the signed app; there's no antivirus quarantine to detect.
async function blockedBinaries() {
  return [];
}

// The hold-to-talk helper's file name (vendor/helper → Contents/Resources/helper).
const HELPER_BIN = 'promptly-helper';

// The menu bar draws template images, tinted by macOS for light and dark menu bars.
const TRAY_TEMPLATE_ICONS = true;

// Signals reach the process itself on macOS, so binaries.terminate's SIGTERM → SIGKILL is
// enough; nothing extra to do (false = not handled here).
function killTree() {
  return false;
}

// ── Starting command-line tools ──

// The path module for this system's paths.
const paths = path;

// A binary's file names on disk (Windows adds .exe/.cmd).
function executableNames(name) {
  return [name];
}

// [file, args, options] for spawn/execFile. macOS runs every binary as it is.
function spawnArgs(file, args, options = {}) {
  return [file, args, options];
}

// Claude Code reads its login from the keychain and reports "logged out" when USER is unset.
const USER_ENV_VARS = ['USER', 'LOGNAME'];

// ── Window, tray and uninstall ──

// The main window's frame: the traffic lights sit inside the toolbar, centred in its 56 px.
// macOS draws the buttons itself, so the theme doesn't matter here.
function windowChrome() {
  return { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 21 } };
}

// Clicking the menu bar icon leaves the window focused, so focus alone says whether it's in front.
const TRAY_CLICK_BLURS = false;

const UNINSTALL_TEXT = {
  detail: 'This will remove Promptly and all its data:\n\n• Application bundle\n• App data and preferences\n• Logs\n• Microphone permission entry\n• Scheduled harnesses\n\nThis cannot be undone.',
  fallback: 'It will quit now. Then drag Promptly from Applications to the Bin.',
};

// The command that removes Promptly after it has exited. It runs a temp copy of uninstall.sh,
// because the original lives inside the bundle it is about to remove.
function uninstallLaunch({ source, tmpDir, pid, bundlePath, dataPaths }) {
  const script = path.join(tmpDir, `promptly-uninstall-${pid}.sh`);
  fs.copyFileSync(source, script);
  return uninstallCommand({ scriptPath: script, pid, bundlePath, dataPaths });
}

// Microphone access, asking (the system prompt) only the first time. prefs is Electron's
// systemPreferences.
async function microphoneAccess(prefs, { prompt = true } = {}) {
  let status = prefs.getMediaAccessStatus('microphone');
  if (status === 'not-determined' && prompt) {
    await prefs.askForMediaAccess('microphone');
    status = prefs.getMediaAccessStatus('microphone');
  }
  return { granted: status === 'granted', status };
}

// System Settings panes Promptly sends people to.
const PRIVACY_SETTINGS = {
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
};

// ── Scheduled harnesses (launchd) ──

// Which backend main/platform/scheduler.js uses: a launchd plist loaded with launchctl.
const HARNESS_SCHEDULER = 'launchd';

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

// Every harness job Promptly created, for uninstall. dir: scheduler.js passes its own
// (e2e tests keep their plists inside the test profile).
function harnessLaunchAgents(home, dir = launchAgentsDir(home)) {
  try {
    return fs.readdirSync(dir).filter((f) => /^com\.promptly\.harness\..+\.plist$/.test(f))
      .map((f) => ({ label: f.slice(0, -'.plist'.length), plistPath: path.join(dir, f) }));
  } catch { return []; }
}

module.exports = {
  PRIVACY_SETTINGS,
  windowChrome,
  TRAY_CLICK_BLURS,
  UNINSTALL_TEXT,
  uninstallLaunch,
  microphoneAccess,
  SCHEDULE_PATH,
  HARNESS_SCHEDULER,
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
  paths,
  executableNames,
  spawnArgs,
  USER_ENV_VARS,
  WHISPER_CLI,
  INSTALL_COMMAND,
  SETUP_SCRIPT,
  SETUP_TERMINAL,
  SETUP_COPY,
  openSetupScript,
  checkPrerequisites,
  blockedBinaries,
  HELPER_BIN,
  TRAY_TEMPLATE_ICONS,
  killTree,
};
