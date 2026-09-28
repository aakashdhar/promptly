'use strict';

// Everything that knows where Windows keeps things — the same exports as darwin.js.
// Scheduled harnesses run through Task Scheduler in main/platform/scheduler.js; the
// launchd-shaped keys here answer "nothing here" and exist only for the shared shape.

const fs = require('fs');
const { execFile, spawn } = require('child_process');
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

// The built-in speech engine's file name (vendor/whisper → resources\\whisper).
const WHISPER_CLI = 'whisper-cli.exe';

// ── Claude Code setup ──

// Anthropic's official installer for Windows.
const INSTALL_COMMAND = 'irm https://claude.ai/install.ps1 | iex';
const SETUP_SCRIPT = 'powershell';
const SETUP_TERMINAL = 'PowerShell';
// Setup screen wording for Windows, keyed by splash.html's data-copy names (the splash's own
// text is the Mac wording). There's no Accessibility step here, so none of that text changes.
const SETUP_COPY = {
  thisComputer: 'this PC',
  yourComputer: 'your PC',
  micAsks: 'Windows may ask once.',
  micSettingsDetail: 'Turn on microphone access, and "Let desktop apps access your microphone", in Settings → Privacy & security → Microphone, then come back.',
  micSettingsButton: 'Open Settings',
  doubleTapKey: 'ctrl',
  doubleTapLabel: 'Double-tap Ctrl',
  altSpaceLabel: 'Alt plus Space',
  trayTip: 'Promptly lives in the taskbar, by the clock (it may be under ^). Click the microphone icon to show or hide it.',
};

// Runs a setup .ps1 in its own PowerShell window, left open so the person can read it.
// The script is a file passed with -File, never a command string. Resolves '' or an error
// message, like shell.openPath on the Mac.
function openSetupScript(file, { run = spawn } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit', '-File', file],
        { detached: true, stdio: 'ignore', windowsHide: false });
    } catch (err) { resolve(err.message); return; }
    child.once('spawn', () => { child.unref(); resolve(''); });
    child.once('error', (err) => resolve(err.message));
  });
}

// Claude Code on Windows runs its shell commands through Git Bash.
async function checkPrerequisites({ which = shellWhich } = {}) {
  return { gitMissing: !(await which('git')) };
}

// Antivirus or SmartScreen can quarantine an unsigned exe; then it fails to start at all
// (an error code like EACCES or ENOENT), where a working one exits with some number.
// Returns the file names of the ones that couldn't start.
async function blockedBinaries(checks, { run = execFile, fileExists = exists } = {}) {
  const results = await Promise.all(checks.filter((c) => c.file && fileExists(c.file)).map((c) => new Promise((resolve) => {
    run(c.file, c.args, { timeout: 5000, windowsHide: true }, (err) => {
      resolve(err && typeof err.code === 'string' && !err.killed ? path.basename(c.file) : null);
    });
  })));
  return results.filter(Boolean);
}

const HELPER_BIN = 'promptly-helper.exe';

// Windows trays have no template images: each state is its own colour icon (main/tray-icon.js).
const TRAY_TEMPLATE_ICONS = false;

// Windows has no signals: child.kill() ends only the process Node started, and for claude.cmd
// that's cmd.exe — Claude itself would keep running (and spending) after a cancel. taskkill /T
// ends the whole tree. Returns true: handled here.
function killTree(child, { run = execFile } = {}) {
  if (!child || !child.pid) return false;
  run('taskkill', ['/T', '/F', '/PID', String(child.pid)], { timeout: 5000, windowsHide: true }, () => { /* already gone */ });
  return true;
}

// ── Starting command-line tools ──

const paths = path;

// Real executables first: when both exist, claude.exe runs without cmd.exe in between.
function executableNames(name) {
  return [`${name}.exe`, `${name}.cmd`];
}

// Characters cmd.exe treats specially; each gets a ^ in front.
const CMD_META = /([()\][%!^"`<>&|;, *?])/g;

// One argument as the C runtime reads it (quotes, backslashes before quotes), then escaped
// for cmd.exe. npm's .cmd launchers pass arguments on through %*, which cmd reads a second
// time, so the escaping is doubled (as cross-spawn does for npm shims).
function quoteForCmd(arg) {
  let quoted = String(arg)
    .replace(/(\\*)"/g, '$1$1\\"')
    .replace(/(\\*)$/, '$1$1');
  quoted = `"${quoted}"`;
  return quoted.replace(CMD_META, '^$1').replace(CMD_META, '^$1');
}

// Node won't start a .cmd/.bat without a shell (CVE-2024-27980), so those go through
// cmd.exe with a command line built here, every piece escaped. Anything else runs as it is.
// Only fixed flags reach the command line: prompts always go on stdin.
function spawnArgs(file, args, options = {}) {
  if (!/\.(cmd|bat)$/i.test(file)) return [file, args, options];
  const line = [file.replace(CMD_META, '^$1'), ...args.map(quoteForCmd)].join(' ');
  return [
    process.env.ComSpec || 'cmd.exe',
    ['/d', '/s', '/c', `"${line}"`],
    { ...options, windowsVerbatimArguments: true, windowsHide: true },
  ];
}

// Claude Code on Windows identifies the user by USERNAME.
const USER_ENV_VARS = ['USERNAME'];

// ── Window, tray and uninstall ──

// Theme ink (--ink in src/renderer/index.css) for the caption button symbols.
const CAPTION_SYMBOL = { dark: '#ECECF0', light: '#1C1C20' };

// Windows keeps its minimise/maximise/close buttons, drawn over the right end of the 56 px toolbar
// in the window's own colours (titleBarOverlay). theme: { dark, background }.
function windowChrome({ dark = false, background } = {}) {
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: background, symbolColor: dark ? CAPTION_SYMBOL.dark : CAPTION_SYMBOL.light, height: 56 },
  };
}

// Clicking the tray icon moves focus to the taskbar first, so a window that was just in front
// already reads as unfocused by the time the click arrives.
const TRAY_CLICK_BLURS = true;

const UNINSTALL_TEXT = {
  detail: 'This will remove Promptly and all its data:\n\n• The app\n• App data and settings\n• Logs\n\nThis cannot be undone.',
  fallback: 'It will quit now. Then remove Promptly from Settings → Apps → Installed apps.',
};

// Waits for Promptly to exit, runs the NSIS uninstaller in place (_?= keeps it from copying itself
// to Temp and returning at once), then removes the install folder and the data the uninstaller
// keeps. Every path arrives as its own argument: pid, install folder or '-', data paths.
const UNINSTALL_PS1 = `$ErrorActionPreference = 'SilentlyContinue'
$waitPid = [int]$args[0]
$installDir = [string]$args[1]
$data = @($args | Select-Object -Skip 2)
Wait-Process -Id $waitPid -Timeout 30
Start-Sleep -Seconds 1
if ($installDir -ne '-') {
  $uninstaller = Join-Path $installDir '${UNINSTALLER}'
  if (Test-Path -LiteralPath $uninstaller) { Start-Process -FilePath $uninstaller -ArgumentList '/S', ('_?=' + $installDir) -Wait }
  Remove-Item -LiteralPath $installDir -Recurse -Force
}
foreach ($p in $data) { if ($p) { Remove-Item -LiteralPath $p -Recurse -Force } }
Remove-Item -LiteralPath $MyInvocation.MyCommand.Path -Force
`;

// The command that removes Promptly after it has exited: the script above, written to Temp and
// run by a hidden PowerShell. uninstall.sh (source) is macOS-only.
function uninstallLaunch({ tmpDir, pid, bundlePath, dataPaths = [] }, { writeFile = fs.writeFileSync } = {}) {
  const script = path.join(tmpDir, `promptly-uninstall-${pid}.ps1`);
  writeFile(script, UNINSTALL_PS1);
  return ['powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', script,
    String(pid), bundlePath || '-', ...dataPaths,
  ]];
}

// Windows asks by itself the first time an app uses the microphone, so there is nothing to
// prompt for; only the privacy switch being off blocks it, and then setup offers
// PRIVACY_SETTINGS.microphone. prefs is Electron's systemPreferences.
async function microphoneAccess(prefs) {
  const status = prefs.getMediaAccessStatus('microphone');
  return { granted: status !== 'denied', status };
}

// Settings pages Promptly sends people to. Windows has no Accessibility permission.
const PRIVACY_SETTINGS = {
  accessibility: null,
  microphone: 'ms-settings:privacy-microphone',
};

// ── Scheduled harnesses (Task Scheduler) ──

// main/platform/scheduler.js schedules harnesses here with schtasks. The launchd-shaped keys
// below only keep the same shape as darwin.js; nothing on Windows calls them.
const HARNESS_SCHEDULER = 'task-scheduler';
// Task Scheduler runs a task with the user's own PATH, so nothing needs adding beyond
// Claude's folder (main.js prepends that).
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
