'use strict';

const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Menu, Tray, nativeImage, nativeTheme, shell, dialog, session, screen, Notification, systemPreferences } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFile, spawn } = require('child_process');

const { createConfigStore } = require('./main/config');
const { uninstallCommand } = require('./main/uninstall');
const { createLogger } = require('./main/log');
const platform = require('./main/platform');
const { resolveClaudePath, resolveWhisperPath, resolveFfmpegPath } = require('./main/binaries');
const { DEFAULT_MODEL, RETIRED_DEFAULTS, createClaudeRunner, parseJsonOutput } = require('./main/llm');
const { createWhisperRunner, findDownloadedModel, whisperCommand } = require('./main/whisper');
const { createSpeechModels, SPEECH_LANGUAGES } = require('./main/speech-models');
const { createQuietDetector } = require('./main/audio-level');
const claudeSetup = require('./main/claude-setup');
const { registerRecordingShortcut } = require('./main/shortcuts');
const { createHelper } = require('./main/helper');
const { HOTKEY_PRESETS, DEFAULT_HOTKEY, getPreset, hotkeyWords, createHoldToTalk } = require('./main/hotkey');
const { destinationFor } = require('./main/prompts');
const { MODES, getMode, resolveModeKey, buildModePrompt, buildRevisePrompt, buildBuilderPrompt, buildEvalPrompt, normalizeEval, buildLearnStylePrompt, buildContextBlock, DETAIL_LEVELS } = require('./main/prompts');
const { createEditLog, profileFor, cleanNotes, formatEdits } = require('./main/profile');
const { tidyDictation } = require('./main/dictation');
const { parseWords, hintWords, applyCorrections, suggestCorrections } = require('./main/words');
const harness = require('./main/harness');
const { drawMicIconPng, isTemplateState } = require('./main/tray-icon');
const { keysFor } = require('./main/keys');

// End-to-end tests run against a throwaway profile and leave system-wide shortcuts alone.
const IS_E2E = !!process.env.PROMPTLY_USER_DATA;
if (IS_E2E) {
  app.setPath('userData', process.env.PROMPTLY_USER_DATA);
  // Chromium's fake microphone, so recording works without touching the real one.
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
  // Keep painting when other windows cover the app (someone using the Mac mid-run); otherwise
  // Chromium stops drawing an occluded window and screenshots wait forever.
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  // Lets tests fire the global hotkey and read state without registering real shortcuts.
  globalThis.__promptlyE2E = {
    pressHotkey: () => onPrimaryShortcut(),
    // Simulates the helper's hold-to-talk events.
    hotkey: (phase) => onHelperHotkey(phase),
    pillState: () => lastPillState,
    appState: () => currentAppState,
    config: () => config.read(),
    trayIconsCreated: () => trayIconsCreated,
    // How many times the window has reported its mode. It does that from the same effects pass
    // that subscribes to hotkeys and keys, so a new report means the page is ready for input.
    modeReports: () => modeReports,
  };
}

const log = createLogger(IS_E2E ? path.join(process.env.PROMPTLY_USER_DATA, 'logs') : app.getPath('logs'));
process.on('uncaughtException', (err) => log.error('Uncaught exception:', err));
process.on('unhandledRejection', (reason) => log.error('Unhandled rejection:', reason instanceof Error ? reason : String(reason)));

const config = createConfigStore(path.join(app.getPath('userData'), 'config.json'), {
  onCorrupt: (backup) => log.warn(`config.json could not be read; moved it to ${backup} and started from defaults`),
});

const BUNDLE_ID = 'io.betacraft.promptly';
const SHORTCUT_PRIMARY = 'Alt+Space';
const SHORTCUT_FALLBACK = 'Control+`';
const SHORTCUT_PAUSE = 'Alt+P';

const MENU_BAR_ICON_STATE = {
  IDLE: 'idle', RECORDING: 'recording', PAUSED: 'recording',
  THINKING: 'thinking', ITERATING: 'thinking',
  PROMPT_READY: 'ready',
  IMAGE_BUILDER: 'builder', IMAGE_BUILDER_DONE: 'builder',
  VIDEO_BUILDER: 'builder', VIDEO_BUILDER_DONE: 'builder',
  WORKFLOW_BUILDER: 'builder', WORKFLOW_BUILDER_DONE: 'builder',
  HARNESS_BUILDER: 'builder', HARNESS_BUILDER_DONE: 'builder',
};

// Built-in speech-to-text (whisper.cpp + model), built by scripts/fetch-whisper.sh.
// Tests can point at a fake engine with PROMPTLY_WHISPER_DIR.
const BUNDLED_WHISPER_DIR = (IS_E2E && process.env.PROMPTLY_WHISPER_DIR)
  || (app.isPackaged ? path.join(process.resourcesPath, 'whisper') : path.join(__dirname, 'vendor', 'whisper'));

// Hold-to-talk / context helper (native/helper), built by scripts/build-helper.sh.
const HELPER_PATH = (IS_E2E && process.env.PROMPTLY_HELPER)
  || (app.isPackaged ? path.join(process.resourcesPath, 'helper', platform.HELPER_BIN) : path.join(__dirname, 'vendor', 'helper', platform.HELPER_BIN));

// Window backgrounds per theme; must match --bg in src/renderer/index.css and splash.html.
const WINDOW_BG = { dark: '#1C1C1F', light: '#F4F4F6' };
const THEMES = ['system', 'light', 'dark'];

function windowBackground() {
  return nativeTheme.shouldUseDarkColors ? WINDOW_BG.dark : WINDOW_BG.light;
}

// Models offered in Settings. Aliases always resolve to the latest model of that family.
const MODEL_OPTIONS = [
  { value: DEFAULT_MODEL, label: 'Sonnet 5 (default)' },
  { value: 'sonnet', label: 'Latest Sonnet' },
  { value: 'opus', label: 'Latest Opus' },
  { value: 'haiku', label: 'Latest Haiku (fastest)' },
];

let claudePath = null;
let whisperPath = null;
let ffmpegPath = null;
let win = null;
let splashWin = null;
let isQuitting = false;
let menuBarTray = null;
let pulseInterval = null;
let currentIconState = 'idle';
let lastGeneratedPrompt = null;
let lastTempAudioPath = null;
let audioSeq = 0;
const audioInUse = new Set(); // files a transcription is reading right now
let lastGenerateRequest = null;
let currentAppState = 'IDLE';
let shortcutsRegistered = false;
let registeredAccelerator = null;
let pillWin = null;
let pillSession = false;        // this recording is shown in the floating pill, not the bar
// The window fills the screen (full screen or zoomed) and is in front, so the pill at the bottom
// is where people look while talking. The pill then mirrors recording and thinking only; the
// result stays in the window, and nothing is typed into another app.
let pillMirror = false;
let lastDictation = null;       // { text, typed } for the dictation just finished from another app
let lastTypedText = null;       // text Promptly typed for you: not copied again, clipboard restored
let lastPillState = null;
let recordRequestedAt = 0;

function winSend(channel, payload) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(channel, payload);
}

// The model in Settings; one saved while an older model was the default follows the new default.
function claudeModel() {
  const stored = config.read().claudeModel;
  return !stored || RETIRED_DEFAULTS.includes(stored) ? DEFAULT_MODEL : stored;
}

// Claude and Whisper processes behind the current operation, so an abort can stop them.
const activeChildren = new Set();
const claude = createClaudeRunner({
  getClaudePath: () => claudePath,
  getModel: claudeModel,
  onSlow: () => winSend('generation-slow-warning'),
  children: activeChildren,
});
// The eval scorecard runs alongside the prompt screen; aborting a new prompt must not kill it.
const evalClaude = createClaudeRunner({
  getClaudePath: () => claudePath,
  getModel: claudeModel,
});
// "Best accuracy" speech model, downloaded on request into userData/models.
// Tests serve a small stand-in model locally with PROMPTLY_SPEECH_MODEL.
const speechModels = createSpeechModels({
  dir: path.join(app.getPath('userData'), 'models'),
  model: IS_E2E && process.env.PROMPTLY_SPEECH_MODEL ? JSON.parse(process.env.PROMPTLY_SPEECH_MODEL) : undefined,
});

// The saved speech language if it's one Promptly offers, otherwise English.
function speechLanguage(stored) {
  return SPEECH_LANGUAGES.some((l) => l.value === stored.speechLanguage) ? stored.speechLanguage : 'en';
}

// The accurate model is used when it's chosen and downloaded; otherwise the built-in one.
function accurateSpeech() {
  const stored = config.read();
  const file = stored.speechModel === 'accurate' ? speechModels.installedPath() : null;
  return file ? { path: file, language: speechLanguage(stored) } : null;
}

const whisper = createWhisperRunner({
  getBundledDir: () => BUNDLED_WHISPER_DIR,
  getWhisperPath: () => whisperPath,
  getFfmpegPath: () => ffmpegPath,
  getPromptHint: () => dictionaryWords().join(', '),
  getAccurateModel: accurateSpeech,
  getLanguage: () => accurateSpeech()?.language || 'en',
  onSlow: () => winSend('transcription-slow-warning'),
  children: activeChildren,
});

async function resolveAllPaths() {
  const stored = config.read();
  claudePath = await resolveClaudePath(stored.claudePath);
  whisperPath = await resolveWhisperPath(stored.whisperPath);
  ffmpegPath = await resolveFfmpegPath(stored.ffmpegPath);
  log.info('Resolved paths', { claudePath, whisperPath, ffmpegPath });
}

// ── Temp audio ────────────────────────────────────────────────────────────────

const audioTmpDir = path.join(os.tmpdir(), 'promptly-audio');

function safeUnlink(p) {
  if (!p) return;
  try { fs.unlinkSync(p); } catch { /* already gone */ }
}

// Recordings kept after a failure (for retry) are removed at startup and when a new
// recording replaces them, so voice data never piles up in the temp directory.
function resetAudioTmpDir() {
  try { fs.rmSync(audioTmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  try { fs.mkdirSync(audioTmpDir, { recursive: true }); } catch { /* ignore */ }
}

// ── Generation ────────────────────────────────────────────────────────────────

// The prompt styles "Make it a prompt" can use: every mode that turns speech into a prompt.
const PROMPT_STYLES = MODES.modes.filter((m) => m.promptStyle);

// Edits the user makes to results, for "Suggest updates from your edits" in Settings.
const editLog = createEditLog(path.join(app.getPath('userData'), 'style-edits.json'));

// Your words: names Whisper and Claude should spell right, and corrections for words Whisper
// keeps mishearing, applied to every transcript.
function dictionaryWords() {
  return hintWords(parseWords(config.read().dictionary));
}

function correctTranscript(transcript) {
  return applyCorrections(transcript, parseWords(config.read().dictionary).corrections);
}

function speechPrefs() {
  const stored = config.read();
  return {
    builtIn: whisper.engine()?.type === 'bundled',
    model: stored.speechModel === 'accurate' ? 'accurate' : 'standard',
    language: accurateSpeech()?.language || speechLanguage(stored),
    languages: SPEECH_LANGUAGES,
    installed: !!speechModels.installedPath(),
    downloading: speechModels.isDownloading(),
    sizeMB: speechModels.sizeMB,
    // The large model needs Apple Silicon's GPU to be quick.
    appleSilicon: process.platform === 'darwin' && (process.arch === 'arm64' || /Apple/.test(os.cpus()[0]?.model || '')),
  };
}

// "Speak up or move closer": told to the window and the pill while recording.
const quietDetector = createQuietDetector();
function sendMicQuiet(quiet) {
  winSend('mic-quiet', quiet);
  if (pillWin && !pillWin.isDestroyed()) pillWin.webContents.send('mic-quiet', quiet);
}

// ── Dictation: typing into the app you're in ──

function dictationPrefs() {
  const stored = config.read();
  return { typeIn: stored.dictationTypeIn !== false, removeFillers: stored.dictationRemoveFillers !== false, symbols: stored.dictationSymbols !== false };
}

// Saves what's on the clipboard (text, rich text, images) so it can be put back afterwards.
function snapshotClipboard() {
  const formats = clipboard.availableFormats();
  return {
    text: clipboard.readText(),
    html: formats.includes('text/html') ? clipboard.readHTML() : '',
    rtf: formats.includes('text/rtf') ? clipboard.readRTF() : '',
    image: formats.some((f) => f.startsWith('image/')) ? clipboard.readImage() : null,
  };
}

function restoreClipboard(saved) {
  const data = {};
  if (saved.text) data.text = saved.text;
  if (saved.html) data.html = saved.html;
  if (saved.rtf) data.rtf = saved.rtf;
  if (saved.image && !saved.image.isEmpty()) data.image = saved.image;
  if (Object.keys(data).length) clipboard.write(data); else clipboard.clear();
}

// Puts the text where the cursor is: on the clipboard, ⌘V via the helper, then the user's own
// clipboard comes back. Needs the helper with Accessibility; otherwise the caller falls back
// to leaving the text on the clipboard.
async function typeIntoApp(text) {
  const status = helper.status();
  if (!helper.isRunning() || !status || !status.trusted) return false;
  const saved = snapshotClipboard();
  clipboard.writeText(text);
  const reply = await helper.paste();
  if (!reply || !reply.ok) { restoreClipboard(saved); return false; }
  lastTypedText = text;
  // The target app reads the clipboard when it handles ⌘V; give it a moment first.
  setTimeout(() => { if (clipboard.readText() === text) restoreClipboard(saved); }, 700);
  return true;
}

async function runDictation(transcript) {
  const prefs = dictationPrefs();
  const { text, removed } = tidyDictation(transcript, { removeFillers: prefs.removeFillers, symbols: prefs.symbols });
  if (!text) return { success: false, error: "Didn't catch anything", errorType: 'empty' };
  const typed = pillSession && prefs.typeIn ? await typeIntoApp(text) : false;
  if (pillSession) lastDictation = { text, typed };
  return { success: true, prompt: text, dictation: { removed, typed } };
}

async function runGeneratePrompt({ transcript, mode, options = {} }) {
  const modeConf = getMode(mode);
  if (modeConf.kind === 'builder') return { success: true, prompt: transcript };
  if (modeConf.kind === 'dictation') return runDictation(transcript);
  const context = {
    ...(options.context || {}),
    ...profileFor(modeConf, config.read()),
    dictionary: dictionaryWords(),
    otherLanguages: (accurateSpeech()?.language || 'en') !== 'en',
  };
  const stored = config.read();
  // Iterate sends the current result and the spoken change; everything else is a fresh request.
  const prompt = options.revise
    ? buildRevisePrompt({ modeKey: mode, ...options.revise, instruction: transcript, tone: options.tone, context })
    : buildModePrompt(transcript, mode, { ...options, detail: stored.promptDetail, context });
  // Stream text modes as they're written; JSON-producing modes (email) wait for the full answer.
  const streams = modeConf.key !== 'email';
  const onDelta = streams ? throttledDelta(80) : undefined;
  return claude.run(prompt, { onDelta });
}

// Streams Claude's answer-so-far to the window at most every `ms` (each send re-renders it).
function throttledDelta(ms, shape = (text) => text) {
  let lastSent = 0;
  return (text) => {
    const now = Date.now();
    if (now - lastSent < ms) return;
    lastSent = now;
    winSend('generation-delta', { text: shape(text) });
  };
}

// ── Menu bar ──────────────────────────────────────────────────────────────────

function createMicIcon(state, isDark, showDot = true) {
  const img = nativeImage.createFromBuffer(drawMicIconPng(state, isDark, showDot), { scaleFactor: 2.0 });
  if (isTemplateState(state)) img.setTemplateImage(true);
  return img;
}

let trayIconsCreated = 0;

function createMenuBarIcon() {
  trayIconsCreated++;
  menuBarTray = new Tray(createMicIcon('idle'));
  menuBarTray.setToolTip('Promptly — ready');
  menuBarTray.on('click', () => {
    if (!win || win.isDestroyed()) return;
    if (win.isVisible() && win.isFocused()) win.hide(); else showWindow();
  });
  menuBarTray.on('right-click', () => {
    menuBarTray.popUpContextMenu(buildTrayMenu());
  });
}

// The icon for what the app is doing now. Recording and generating always show (and pulse);
// otherwise a hidden window shows the quiet icon.
function refreshMenuBarIcon() {
  if (!menuBarTray || menuBarTray.isDestroyed()) return;
  const state = MENU_BAR_ICON_STATE[currentAppState] || 'idle';
  if (state === 'recording' || state === 'thinking' || (win && !win.isDestroyed() && win.isVisible())) {
    updateMenuBarIcon(state);
  } else {
    clearInterval(pulseInterval);
    pulseInterval = null;
    currentIconState = state;
    menuBarTray.setImage(createMicIcon('hidden'));
  }
}

function updateMenuBarIcon(iconState) {
  if (!menuBarTray || menuBarTray.isDestroyed()) return;
  clearInterval(pulseInterval);
  pulseInterval = null;
  currentIconState = iconState;
  const isDark = nativeTheme.shouldUseDarkColors;
  const tooltips = {
    idle:      'Promptly — ready',
    recording: 'Promptly — recording...',
    thinking:  'Promptly — generating...',
    ready:     'Promptly — prompt ready',
  };
  menuBarTray.setToolTip(tooltips[iconState] || 'Promptly');
  if (iconState === 'recording' || iconState === 'thinking') {
    menuBarTray.setImage(createMicIcon(iconState, isDark, true));
    let dotOn = true;
    pulseInterval = setInterval(() => {
      if (!menuBarTray || menuBarTray.isDestroyed()) { clearInterval(pulseInterval); pulseInterval = null; return; }
      dotOn = !dotOn;
      menuBarTray.setImage(createMicIcon(iconState, nativeTheme.shouldUseDarkColors, dotOn));
    }, 600);
  } else {
    menuBarTray.setImage(createMicIcon(iconState, isDark));
  }
}

async function handleUninstall() {
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Cancel', 'Uninstall'],
    defaultId: 0,
    cancelId: 0,
    title: 'Uninstall Promptly',
    message: 'Uninstall Promptly?',
    detail: 'This will remove Promptly and all its data:\n\n• Application bundle\n• App data and preferences\n• Logs\n• Microphone permission entry\n• Scheduled harnesses\n\nThis cannot be undone.',
  });
  if (response === 0) return { cancelled: true };

  // Nothing is deleted while Promptly runs. Removing the app from inside itself froze the Mac: the
  // helper's system-wide key and click hook stayed active while the running app deleted its own
  // bundle and live data, and a dialog then kept it from quitting. So: release the hook first, hand
  // the removal to the uninstall script (it waits for this process to exit), and quit.
  helper.stop();
  globalShortcut.unregisterAll();
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.hide();

  // Scheduled harnesses would otherwise keep running every day with Promptly gone.
  for (const { label, plistPath } of platform.harnessLaunchAgents(os.homedir())) {
    const stopped = await platform.unloadLaunchAgent(label);
    if (!stopped.ok) { log.warn('Uninstall: could not stop harness schedule', { label, error: stopped.error }); continue; }
    try { fs.rmSync(plistPath, { force: true }); } catch { /* ignore */ }
  }
  const bundle = app.isPackaged ? platform.appBundlePath(app.getPath('exe')) : null;
  const source = app.isPackaged ? platform.uninstallScriptPath(process.resourcesPath) : path.join(__dirname, 'scripts', 'uninstall.sh');
  try {
    // A temp copy, because the original lives inside the bundle it is about to remove.
    const script = path.join(os.tmpdir(), `promptly-uninstall-${process.pid}.sh`);
    fs.copyFileSync(source, script);
    const [cmd, args] = uninstallCommand({
      scriptPath: script,
      pid: process.pid,
      bundlePath: bundle,
      dataPaths: platform.uninstallDataPaths(os.homedir(), BUNDLE_ID),
    });
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
    log.info('Uninstall handed to the uninstall script', { bundle });
  } catch (err) {
    log.error('Uninstall script could not start', err);
    await dialog.showMessageBox({
      type: 'warning',
      title: 'Uninstall Promptly',
      message: "Promptly couldn't start its uninstaller",
      detail: 'It will quit now. Then drag Promptly from Applications to the Bin.',
    });
  }
  isQuitting = true;
  app.quit();
  return { ok: true };
}

function buildTrayMenu() {
  const template = [];
  if (lastGeneratedPrompt) {
    template.push({
      label: 'Copy last prompt',
      click: () => {
        clipboard.writeText(lastGeneratedPrompt);
        updateMenuBarIcon('ready');
        // Back to whatever the app is doing by then (a recording may have started meanwhile).
        setTimeout(() => refreshMenuBarIcon(), 1200);
      },
    });
    template.push({ type: 'separator' });
  }
  template.push(
    {
      label: win && win.isVisible() ? 'Hide Promptly' : 'Show Promptly',
      click: () => {
        if (!win || win.isDestroyed()) return;
        if (win.isVisible()) win.hide(); else showWindow();
      },
    },
    { type: 'separator' },
    {
      label: 'Path configuration...',
      click: () => {
        if (win && !win.isDestroyed()) { showWindow(); win.webContents.send('open-settings'); }
      },
    },
    { type: 'separator' },
    { label: 'Uninstall Promptly...', click: () => { handleUninstall().catch((err) => log.error('Uninstall failed', err)); } },
    { type: 'separator' },
    { label: 'Quit Promptly', click: () => { isQuitting = true; app.removeAllListeners('window-all-closed'); app.quit(); } }
  );
  return Menu.buildFromTemplate(template);
}

// ── Shortcuts ─────────────────────────────────────────────────────────────────

// Brings the main window forward from wherever it is: minimised, hidden or behind others.
function showWindow() {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
}

// ── Hotkey: hold to talk, tap to toggle ──
// The helper reports key down/up (hold to talk). Without Accessibility, Electron's
// globalShortcut only sees presses, which act as taps.

function isRecordingState() {
  return currentAppState === 'RECORDING' || currentAppState === 'PAUSED' || Date.now() - recordRequestedAt < 1500;
}

// True from a hotkey start until that recording ends; the app context arrives up to 1.5 s later
// and must not put the pill back into "recording" once it has moved on.
let hotkeyRecordingLive = false;

async function startFromHotkey() {
  recordRequestedAt = Date.now();
  hotkeyRecordingLive = true;
  lastDictation = null;
  hidePillSoon(0);
  // With the bar hidden, recording shows in the floating pill and the bar stays out of the way.
  // Talking from another app (the window closed, or behind the app you're in) happens in the pill.
  pillSession = !win || win.isDestroyed() || !win.isVisible() || !win.isFocused();
  if (pillSession) pillSend({ state: 'recording', mode: currentModeLabel });
  winSend('hotkey-start');
  // Capture where the user is and what they've selected, for destination-aware prompts.
  const ctx = helper.isRunning() ? await helper.context() : null;
  if (ctx && ctx.app && ctx.app.bundleId !== BUNDLE_ID && !String(ctx.app.bundleId || '').startsWith('com.github.Electron')) {
    const destination = destinationFor(ctx.app.bundleId);
    const context = {
      appName: ctx.app.name || '',
      bundleId: ctx.app.bundleId || '',
      destinationLabel: destination ? destination.label : null,
      selectedText: ctx.selectedText || null,
    };
    winSend('recording-context', context);
    if ((pillSession || pillMirror) && hotkeyRecordingLive) pillSend({ state: 'recording', mode: currentModeLabel, context });
  }
}

function stopFromHotkey() {
  recordRequestedAt = 0;
  winSend('hotkey-stop');
  // If the window doesn't finish the recording, record that it didn't, so a stuck recording
  // can be diagnosed from the log.
  clearTimeout(stopWatchdog);
  stopWatchdog = setTimeout(() => {
    if (currentAppState === 'RECORDING' || currentAppState === 'PAUSED') {
      log.error('Recording did not stop 10 s after the stop shortcut', { responsive: win && !win.isDestroyed() && !win.webContents.isCrashed() });
    }
  }, 10000);
}
let stopWatchdog = null;

function cancelFromHotkey() {
  recordRequestedAt = 0;
  winSend('hotkey-cancel');
}

const holdToTalk = createHoldToTalk({
  isRecording: isRecordingState,
  onStart: () => { startFromHotkey().catch((err) => log.error('Hotkey start failed', err)); },
  onStop: stopFromHotkey,
  onCancel: cancelFromHotkey,
});

function onHelperHotkey(phase) {
  if (phase === 'down') holdToTalk.down();
  else if (phase === 'up') holdToTalk.up();
  else if (phase === 'cancel') holdToTalk.cancel();
  else if (phase === 'tap') holdToTalk.tap();
}

// globalShortcut fallback: a press is a tap (start, or stop if already recording).
function onPrimaryShortcut() {
  holdToTalk.down();
  holdToTalk.up();
}

const helper = createHelper({
  binaryPath: HELPER_PATH,
  onHotkey: onHelperHotkey,
  onStatus: (status) => {
    log.info('Helper status', status);
    applyHotkey();
    winSend('accessibility-changed', status);
    if (splashWin && !splashWin.isDestroyed()) splashWin.webContents.send('accessibility-changed', status);
  },
  log,
});

let currentModeLabel = '';
let modeReports = 0; // e2e only reads it (__promptlyE2E.modeReports)

// ── Floating pill ──

function createPillWindow() {
  // Room for the widest state (hover, with a long app name) and the pill's shadow.
  pillWin = new BrowserWindow({
    width: 620,
    height: 92,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false, // pill.html drags it (pill-drag); the spot is remembered (pillPosition)
    focusable: false,
    // The pill never takes focus from your app, but its "Make it a prompt" must answer the first click.
    acceptFirstMouse: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  pillWin.setAlwaysOnTop(true, 'screen-saver');
  pillWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Clicks pass through the transparent area around the pill; the pill itself takes the mouse
  // while the pointer is over it (pill.html reports hover), so it can be dragged and clicked.
  pillWin.setIgnoreMouseEvents(true, { forward: true });
  pillWin.loadFile(path.join(__dirname, 'pill.html'));
}

// Where the pill was dropped, as a fraction of that screen, so it lands in the same place on
// any display.
function savePillPosition() {
  const display = screen.getDisplayMatching(pillWin.getBounds());
  const { x, y, width, height } = display.workArea;
  const [px, py] = pillWin.getPosition();
  const [w, h] = pillWin.getSize();
  const clamp = (v) => Math.min(1, Math.max(0, v));
  config.update({ pillPosition: { fx: clamp((px - x) / Math.max(1, width - w)), fy: clamp((py - y) / Math.max(1, height - h)) } });
}

// On the screen you're using: where you last dragged it, or bottom centre.
function positionPill() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, width, height } = display.workArea;
  const [w, h] = pillWin.getSize();
  const saved = config.read().pillPosition;
  const px = saved ? x + saved.fx * (width - w) : x + (width - w) / 2;
  const py = saved ? y + saved.fy * (height - h) : y + height - h - 36;
  pillWin.setPosition(Math.round(px), Math.round(py));
}

function pillSend(payload) {
  lastPillState = payload;
  if (!pillWin || pillWin.isDestroyed()) return;
  pillWin.webContents.send('pill-state', payload);
  if (payload.state === 'hidden') {
    pillWin.hide();
    return;
  }
  if (!pillWin.isVisible()) {
    positionPill();
    pillWin.showInactive();
  }
}

// Moves a pill session along as the app state changes: recording → writing → done.
function windowFillsScreen() {
  return !!win && !win.isDestroyed() && win.isVisible() && (win.isFullScreen() || win.isMaximized());
}

function updatePill(appState) {
  if (!pillSession && !pillMirror && appState === 'RECORDING' && windowFillsScreen()) pillMirror = true;
  if (pillMirror) {
    if (appState === 'RECORDING' || appState === 'PAUSED') {
      pillSend({ ...(lastPillState?.state === 'recording' ? lastPillState : { mode: currentModeLabel }), state: 'recording', paused: appState === 'PAUSED' });
    } else if (appState === 'THINKING' || appState === 'ITERATING') {
      pillSend({ ...(lastPillState || {}), state: 'thinking', text: '' });
    } else {
      pillMirror = false;
      pillSend({ state: 'hidden' });
    }
    return;
  }
  if (!pillSession) return;
  if (appState === 'RECORDING' || appState === 'PAUSED') {
    pillSend({ ...(lastPillState || {}), state: 'recording', paused: appState === 'PAUSED' });
  } else if (appState === 'THINKING' || appState === 'ITERATING') {
    pillSend({ ...(lastPillState || {}), state: 'thinking', text: '' });
  } else if (appState === 'IDLE') {
    pillSession = false;
    pillSend({ state: 'hidden' });
  } else if (appState === 'PROMPT_READY' && lastDictation) {
    // Dictation from another app stays there: the words are typed (or copied), and the pill
    // offers to turn them into a prompt instead. The window doesn't open.
    pillSession = false;
    pillSend({ state: 'dictated', typed: lastDictation.typed });
    hidePillSoon(6000);
  } else if (appState === 'PROMPT_READY' || appState === 'EMAIL_READY') {
    // A prompt made from another app: you stay there with it on the clipboard. The pill offers
    // to open it in the window.
    pillSession = false;
    pillSend({ state: 'copied', copied: config.read().autoCopy !== false });
    hidePillSoon(6000);
  } else if (appState === 'ERROR' || appState === 'TRANSCRIPTION_ERROR' || appState === 'GENERATION_ERROR') {
    // The pill says something went wrong and offers the window, which has the details and a
    // retry; it doesn't pull the window over the app you're in.
    pillSession = false;
    pillSend({ state: 'error' });
    hidePillSoon(8000);
  } else {
    // Builders need you in the window.
    pillSession = false;
    pillSend({ state: 'hidden' });
    showWindow();
  }
}

let pillHideTimer = null;
let pillHovered = false;
function hidePillSoon(ms) {
  clearTimeout(pillHideTimer);
  pillHideTimer = setTimeout(() => {
    if (pillSession || pillHovered) { if (!pillSession) hidePillSoon(1500); return; }
    if (lastPillState && ['dictated', 'copied', 'error'].includes(lastPillState.state)) pillSend({ state: 'hidden' });
  }, ms);
}

function notify(body) {
  if (!Notification.isSupported()) return;
  new Notification({ title: 'Promptly', body }).show();
}

// Option+P is only claimed while a recording is live, so it doesn't steal the
// key from other apps the rest of the time.
function updatePauseShortcut(appState) {
  const recording = appState === 'RECORDING' || appState === 'PAUSED';
  const registered = globalShortcut.isRegistered(SHORTCUT_PAUSE);
  if (recording && !registered) {
    globalShortcut.register(SHORTCUT_PAUSE, () => winSend('shortcut-pause'));
  } else if (!recording && registered) {
    globalShortcut.unregister(SHORTCUT_PAUSE);
  }
}

function registerShortcut() {
  if (shortcutsRegistered) return;
  shortcutsRegistered = true;
  applyHotkey();
}

// Hold-to-talk via the helper when it can watch the keyboard; otherwise tap-to-toggle via
// globalShortcut (modifier-only presets fall back to Option+Space).
function applyHotkey() {
  if (!shortcutsRegistered) return;
  const preset = getPreset(config.read().hotkey);
  const helperActive = helper.status().tap;
  if (helperActive) helper.configure(preset.helper);
  if (registeredAccelerator) {
    globalShortcut.unregister(registeredAccelerator);
    registeredAccelerator = null;
  }
  if (helperActive || IS_E2E) return;
  registeredAccelerator = registerRecordingShortcut({
    globalShortcut,
    primary: preset.accelerator || SHORTCUT_PRIMARY,
    fallback: SHORTCUT_FALLBACK,
    onTrigger: onPrimaryShortcut,
    notify,
    log,
  });
}

// ── Windows ───────────────────────────────────────────────────────────────────

function createSplashWindow() {
  splashWin = new BrowserWindow({
    width: 560,
    height: 560,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: windowBackground(),
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  splashWin.loadFile(path.join(__dirname, 'splash.html'));
  splashWin.once('ready-to-show', () => {
    splashWin.show();
    splashWin.center();
  });
}

const WINDOW_DEFAULT = { width: 940, height: 600 };
const WINDOW_MIN = { width: 760, height: 520 };

// Where the window opens: where you last left it if that's still on a screen, otherwise the
// default size centred on the screen you're using.
function windowBounds() {
  const saved = config.read().windowBounds;
  if (saved && saved.width >= WINDOW_MIN.width && saved.height >= WINDOW_MIN.height) {
    const onScreen = screen.getAllDisplays().some(({ workArea: wa }) =>
      saved.x >= wa.x - 20 && saved.y >= wa.y - 20 && saved.x + saved.width <= wa.x + wa.width + 20 && saved.y + saved.height <= wa.y + wa.height + 20);
    if (onScreen) return saved;
  }
  const { workArea: wa } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const width = Math.min(WINDOW_DEFAULT.width, wa.width);
  const height = Math.min(WINDOW_DEFAULT.height, wa.height);
  return { width, height, x: Math.round(wa.x + (wa.width - width) / 2), y: Math.round(wa.y + (wa.height - height) / 2) };
}

function createWindow() {
  // One normal window (history beside the current result); talking from other apps happens in
  // the floating pill. It opens at the size and place you last left it.
  win = new BrowserWindow({
    ...windowBounds(),
    minWidth: WINDOW_MIN.width,
    minHeight: WINDOW_MIN.height,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: windowBackground(),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 21 }, // centred in the 56 px toolbar
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile(path.join(__dirname, 'dist-renderer/index.html'));
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
  let saveBoundsTimer = null;
  const saveBounds = () => {
    clearTimeout(saveBoundsTimer);
    saveBoundsTimer = setTimeout(() => {
      if (!win.isDestroyed() && !win.isFullScreen() && !win.isMaximized()) config.update({ windowBounds: win.getBounds() });
    }, 400);
  };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);
  if (!app.isPackaged) {
    // Dev-only devtools shortcut, scoped to this window instead of registered system-wide.
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.meta && input.alt && input.key.toLowerCase() === 'i') {
        win.webContents.openDevTools({ mode: 'detach' });
        event.preventDefault();
      }
    });
  }
  win.webContents.on('render-process-gone', (_e, details) => log.error('Renderer process gone', details));
  win.on('unresponsive', () => log.error('Window stopped responding', { state: currentAppState }));
  win.on('responsive', () => log.info('Window responding again'));
  win.on('hide', () => refreshMenuBarIcon());
  win.on('show', () => refreshMenuBarIcon());
  nativeTheme.on('updated', () => {
    for (const w of [win, splashWin]) {
      if (w && !w.isDestroyed()) w.setBackgroundColor(windowBackground());
    }
    winSend('theme-changed', { dark: nativeTheme.shouldUseDarkColors });
    updateMenuBarIcon(currentIconState);
  });
  return win;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

// Setup is needed on first run, or when Claude Code or speech-to-text stopped working.
async function needsSetup() {
  if (!config.read().setupComplete) return true;
  if (!whisper.engine()) return true;
  const status = await claudeSetup.getClaudeStatus(claudePath);
  return !status.installed || status.loggedIn === false;
}

// An absolute path to a file this user can run.
function isExecutable(p) {
  if (!path.isAbsolute(p)) return false;
  try { return fs.statSync(p).isFile() && (fs.accessSync(p, fs.constants.X_OK), true); } catch { return false; }
}

// Handlers that write files, change paths or schedule jobs answer only the windows that offer
// those actions, not whatever page happens to hold the shared preload.
function fromWindow(event, ...wins) {
  return wins.some((w) => w && !w.isDestroyed() && event.sender === w.webContents);
}

function finishSetup() {
  if (splashWin && !splashWin.isDestroyed()) { splashWin.destroy(); splashWin = null; }
  // windowBounds() already placed it: where it was left, or centred the first time. Centring
  // here would move it (and save that) on every launch.
  if (win && !win.isDestroyed()) win.show();
  registerShortcut();
  // Runs again after the wizard is reopened from Settings; keep a single tray icon.
  if (!menuBarTray || menuBarTray.isDestroyed()) createMenuBarIcon();
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.on('before-quit', () => {
  isQuitting = true;
  helper.stop();
  // Nothing Promptly started should outlive it: a harness step can run for minutes on the
  // user's Claude quota, and Whisper keeps the CPU busy.
  claude.cancelAll();
  evalClaude.cancelAll();
  speechModels.cancel();
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  // Exit now, before this second copy reaches 'ready' and clears the first one's temp audio.
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', () => showWindow());
}

app.commandLine.appendSwitch('enable-transparent-visuals');

// A minimal menu instead of Electron's default (no Reload/DevTools/View clutter). The Edit menu
// must exist: on macOS it is what makes Cmd+C/V/X/A/Z work in text fields. No "Hide" item,
// because Cmd+H opens History.
Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'Promptly', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
    ],
  },
]));

app.whenReady().then(async () => {
  log.info(`Promptly ${app.getVersion()} starting`);
  // setPermissionCheckHandler: Chromium asks "do I already have this permission?" before
  // opening any stream. Returning true for 'media' tells Chromium it's already granted,
  // which prevents a repeated per-call dialog. macOS itself still asks once (TCC).
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media';
  });
  // setPermissionRequestHandler: handles any fresh permission request that still comes through.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  resetAudioTmpDir();
  const theme = config.read().theme;
  nativeTheme.themeSource = THEMES.includes(theme) ? theme : 'system';
  await resolveAllPaths();


  // ── Setup wizard ──

  ipcMain.handle('splash-done', async () => {
    if (splashWin && !splashWin.isDestroyed()) splashWin.hide();
    setTimeout(finishSetup, 400);
  });

  ipcMain.handle('splash-check-cli', async () => {
    return { ok: !!claudePath, path: claudePath };
  });

  ipcMain.handle('splash-check-whisper', async () => {
    const engine = whisper.engine();
    if (engine?.type === 'bundled') return { ok: true, path: engine.cli, builtIn: true, ffmpegFound: true };
    // Python fallback: honours a custom ffmpeg path saved in Settings, not just the default locations.
    const resolvedFfmpeg = ffmpegPath || await resolveFfmpegPath(config.read().ffmpegPath);
    return { ok: !!whisperPath, path: whisperPath, builtIn: false, ffmpegFound: !!resolvedFfmpeg };
  });

  // ── Claude Code setup ──

  ipcMain.handle('claude-status', async () => {
    if (!claudePath) claudePath = await resolveClaudePath(config.read().claudePath);
    return claudeSetup.getClaudeStatus(claudePath);
  });

  // What the setup screen says for this system, and anything that stops setup working on it:
  // Git for Windows missing, or an antivirus that quarantined the speech engine or the helper.
  ipcMain.handle('setup-info', async () => {
    const [{ gitMissing }, blocked] = await Promise.all([
      platform.checkPrerequisites(),
      platform.blockedBinaries([
        { file: path.join(BUNDLED_WHISPER_DIR, platform.WHISPER_CLI), args: ['--help'] },
        { file: HELPER_PATH, args: ['--version'] },
      ]),
    ]);
    return { installCommand: claudeSetup.INSTALL_COMMAND, terminal: platform.SETUP_TERMINAL, gitMissing, blocked };
  });

  ipcMain.handle('claude-install', async () => {
    const script = claudeSetup.installScript(claudeSetup.defaultScriptDir());
    const error = await platform.openSetupScript(script, { openPath: (file) => shell.openPath(file) });
    return { ok: !error, error: error || null, command: claudeSetup.INSTALL_COMMAND };
  });

  ipcMain.handle('claude-login', async () => {
    if (!claudePath) claudePath = await resolveClaudePath(config.read().claudePath);
    if (!claudePath) return { ok: false, error: 'Claude Code is not installed yet' };
    const script = claudeSetup.loginScript(claudeSetup.defaultScriptDir(), claudePath);
    const error = await platform.openSetupScript(script, { openPath: (file) => shell.openPath(file) });
    return { ok: !error, error: error || null };
  });

  // ── Hold to talk, pill, preferences ──

  ipcMain.on('audio-level', (_event, level) => {
    if ((pillSession || pillMirror) && pillWin && !pillWin.isDestroyed()) pillWin.webContents.send('audio-level', level);
    const wasQuiet = quietDetector.isQuiet();
    if (quietDetector.push(level) !== wasQuiet) sendMicQuiet(!wasQuiet);
  });

  ipcMain.on('mode-changed', (_event, label) => { currentModeLabel = String(label || ''); modeReports++; });

  ipcMain.on('renderer-log', (_event, { level, message } = {}) => {
    const write = level === 'error' ? log.error : level === 'warn' ? log.warn : log.info;
    write(`[window] ${String(message || '').slice(0, 2000)}`);
  });

  ipcMain.handle('get-preferences', () => {
    const stored = config.read();
    return {
      hotkey: HOTKEY_PRESETS[stored.hotkey] ? stored.hotkey : DEFAULT_HOTKEY,
      hotkeyWords: hotkeyWords(stored.hotkey, { helperActive: !!helper.status().tap }),
      hotkeyOptions: Object.entries(HOTKEY_PRESETS).map(([value, p]) => ({ value, label: p.label, holdOnly: !p.accelerator })),
      dictionary: stored.dictionary || '',
      voiceNotes: stored.voiceNotes || '',
      aboutMe: stored.aboutMe || '',
      editCount: editLog.count(),
      autoCopy: stored.autoCopy !== false,
      promptStyle: PROMPT_STYLES.some((m) => m.key === resolveModeKey(stored.promptStyle)) ? resolveModeKey(stored.promptStyle) : 'prompt',
      promptDetail: DETAIL_LEVELS[stored.promptDetail] ? stored.promptDetail : 'detailed',
      promptStyles: PROMPT_STYLES.map(({ key, label }) => ({ value: key, label })),
      dictationTypeIn: stored.dictationTypeIn !== false,
      dictationRemoveFillers: stored.dictationRemoveFillers !== false,
      dictationSymbols: stored.dictationSymbols !== false,
      historyHidden: stored.historyHidden === true,
      speech: speechPrefs(),
      launchAtLogin: app.getLoginItemSettings().openAtLogin,
      accessibility: helper.status(),
      helperAvailable: helper.isRunning(),
    };
  });

  ipcMain.handle('set-preferences', (_event, prefs = {}) => {
    const patch = {};
    if (typeof prefs.hotkey === 'string' && HOTKEY_PRESETS[prefs.hotkey]) patch.hotkey = prefs.hotkey;
    if (typeof prefs.dictionary === 'string') patch.dictionary = prefs.dictionary.slice(0, 5000);
    if (typeof prefs.autoCopy === 'boolean') patch.autoCopy = prefs.autoCopy;
    if (typeof prefs.promptStyle === 'string' && PROMPT_STYLES.some((m) => m.key === prefs.promptStyle)) patch.promptStyle = prefs.promptStyle;
    if (DETAIL_LEVELS[prefs.promptDetail]) patch.promptDetail = prefs.promptDetail;
    if (typeof prefs.dictationTypeIn === 'boolean') patch.dictationTypeIn = prefs.dictationTypeIn;
    if (typeof prefs.dictationRemoveFillers === 'boolean') patch.dictationRemoveFillers = prefs.dictationRemoveFillers;
    if (typeof prefs.dictationSymbols === 'boolean') patch.dictationSymbols = prefs.dictationSymbols;
    if (typeof prefs.historyHidden === 'boolean') patch.historyHidden = prefs.historyHidden;
    if (prefs.speechModel === 'standard' || prefs.speechModel === 'accurate') patch.speechModel = prefs.speechModel;
    if (SPEECH_LANGUAGES.some((l) => l.value === prefs.speechLanguage)) patch.speechLanguage = prefs.speechLanguage;
    if (typeof prefs.voiceNotes === 'string') patch.voiceNotes = cleanNotes(prefs.voiceNotes);
    if (typeof prefs.aboutMe === 'string') patch.aboutMe = cleanNotes(prefs.aboutMe);
    config.update(patch);
    if (typeof prefs.launchAtLogin === 'boolean' && !IS_E2E) app.setLoginItemSettings({ openAtLogin: prefs.launchAtLogin });
    if (patch.hotkey) applyHotkey();
    return { ok: true };
  });

  // ── Speech recognition model ──

  ipcMain.handle('download-speech-model', async () => {
    const result = await speechModels.download((progress) => winSend('speech-model-progress', progress));
    // Downloading is choosing it: switch over as soon as it's ready.
    if (result.success) config.update({ speechModel: 'accurate' });
    else if (!result.cancelled) log.warn('Speech model download failed', result.error);
    return { ...result, speech: speechPrefs() };
  });

  ipcMain.handle('cancel-speech-model', () => ({ cancelled: speechModels.cancel() }));

  ipcMain.handle('remove-speech-model', () => {
    speechModels.remove();
    config.update({ speechModel: 'standard' });
    return { speech: speechPrefs() };
  });

  // Hold to talk and selected text need Accessibility. Asking shows the macOS prompt, which
  // links to System Settings; the helper notices within 2 s once it's granted.
  ipcMain.handle('request-accessibility', async () => {
    if (process.platform === 'darwin' && !IS_E2E) systemPreferences.isTrustedAccessibilityClient(true);
    const status = await helper.refreshStatus();
    return status ? { trusted: !!status.trusted, tap: !!status.tap } : helper.status();
  });

  ipcMain.handle('accessibility-status', async () => {
    const status = await helper.refreshStatus();
    return { available: helper.isRunning(), ...(status ? { trusted: !!status.trusted, tap: !!status.tap } : helper.status()) };
  });

  // ── It writes like you ──

  ipcMain.handle('record-edit', (_event, { mode, before, after } = {}) => {
    const recorded = editLog.add({ mode, before, after });
    return { recorded, editCount: editLog.count() };
  });

  // Corrections the user keeps making by hand ("N10" → "n8n"), offered for Your words.
  ipcMain.handle('word-suggestions', () => {
    const stored = config.read();
    return suggestCorrections(editLog.list(), parseWords(stored.dictionary), stored.dismissedWords || []);
  });

  ipcMain.handle('dismiss-word-suggestion', (_event, { from } = {}) => {
    const word = String(from || '').trim().slice(0, 100);
    if (word) config.update({ dismissedWords: [...(config.read().dismissedWords || []), word].slice(-100) });
    return { ok: true };
  });

  ipcMain.handle('clear-edits', () => {
    editLog.clear();
    return { editCount: 0 };
  });

  // Drafts "How you write" notes from pasted samples, or from the logged edits. The result is
  // only a suggestion: Settings shows it and the user decides whether to use it.
  ipcMain.handle('learn-style', async (_event, { samples } = {}) => {
    const text = String(samples || '').trim().slice(0, 12000);
    const edits = editLog.list();
    if (!text && !edits.length) return { success: false, error: 'Nothing to learn from yet' };
    const prompt = buildLearnStylePrompt({
      current: cleanNotes(config.read().voiceNotes),
      samples: text,
      edits: text ? '' : formatEdits(edits),
    });
    const result = await claude.run(prompt, { timeoutMs: 60000 });
    return result.success ? { success: true, notes: cleanNotes(result.prompt) } : result;
  });

  ipcMain.handle('open-accessibility-settings', () => {
    shell.openExternal(platform.PRIVACY_SETTINGS.accessibility).catch((err) => log.warn('Could not open System Settings', err.message));
  });

  // ── Theme ──

  ipcMain.handle('get-theme-setting', () => {
    const theme = config.read().theme;
    return { theme: THEMES.includes(theme) ? theme : 'system' };
  });

  ipcMain.handle('set-theme-setting', (_event, { theme } = {}) => {
    if (!THEMES.includes(theme)) return { ok: false };
    config.update({ theme });
    nativeTheme.themeSource = theme;
    return { ok: true };
  });

  ipcMain.handle('splash-open-url', async (_event, url) => {
    if (typeof url === 'string' && url.startsWith('https://')) shell.openExternal(url).catch((err) => log.warn('Could not open link', err.message));
  });

  // Asks macOS for microphone access (shows the system prompt the first time).
  ipcMain.handle('request-microphone', async (_event, { prompt = true } = {}) => {
    if (process.platform !== 'darwin' || IS_E2E) return { granted: true, status: 'granted' };
    let status = systemPreferences.getMediaAccessStatus('microphone');
    if (status === 'not-determined' && prompt) {
      await systemPreferences.askForMediaAccess('microphone');
      status = systemPreferences.getMediaAccessStatus('microphone');
    }
    return { granted: status === 'granted', status };
  });

  ipcMain.handle('open-microphone-settings', () => {
    shell.openExternal(platform.PRIVACY_SETTINGS.microphone).catch((err) => log.warn('Could not open System Settings', err.message));
  });

  ipcMain.handle('check-setup-complete', () => {
    return { complete: !!config.read().setupComplete };
  });

  ipcMain.handle('set-setup-complete', () => {
    config.update({ setupComplete: true });
  });

  ipcMain.handle('reopen-wizard', () => {
    config.update({ setupComplete: false });
    if (splashWin && !splashWin.isDestroyed()) {
      splashWin.show();
      splashWin.center();
      return;
    }
    createSplashWindow();
    if (win && !win.isDestroyed()) win.hide();
  });

  // ── Generation ──

  ipcMain.handle('generate-prompt', (_event, { transcript, mode, options = {} } = {}) => {
    lastGenerateRequest = { transcript: String(transcript ?? ''), mode: mode || MODES.defaultMode, options: options && typeof options === 'object' ? options : {} };
    return runGeneratePrompt(lastGenerateRequest);
  });

  // Image, Video and Workflow: one step of a builder, from its prompt file in main/prompts.
  ipcMain.handle('builder-step', (_event, { step, values } = {}) => {
    const prompt = buildBuilderPrompt(String(step || ''), values || {});
    if (!prompt) return { success: false, error: 'Unknown builder step', errorType: 'unknown' };
    return claude.run(prompt, { timeoutMs: 120000, slowWarningMs: 45000 });
  });

  // ── Harness mode ──

  // The files and run command are kept here, as Claude wrote them. Saving and scheduling use
  // this copy, never what the window sends back, because launchd runs `run` through bash.
  let lastHarnessFiles = null; // { run, schedule, files } from the last harness-files result
  let lastSavedHarness = null; // { dir, run } from the last Save to project…
  // Tests keep their launchd jobs inside the throwaway profile, never in the real LaunchAgents.
  const harnessPlistPath = (dir) => path.join(
    IS_E2E ? path.join(app.getPath('userData'), 'LaunchAgents') : platform.launchAgentsDir(os.homedir()),
    `${harness.agentLabel(dir)}.plist`,
  );

  ipcMain.handle('harness-plan', async (_event, { transcript, context = {} } = {}) => {
    const stored = config.read();
    const block = buildContextBlock(getMode('harness'), { ...context, ...profileFor(getMode('harness'), stored), dictionary: dictionaryWords() });
    const result = await claude.run(harness.buildPlanPrompt(String(transcript || ''), block), { timeoutMs: 120000, slowWarningMs: 45000 });
    if (!result.success) return result;
    const plan = harness.parsePlan(result.prompt);
    return plan ? { success: true, plan } : { success: false, error: "Couldn't map that into a harness. Try describing it again.", errorType: 'parse' };
  });

  ipcMain.handle('harness-files', async (_event, { transcript, plan, answers } = {}) => {
    if (!plan || typeof plan !== 'object') return { success: false, error: 'No plan to write', errorType: 'unknown' };
    lastHarnessFiles = null;
    // Thinking is off here: with it on, a pipeline's files took minutes longer and came out no
    // better. The window still shows each file as it's finished.
    const onDelta = throttledDelta(250, harness.progressText);
    const result = await claude.run(harness.buildFilesPrompt({ transcript: String(transcript || ''), plan, answers: answers || {} }), { timeoutMs: 300000, slowWarningMs: 90000, onDelta, thinking: false });
    if (!result.success) return result;
    const parsed = harness.parseFiles(result.prompt);
    lastHarnessFiles = parsed;
    return parsed ? { success: true, ...parsed } : { success: false, error: "Couldn't read the files Claude wrote. Try again.", errorType: 'parse' };
  });

  // Saves the harness into a project folder the user picks. Existing files are only replaced
  // after they confirm; an existing .claude/settings.json gets the new hooks added, not replaced.
  // The window's copy of files and run is ignored; the arguments stay for the IPC contract.
  ipcMain.handle('save-harness', async (event) => {
    if (!fromWindow(event, win)) return { ok: false, error: 'Not allowed' };
    const list = (lastHarnessFiles?.files || []).filter((f) => f && harness.safeRelativePath(f.path));
    if (!list.length) return { ok: false, error: 'Nothing to save' };
    let dir = IS_E2E ? process.env.PROMPTLY_SAVE_DIR : null;
    if (!dir) {
      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Save the harness',
        message: 'Choose the project folder the harness will work in',
        buttonLabel: 'Save here',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (canceled || !filePaths?.[0]) return { ok: false, cancelled: true };
      dir = filePaths[0];
    }
    const clash = harness.existingFiles(dir, list);
    if (clash.length && !IS_E2E) {
      const { response } = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: ['Replace', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        message: `Replace ${clash.length === 1 ? 'a file' : `${clash.length} files`} in ${path.basename(dir)}?`,
        detail: clash.join('\n'),
      });
      if (response !== 0) return { ok: false, cancelled: true };
    }
    try {
      const written = harness.writeFiles(dir, list);
      log.info('Saved harness', { dir, files: written.length });
      lastSavedHarness = { dir, run: String(lastHarnessFiles.run || '').trim() };
      const alreadyScheduled = fs.existsSync(harnessPlistPath(dir));
      return { ok: true, dir, written, alreadyScheduled };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Runs the harness saved last on a schedule, as a launchd job in the user's LaunchAgents
  // (one per project folder; scheduling again replaces it). Only the folder and command from
  // that save are used, never paths sent by the window.
  ipcMain.handle('schedule-harness', async (event, { schedule } = {}) => {
    if (!fromWindow(event, win)) return { ok: false, error: 'Not allowed' };
    const sched = harness.checkSchedule(schedule);
    if (!lastSavedHarness?.run) return { ok: false, error: 'Save the harness to a project first' };
    if (!sched) return { ok: false, error: 'Pick when it should run' };
    const { dir, run } = lastSavedHarness;
    const label = harness.agentLabel(dir);
    const plistPath = harnessPlistPath(dir);
    const claudeDir = claudePath ? path.dirname(claudePath) : '';
    const pathEnv = [claudeDir, platform.SCHEDULE_PATH].filter(Boolean).join(platform.PATH_DELIMITER);
    try {
      fs.mkdirSync(path.dirname(plistPath), { recursive: true });
      // launchd won't create the log's folder, and without it every scheduled run's output is lost.
      fs.mkdirSync(path.join(dir, '.harness'), { recursive: true });
      fs.writeFileSync(plistPath, harness.launchAgentPlist({ label, dir, run, schedule: sched, pathEnv }));
    } catch (err) {
      return { ok: false, error: err.message };
    }
    const loaded = IS_E2E ? { ok: true } : await platform.loadLaunchAgent(plistPath, label);
    if (!loaded.ok) return { ok: false, error: `macOS didn't accept the schedule: ${loaded.error}` };
    log.info('Scheduled harness', { dir, label, schedule: sched });
    return { ok: true, label: harness.scheduleLabel(sched) };
  });

  ipcMain.handle('unschedule-harness', async (event) => {
    if (!fromWindow(event, win)) return { ok: false, error: 'Not allowed' };
    if (!lastSavedHarness) return { ok: false, error: 'No saved harness' };
    const label = harness.agentLabel(lastSavedHarness.dir);
    const unloaded = IS_E2E ? { ok: true } : await platform.unloadLaunchAgent(label);
    // Keep the plist while the job may still be loaded, so a retry can find and stop it.
    if (!unloaded.ok) return { ok: false, error: `macOS didn't stop the schedule: ${unloaded.error}` };
    try { fs.rmSync(harnessPlistPath(lastSavedHarness.dir), { force: true }); } catch (err) { return { ok: false, error: err.message }; }
    log.info('Removed harness schedule', { dir: lastSavedHarness.dir, label });
    return { ok: true };
  });

  // Replays the last generate-prompt request with the same mode and options
  // (tone, email override), so a retry produces what the original call would have.
  ipcMain.handle('retry-generation', () => {
    if (!lastGenerateRequest) return { success: false, error: 'Nothing to retry — please record again', errorType: 'unknown' };
    return runGeneratePrompt(lastGenerateRequest);
  });

  // Stops in-flight Claude and Whisper processes when the user aborts.
  ipcMain.handle('cancel-operations', () => {
    claude.cancelAll(); // the set is shared with Whisper, so this stops both
    return { ok: true };
  });

  ipcMain.handle('evaluate-prompt', async (_event, { transcript, prompt } = {}) => {
    if (!claudePath || !transcript || !prompt) return { success: false };
    const result = await evalClaude.run(buildEvalPrompt(transcript, prompt), { timeoutMs: 30000, slowWarningMs: 0 });
    if (!result.success) return { success: false };
    try {
      const data = normalizeEval(parseJsonOutput(result.prompt));
      if (data) return { success: true, data };
    } catch (err) {
      log.warn('Eval response was not valid JSON', err.message);
    }
    return { success: false };
  });

  // ── Transcription ──

  ipcMain.handle('transcribe-audio', async (_event, arrayBuffer) => {
    // A new recording replaces the one kept for retry (unless another transcription is reading it).
    if (lastTempAudioPath && !audioInUse.has(lastTempAudioPath)) safeUnlink(lastTempAudioPath);
    lastTempAudioPath = null;
    if (!whisper.engine()) {
      return { success: false, error: 'Speech-to-text is not available — reinstall Promptly' };
    }
    const bytes = arrayBuffer instanceof ArrayBuffer ? Buffer.from(arrayBuffer)
      : ArrayBuffer.isView(arrayBuffer) ? Buffer.from(arrayBuffer.buffer, arrayBuffer.byteOffset, arrayBuffer.byteLength)
        : null;
    if (!bytes || !bytes.length) return { success: false, error: 'No audio was recorded — try again' };
    try { fs.mkdirSync(audioTmpDir, { recursive: true }); } catch { /* ignore */ }
    // The renderer sends 16 kHz WAV; anything else (a recording it couldn't decode) keeps webm.
    const isWav = bytes.subarray(0, 4).toString('ascii') === 'RIFF';
    // Two transcriptions can overlap (a recording and a refinement); each owns its own file, and
    // only the latest one decides which file a retry uses.
    const tmpFile = path.join(audioTmpDir, `promptly-${Date.now()}-${++audioSeq}.${isWav ? 'wav' : 'webm'}`);
    try {
      await fs.promises.writeFile(tmpFile, bytes);
      lastTempAudioPath = tmpFile;
      audioInUse.add(tmpFile);
      const transcript = correctTranscript(await whisper.transcribe(tmpFile, { timeoutMs: 60000, slowWarningMs: 20000 }).finally(() => audioInUse.delete(tmpFile)));
      safeUnlink(tmpFile);
      if (lastTempAudioPath === tmpFile) lastTempAudioPath = null;
      return { success: true, transcript };
    } catch (err) {
      // Keep tmpFile on error so retry-transcription can reuse it.
      log.warn('Transcription failed', err.message);
      return { success: false, error: err.message || 'Transcription failed', ...(err.timedOut && { timedOut: true }) };
    }
  });

  ipcMain.handle('retry-transcription', async () => {
    const noAudio = { success: false, error: 'No audio available — please record again' };
    if (!lastTempAudioPath) return noAudio;
    try { if (!fs.existsSync(lastTempAudioPath)) return noAudio; } catch { return noAudio; }
    if (!whisper.engine()) return { success: false, error: 'Speech-to-text is not available — reinstall Promptly' };
    try {
      const transcript = correctTranscript(await whisper.transcribe(lastTempAudioPath, { timeoutMs: 90000, slowWarningMs: 20000 }));
      safeUnlink(lastTempAudioPath);
      lastTempAudioPath = null;
      return { success: true, transcript };
    } catch (err) {
      log.warn('Transcription retry failed', err.message);
      return { success: false, error: err.message || 'Transcription failed', ...(err.timedOut && { timedOut: true }) };
    }
  });

  // ── Window ──

  ipcMain.handle('copy-to-clipboard', (_event, { text } = {}) => {
    if (typeof text !== 'string') return { success: false };
    clipboard.writeText(text);
    return { success: true };
  });


  ipcMain.handle('show-mode-menu', (_event, { currentMode } = {}) => {
    // Grouped the same way as the window's mode menu: Dictation, prompt styles, specialists.
    const item = ({ key, label }) => ({ label, type: 'checkbox', checked: resolveModeKey(currentMode) === key, click: () => { winSend('mode-selected', key); } });
    const group = (title, list) => [{ type: 'separator' }, { label: title, enabled: false }, ...list.map(item)];
    const menu = Menu.buildFromTemplate([
      ...MODES.modes.filter((m) => m.kind === 'dictation').map(item),
      ...group('Prompt style', MODES.modes.filter((m) => m.group === 'general' && m.kind !== 'dictation')),
      ...group('Specialist', MODES.modes.filter((m) => m.group === 'specialist')),
      { type: 'separator' },
      {
        label: 'Keyboard shortcuts ⌘?',
        click: () => { winSend('show-shortcuts'); },
      },
      { type: 'separator' },
      {
        label: 'History ⌘H',
        click: () => { winSend('show-history'); },
      },
    ]);
    menu.popup({ window: win });
    return { ok: true };
  });

  ipcMain.handle('show-tone-menu', (_event, { currentTone } = {}) => {
    const tones = [
      { key: 'formal', label: 'Formal' },
      { key: 'casual', label: 'Casual' },
    ];
    const menu = Menu.buildFromTemplate(
      tones.map(({ key, label }) => ({
        label,
        type: 'checkbox',
        checked: currentTone === key,
        click: () => { winSend('tone-selected', key); },
      }))
    );
    menu.popup({ window: win });
    return { ok: true };
  });

  ipcMain.handle('save-file', async (event, { content, filename } = {}) => {
    if (!fromWindow(event, win)) return { ok: false };
    if (typeof content !== 'string') return { ok: false, error: 'Nothing to save' };
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      defaultPath: typeof filename === 'string' ? path.basename(filename) : 'prompt.txt',
      filters: [
        { name: 'Text',     extensions: ['txt'] },
        { name: 'Markdown', extensions: ['md']  },
        { name: 'JSON',     extensions: ['json'] },
      ],
    });
    if (canceled || !filePath) return { ok: false };
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      return { ok: true, filePath };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('get-theme', () => {
    return { dark: nativeTheme.shouldUseDarkColors };
  });

  // Key names for labels: ⌘ ⌥ ⌃ on a Mac, Ctrl Alt on Windows.
  ipcMain.handle('get-platform', () => keysFor(process.platform));

  // ── Tool checks (setup wizard + Settings) ──

  ipcMain.handle('check-claude', async () => {
    const resolvedPath = claudePath || await resolveClaudePath(config.read().claudePath);
    if (!resolvedPath) {
      return { found: false, path: null, version: null, working: false, error: 'Claude CLI not found', authError: false };
    }
    claudePath = resolvedPath;

    const version = await evalClaude.version();

    const test = await evalClaude.run('respond with only the word READY', { timeoutMs: 15000, slowWarningMs: 0 });
    const working = test.success && test.prompt.toLowerCase().includes('ready');
    const authError = test.errorType === 'auth';
    let error = null;
    if (!working) {
      if (test.timedOut) error = 'Claude is not responding (timed out after 15s)';
      else if (authError) error = 'Claude is not logged in — run: claude login';
      else error = test.error || 'Claude CLI returned an error';
    }
    return { found: true, path: resolvedPath, version, working, error, authError };
  });

  ipcMain.handle('check-whisper', async () => {
    const engine = whisper.engine();
    if (engine?.type === 'bundled') return { found: true, path: engine.cli, builtIn: true, error: null };
    const resolvedPath = whisperPath || await resolveWhisperPath(config.read().whisperPath);
    if (!resolvedPath) {
      return { found: false, path: null, error: 'Whisper not found — install via: pip install openai-whisper' };
    }
    const [cmd, args] = whisperCommand(resolvedPath, ['--help']);
    try {
      await new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: 10000 }, (err) => { err ? reject(err) : resolve(); });
      });
      return { found: true, path: resolvedPath, error: null };
    } catch (err) {
      return { found: false, path: resolvedPath, error: err.message || 'Whisper failed to run' };
    }
  });

  ipcMain.handle('check-ffmpeg', async () => {
    // The built-in engine reads WAV directly; ffmpeg only matters for the Python fallback.
    if (whisper.engine()?.type === 'bundled') return { found: true, path: null, builtIn: true, error: null };
    const resolvedPath = await resolveFfmpegPath(config.read().ffmpegPath);
    if (!resolvedPath) {
      return { found: false, path: null, error: 'ffmpeg not found — install via: brew install ffmpeg' };
    }
    try {
      await new Promise((resolve, reject) => {
        execFile(resolvedPath, ['-version'], { timeout: 5000 }, (err) => { err ? reject(err) : resolve(); });
      });
      return { found: true, path: resolvedPath, error: null };
    } catch (err) {
      return { found: false, path: resolvedPath, error: err.message || 'ffmpeg failed to run' };
    }
  });

  ipcMain.handle('check-whisper-model', () => {
    const engine = whisper.engine();
    if (engine?.type === 'bundled') {
      return { downloaded: true, path: engine.model, sizeMB: Math.round(fs.statSync(engine.model).size / 1048576), builtIn: true };
    }
    const model = findDownloadedModel();
    return model ? { downloaded: true, ...model } : { downloaded: false, path: null, sizeMB: null };
  });

  ipcMain.handle('download-whisper-model', async () => {
    if (!whisperPath) return { success: false, error: 'Whisper not found — install Whisper first' };
    return whisper.downloadModel((progress) => winSend('whisper-download-progress', progress));
  });

  // ── Settings ──

  ipcMain.handle('get-stored-paths', () => {
    const stored = config.read();
    return {
      claudePath: claudePath || stored.claudePath || '',
      whisperPath: whisperPath || stored.whisperPath || '',
      ffmpegPath: ffmpegPath || stored.ffmpegPath || '',
      claudeModel: claudeModel(),
      modelOptions: MODEL_OPTIONS,
      // With the built-in engine, the Whisper and ffmpeg paths are only a fallback.
      speechBuiltIn: whisper.engine()?.type === 'bundled',
    };
  });

  // A path is only saved if it's a program that exists; every later call runs it. An empty box
  // clears the saved path, so the next check finds the tool again on its own.
  ipcMain.handle('save-paths', async (event, { claudePath: cp, whisperPath: wp, ffmpegPath: fp, claudeModel: model } = {}) => {
    if (!fromWindow(event, win, splashWin)) return { ok: false, error: 'Not allowed' };
    const patch = {};
    const bad = [];
    const take = (value, key, name, set) => {
      if (typeof value !== 'string') return;
      const p = value.trim();
      if (!p) { patch[key] = undefined; set(null); return; }
      if (!isExecutable(p)) { bad.push(name); return; }
      patch[key] = p; set(p);
    };
    take(cp, 'claudePath', 'Claude CLI', (p) => { claudePath = p; });
    take(wp, 'whisperPath', 'Whisper', (p) => { whisperPath = p; });
    take(fp, 'ffmpegPath', 'ffmpeg', (p) => { ffmpegPath = p; });
    if (model && MODEL_OPTIONS.some((m) => m.value === model)) patch.claudeModel = model;
    config.update(patch);
    // A cleared path is found again straight away, as at startup.
    if ('claudePath' in patch && !patch.claudePath) claudePath = await resolveClaudePath(undefined);
    if ('whisperPath' in patch && !patch.whisperPath) whisperPath = await resolveWhisperPath(undefined);
    if ('ffmpegPath' in patch && !patch.ffmpegPath) ffmpegPath = await resolveFfmpegPath(undefined);
    return bad.length ? { ok: false, error: `${bad.join(', ')}: not a program at that path` } : { ok: true };
  });

  ipcMain.handle('browse-for-binary', async () => {
    const target = (splashWin && !splashWin.isDestroyed()) ? splashWin : win;
    const { canceled, filePaths } = await dialog.showOpenDialog(target, {
      properties: ['openFile'],
      message: 'Select the binary file',
    });
    if (canceled || !filePaths.length) return { path: null };
    return { path: filePaths[0] };
  });

  ipcMain.handle('recheck-paths', async () => {
    await resolveAllPaths();
    return {
      claude: { ok: !!claudePath, path: claudePath },
      whisper: { ok: !!whisper.engine(), path: whisper.engine()?.type === 'bundled' ? 'Built in' : whisperPath },
      ffmpeg: { ok: !!ffmpegPath || whisper.engine()?.type === 'bundled', path: ffmpegPath },
    };
  });

  // ── Menu bar state ──

  ipcMain.handle('update-menubar-state', (_event, appState) => {
    const wasRecording = currentAppState === 'RECORDING' || currentAppState === 'PAUSED';
    if (wasRecording && appState !== 'RECORDING' && appState !== 'PAUSED') hotkeyRecordingLive = false;
    if (appState !== currentAppState && (appState === 'RECORDING' || currentAppState === 'RECORDING')) {
      log.info(`Recording: ${currentAppState} → ${appState}${pillSession ? ' (pill)' : ''}`);
    }
    currentAppState = appState;
    // Each recording judges the speaker's volume afresh (pausing and resuming carries on).
    if (appState !== 'RECORDING' && appState !== 'PAUSED') {
      if (quietDetector.isQuiet()) sendMicQuiet(false);
      quietDetector.reset();
    }
    // The renderer has reported where it is, so the "recording is starting" grace period is over.
    recordRequestedAt = 0;
    // While recording, the (usually hidden) bar measures the mic level for the pill. Chromium
    // throttles timers in hidden windows to about once a second, which made the waveform stutter;
    // lift that only while recording.
    if (win && !win.isDestroyed()) win.webContents.setBackgroundThrottling(!(appState === 'RECORDING' || appState === 'PAUSED'));
    updatePill(appState);
    updatePauseShortcut(appState);
    updateMenuBarIcon(MENU_BAR_ICON_STATE[appState] || 'idle');
  });

  ipcMain.handle('set-last-prompt', (_event, prompt) => {
    lastGeneratedPrompt = prompt || null;
    // Dictation Promptly just typed for you isn't copied again: your clipboard is being restored.
    if (prompt && prompt === lastTypedText) { lastTypedText = null; return; }
    if (prompt && config.read().autoCopy !== false) clipboard.writeText(prompt);
  });

  // Dragging the pill: pill.html sends how far the pointer has moved since it was pressed.
  let pillDragOrigin = null;
  ipcMain.on('pill-drag', (_event, { phase, dx = 0, dy = 0 } = {}) => {
    if (!pillWin || pillWin.isDestroyed()) return;
    if (phase === 'start') pillDragOrigin = pillWin.getPosition();
    else if (phase === 'move' && pillDragOrigin) pillWin.setPosition(Math.round(pillDragOrigin[0] + dx), Math.round(pillDragOrigin[1] + dy));
    else if (phase === 'end' && pillDragOrigin) { pillDragOrigin = null; savePillPosition(); }
  });

  // The pointer is over the pill: take the mouse (drag, click) or let it pass through again.
  ipcMain.handle('pill-hover', (_event, inside) => {
    pillHovered = !!inside;
    if (pillWin && !pillWin.isDestroyed()) {
      if (pillHovered) pillWin.setIgnoreMouseEvents(false);
      else pillWin.setIgnoreMouseEvents(true, { forward: true });
    }
    return { ok: true };
  });

  // The pill's "Make it a prompt" after a dictation: open the window and convert it there.
  ipcMain.handle('pill-action', (_event, action) => {
    if (action === 'open') {
      hidePillSoon(0);
      pillSend({ state: 'hidden' });
      showWindow();
      return { ok: true };
    }
    if (action === 'cancel') {
      cancelFromHotkey();
      return { ok: true };
    }
    if (action !== 'make-prompt') return { ok: false };
    lastDictation = null;
    hidePillSoon(0);
    pillSend({ state: 'hidden' });
    showWindow();
    winSend('make-prompt');
    return { ok: true };
  });

  // Windows last: every IPC handler above is registered before a page can call one. (The
  // window used to be created first, and requests it made while setup was being checked
  // failed silently — the shortcut hint, the prompt style and more fell back to defaults.)
  createWindow();
  createPillWindow();
  helper.start();
  // Returning users go straight to the window; setup only appears when something is missing.
  if (await needsSetup()) {
    createSplashWindow();
  } else if (win.webContents.isLoading()) {
    // The setup check can outlast the page load, so only wait if it's still loading.
    win.webContents.once('did-finish-load', () => finishSetup());
  } else {
    finishSetup();
  }
  // Compile the GPU speech shaders in the background so the first recording doesn't wait.
  whisper.warmUp(audioTmpDir)
    .then((gpu) => log.info(`Speech engine warm-up: ${gpu ? 'GPU ready' : 'using CPU'}`))
    .catch((err) => log.warn('Speech engine warm-up failed', err));
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || !menuBarTray) {
    app.quit();
  }
});

app.on('activate', () => showWindow());
