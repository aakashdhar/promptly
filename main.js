'use strict';

const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Menu, Tray, nativeImage, nativeTheme, shell, dialog, session, screen, Notification, systemPreferences, safeStorage } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFile, spawn } = require('child_process');

const { createConfigStore } = require('./main/config');
const { createLogger } = require('./main/log');
const platform = require('./main/platform');
const { resolveClaudePath, resolveWhisperPath, resolveFfmpegPath } = require('./main/binaries');
const { DEFAULT_MODEL, RETIRED_DEFAULTS, createClaudeRunner, createAiRouter, createClaudeReadiness, parseJsonOutput } = require('./main/llm');
const { createApiRunner, listModels } = require('./main/ai-api');
const { PROVIDERS, PROVIDER_IDS, pickModels } = require('./main/ai-providers');
const { createSecrets } = require('./main/secrets');
const { createWhisperRunner, findDownloadedModel, whisperCommand } = require('./main/whisper');
const { createSpeechModels, SPEECH_LANGUAGES } = require('./main/speech-models');
const { createQuietDetector } = require('./main/audio-level');
const claudeSetup = require('./main/claude-setup');
const { registerRecordingShortcut } = require('./main/shortcuts');
const { createHelper } = require('./main/helper');
const { HOTKEY_PRESETS, DEFAULT_HOTKEY, getPreset, hotkeyWords, createHoldToTalk } = require('./main/hotkey');
const { destinationFor, buildDictationCleanupPrompt, countryFromLocale } = require('./main/prompts');
const { createProjectService } = require('./main/projects/service');
const { MODES, getMode, resolveModeKey, buildModePrompt, buildRevisePrompt, buildBuilderPrompt, buildEvalPrompt, normalizeEval, buildLearnStylePrompt, buildLearnFromEditPrompt, buildContextBlock, DETAIL_LEVELS, PROMPT_TARGETS, buildRetargetPrompt, loadPrompt } = require('./main/prompts');
const { createEditLog, profileFor, cleanNotes, formatEdits, newRules, appendRules, removeRules } = require('./main/profile');
const { tidyDictation, acceptCleanup } = require('./main/dictation');
const { parseWords, serializeWords, hintWords, applyCorrections, suggestCorrections } = require('./main/words');
const harness = require('./main/harness');
const { createScheduler } = require('./main/platform/scheduler');
const { drawMicIconPng, isTemplateState, drawWinTrayIcons } = require('./main/tray-icon');
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

function windowTheme() {
  return { dark: nativeTheme.shouldUseDarkColors, background: windowBackground() };
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
let launchWin = null;           // the launch splash (launch.html), up while Promptly starts
let launchDone = null;          // its exit, once started
let isQuitting = false;
let menuBarTray = null;
let pulseInterval = null;
// The green "ready" dot means "just finished", not "busy": it shows for a few seconds when a
// result arrives, then the icon rests without a dot until the next result.
const READY_DOT_MS = 3000;
let readyDotTimer = null;
let readyDotShown = false;
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
let lastPasteRefusal = null;    // why the helper couldn't paste ('elevated': the app runs as administrator)
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

// ── Who answers: Claude Code by default, the user's own API key otherwise (D-AI-PROVIDERS) ──

// Tests never touch the real Keychain, and send API calls to a local stand-in server.
const e2eSafeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from(`e2e:${s}`),
  decryptString: (b) => Buffer.from(b).toString().replace(/^e2e:/, ''),
};
const secrets = createSecrets({ safeStorage: IS_E2E ? e2eSafeStorage : safeStorage });
const aiFetch = IS_E2E && process.env.PROMPTLY_AI_BASE_URL
  ? (url, opts) => globalThis.fetch(String(url).replace(/^https:\/\/[^/]+(\/v1beta\/openai|\/v1)/, process.env.PROMPTLY_AI_BASE_URL), opts)
  : undefined;
// The saved key for the chosen provider, decrypted only when a call needs it; null without one.
function apiSettings() {
  const stored = config.read();
  const provider = stored.apiProvider;
  if (!provider || !PROVIDERS[provider]) return null;
  const key = secrets.decrypt(stored.apiKeys?.[provider]);
  if (!key) return null;
  const { model = '', fastModel = '' } = stored.apiModels?.[provider] || {};
  return { provider, key, model, fastModel };
}
const hasApiKey = () => !!apiSettings();
const aiMode = () => (['auto', 'claude', 'api'].includes(config.read().aiMode) ? config.read().aiMode : 'auto');
// Claude Code is ready when it's installed and signed in (createClaudeReadiness in main/llm.js).
// Without a saved key none of this matters: the router always picks Claude Code.
const claudeReadiness = createClaudeReadiness({
  getClaudePath: () => claudePath,
  setClaudePath: (p) => { claudePath = p; },
  resolvePath: () => resolveClaudePath(config.read().claudePath),
  getStatus: (p) => claudeSetup.getClaudeStatus(p),
});
const isClaudeReady = claudeReadiness.isReady;
const noteClaudeStatus = claudeReadiness.note;
const routerOptions = {
  getMode: aiMode,
  isClaudeReady,
  hasKey: hasApiKey,
  onClaudeUnavailable: claudeReadiness.unavailable,
  // While the key is answering in Automatic, look at Claude Code again in the background (never
  // holding up the call), so it takes over again once it's ready. "My API key" means the key.
  onApiRoute: () => { if (aiMode() === 'auto') claudeReadiness.recheckIfStale(); },
};

// Claude and Whisper processes behind the current operation, so an abort can stop them.
const activeChildren = new Set();
const claudeCli = createClaudeRunner({
  getClaudePath: () => claudePath,
  getModel: claudeModel,
  onSlow: () => winSend('generation-slow-warning'),
  children: activeChildren,
});
const apiMain = createApiRunner({ getSettings: apiSettings, fetchImpl: aiFetch });
const claude = createAiRouter({ claude: claudeCli, api: apiMain, ...routerOptions });
// The eval scorecard runs alongside the prompt screen; aborting a new prompt must not kill it.
const evalCli = createClaudeRunner({
  getClaudePath: () => claudePath,
  getModel: claudeModel,
});
const evalClaude = createAiRouter({ claude: evalCli, api: createApiRunner({ getSettings: apiSettings, fetchImpl: aiFetch }), ...routerOptions });
// Dictation clean-up (D-DICTATION-CLEANUP) always uses Sonnet, whatever model Craft uses: in
// tests Haiku couldn't rebuild misheard Indian names ("super nah" → Supranaah; Sonnet: Suparna)
// and was only about a second faster. Its processes count as the current operation, so a cancel
// stops them too.
const DICTATION_CLEANUP_MODEL = 'sonnet';
const DICTATION_CLEANUP_TIMEOUT_MS = 12000;
const cleanupCli = createClaudeRunner({
  getClaudePath: () => claudePath,
  getModel: () => DICTATION_CLEANUP_MODEL,
  children: activeChildren,
});
// On a key it uses the provider's fast model; it shares the main API runner, so a cancel stops it.
const cleanupClaude = createAiRouter({ claude: cleanupCli, api: apiMain, apiOptions: { fast: true }, ...routerOptions });

// Project modes (D-PROJECT-MODES): connected folders, their summaries and search. Summaries are
// written by whoever answers prompts (Claude Code, or the user's own key).
const projects = createProjectService({
  config,
  userData: app.getPath('userData'),
  run: (prompt, opts) => claude.run(prompt, opts),
  log,
  // Named here so the IPC contract test sees every event the service can send.
  emit: (channel, payload) => {
    if (channel === 'project-progress') winSend('project-progress', payload);
    else if (channel === 'projects-changed') winSend('projects-changed');
  },
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
  // Tests on Windows name their fake engine (a .cmd launcher, not whisper-cli.exe) with PROMPTLY_WHISPER_CLI.
  ...(IS_E2E && process.env.PROMPTLY_WHISPER_CLI && { bundledCli: process.env.PROMPTLY_WHISPER_CLI }),
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

// ── Learning from your edits (D-AUTO-LEARN) ──
// An edit to a result teaches Promptly as it happens: a correction made the same way in two
// edits goes into Your words, and an edit to an Email or Polish result can add up to two lines
// to "How you write". Each change is announced in the window with an Undo; Settings › You has
// the switch ("Learn from my edits").
const learned = new Map();   // notice id → what its Undo takes back
let learnSeq = 0;

function announceLearned(kind, text, undo) {
  const id = ++learnSeq;
  learned.set(id, undo);
  if (learned.size > 20) learned.delete(learned.keys().next().value);
  winSend('learned', { id, kind, text });
  log.info(`Learned from an edit (${kind})`);
}

async function learnFromEdit({ mode, before, after }) {
  if (config.read().autoLearn === false) return;
  const stored = config.read();
  for (const s of suggestCorrections(editLog.list(), parseWords(stored.dictionary), stored.dismissedWords || [])) {
    const words = parseWords(config.read().dictionary);
    if (words.corrections.some((c) => c.from.toLowerCase() === s.from.toLowerCase())) continue;
    config.update({ dictionary: serializeWords({ words: words.words, corrections: [...words.corrections, { from: s.from, to: s.to }] }) });
    announceLearned('word', `${s.from} → ${s.to}`, { kind: 'word', from: s.from });
  }
  if (getMode(mode).profile !== 'voice') return;
  const result = await claude.run(buildLearnFromEditPrompt({ current: cleanNotes(stored.voiceNotes), before, after }), { timeoutMs: 60000 });
  if (!result.success) { log.warn('Learning from an edit: no answer', { errorType: result.errorType }); return; }
  // Read again: the notes may have changed (or learning been switched off) while Claude worked.
  const now = config.read();
  if (now.autoLearn === false) return;
  const rules = newRules(result.prompt, now.voiceNotes);
  const next = rules.length ? appendRules(now.voiceNotes, rules) : null;
  if (next === null) return;
  config.update({ voiceNotes: next });
  announceLearned('style', rules.join(' · '), { kind: 'style', rules });
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
  return { typeIn: stored.dictationTypeIn !== false, removeFillers: stored.dictationRemoveFillers !== false, symbols: stored.dictationSymbols !== false, cleanup: stored.dictationCleanup !== false };
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
  lastPasteRefusal = reply && !reply.ok ? reply.reason || null : null;
  if (!reply || !reply.ok) { restoreClipboard(saved); return false; }
  lastTypedText = text;
  // The target app reads the clipboard when it handles ⌘V; give it a moment first.
  setTimeout(() => { if (clipboard.readText() === text) restoreClipboard(saved); }, 700);
  return true;
}

// Claude fixes misheard words and punctuation. Its answer is used only if acceptCleanup() finds it's
// the same text with a few fixes; otherwise, or when Claude is missing, slow or signed out, the
// local text is typed as before.
async function cleanUpDictation(text) {
  if (cleanupClaude.active() === 'claude' && !claudePath) return { text, outcome: 'no Claude' };
  const started = Date.now();
  const country = countryFromLocale(app.getSystemLocale?.());
  const result = await cleanupClaude.run(buildDictationCleanupPrompt(text, dictionaryWords(), { country }), { timeoutMs: DICTATION_CLEANUP_TIMEOUT_MS, slowWarningMs: 0, thinking: false });
  const ms = Date.now() - started;
  if (result.cancelled) return { cancelled: true };
  if (!result.success) return { text, outcome: `skipped (${result.errorType || 'error'}, ${ms} ms)` };
  const cleaned = acceptCleanup(text, result.prompt);
  if (!cleaned) return { text, outcome: `rejected (${ms} ms)` };
  return { text: cleaned, outcome: `${cleaned === text ? 'unchanged' : 'fixed'} (${ms} ms)` };
}

async function runDictation(transcript) {
  const prefs = dictationPrefs();
  const tidied = tidyDictation(transcript, { removeFillers: prefs.removeFillers, symbols: prefs.symbols });
  const { removed } = tidied;
  let { text } = tidied;
  if (!text) return { success: false, error: "Didn't catch anything", errorType: 'empty' };
  if (prefs.cleanup) {
    const cleaned = await cleanUpDictation(text);
    if (cleaned.cancelled) return { success: false, error: 'Cancelled', errorType: 'cancelled', cancelled: true };
    log.info(`Dictation clean-up: ${cleaned.outcome}`);
    text = cleaned.text;
  }
  const typed = pillSession && prefs.typeIn ? await typeIntoApp(text) : false;
  if (pillSession) lastDictation = { text, typed, refused: typed ? null : lastPasteRefusal };
  // Where the words went (never the words themselves), so "nothing was typed" can be traced.
  log.info(`Dictation: ${!pillSession ? 'shown in the window' : typed ? 'typed into the app in front' : !prefs.typeIn ? 'left on the clipboard (typing is off)' : `not typed (${lastPasteRefusal || 'no helper or Accessibility'}), left on the clipboard`}`);
  return { success: true, prompt: text, dictation: { removed, typed } };
}

// A request in a project mode: the project's context goes in front of the request, then the
// Email, Prompt or Polish prompt runs as usual. On Claude Code, Look deeper lets Claude open more
// of the project's files (read-only, in Promptly's text copy) when the material isn't enough.
async function runProjectPrompt(transcript, options) {
  const req = options.project;
  const exclude = Array.isArray(req.exclude) ? req.exclude.slice(0, 500).map(String) : [];
  // Iterate looks things up with what was first asked, not with "make it shorter".
  const lookup = options.revise && options.revise.transcript ? String(options.revise.transcript) : transcript;
  const prep = await projects.prepare({ id: String(req.id), transcript: lookup, output: req.output || (options.revise && options.revise.output), exclude });
  if (prep.error) return { success: false, error: prep.error, errorType: 'project' };
  const modeConf = getMode(prep.output);
  const stored = config.read();
  const context = {
    ...(options.context || {}),
    ...profileFor(modeConf, stored),
    dictionary: dictionaryWords(),
    otherLanguages: (accurateSpeech()?.language || 'en') !== 'en',
    project: prep.block,
  };
  // Iterate sends the current result and the spoken change, as in any other mode.
  const prompt = options.revise
    ? buildRevisePrompt({ modeKey: prep.output, ...options.revise, instruction: transcript, tone: options.tone, context })
    : buildModePrompt(transcript, prep.output, { ...options, detail: stored.promptDetail, context });
  const throttled = prep.output !== 'email' ? throttledDelta(80) : null;
  // Look deeper clears the shown text when Claude opens a file; that reset must never be throttled away.
  const onDelta = throttled ? (text) => (text === '' ? winSend('generation-delta', { text: '' }) : throttled(text)) : undefined;
  const meta = { project: prep.project, output: prep.output };
  const started = Date.now();
  let sources = prep.sources;
  let result = null;
  if (prep.lookDeeper && claude.active() === 'claude' && claudePath) {
    const opened = [];
    result = await claudeCli.run(prompt + loadPrompt('project-look-deeper'), {
      onDelta, tools: ['Read', 'Grep', 'Glob'], cwd: prep.textDir, maxTurns: 12,
      onTool: ({ name, input }) => {
        const rel = name === 'Read' ? projects.relFromCache(prep.project.id, input && input.file_path) : null;
        if (rel && !exclude.includes(rel)) opened.push(rel);
      },
    });
    if (result.success) {
      const seen = new Set(sources.map((s) => s.rel));
      for (const rel of opened) if (!seen.has(rel)) { seen.add(rel); sources = [...sources, { rel, date: projects.dateOf(prep.project.id, rel) }]; }
    } else if (!result.cancelled) {
      log.warn(`Look deeper failed (${result.errorType || 'error'}); asking without it`);
      if (onDelta) winSend('generation-delta', { text: '' });
      result = null;
    }
  }
  if (!result) result = await claude.run(prompt, { onDelta });
  if (!result.success && !result.cancelled) log.warn(`Project ${prep.output} failed: ${result.errorType || 'error'} after ${Date.now() - started} ms`);
  return { ...result, ...meta, sources };
}

async function runGeneratePrompt({ transcript, mode, options = {} }) {
  // A project mode ("project:<id>") from any of the window's generate calls, or an explicit
  // project option (Write as, leaving a file out, the Dictation suggestion).
  if (String(mode || '').startsWith('project:')) options = { ...options, project: { ...(options.project || {}), id: String(mode).slice(8) } };
  if (options.project && options.project.id) return runProjectPrompt(transcript, options);
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
  const started = Date.now();
  const result = await claude.run(prompt, { onDelta });
  // Why it failed and how long it ran (never the words), so a "Couldn't write the prompt" can be traced.
  if (!result.success && !result.cancelled) log.warn(`Craft (${modeConf.key}) failed: ${result.errorType || 'error'} after ${Date.now() - started} ms`);
  return result;
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
  if (!platform.TRAY_TEMPLATE_ICONS) {
    const img = nativeImage.createEmpty();
    for (const r of drawWinTrayIcons(state, showDot).representations) {
      img.addRepresentation({ scaleFactor: r.scaleFactor, width: r.width, height: r.height, buffer: r.buffer });
    }
    return img;
  }
  const img = nativeImage.createFromBuffer(drawMicIconPng(state, isDark, showDot), { scaleFactor: 2.0 });
  if (isTemplateState(state)) img.setTemplateImage(true);
  return img;
}

let trayIconsCreated = 0;
// When the window last lost focus. On Windows the tray click itself takes focus away, so a
// window that lost it just before the click was the one in front.
let winBlurredAt = 0;
const TRAY_BLUR_MS = 300;

function createMenuBarIcon() {
  trayIconsCreated++;
  menuBarTray = new Tray(createMicIcon('idle'));
  menuBarTray.setToolTip('Promptly — ready');
  menuBarTray.on('click', () => {
    if (!win || win.isDestroyed()) return;
    const inFront = win.isFocused() || (platform.TRAY_CLICK_BLURS && Date.now() - winBlurredAt < TRAY_BLUR_MS);
    if (win.isVisible() && inFront) win.hide(); else showWindow();
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
  clearTimeout(readyDotTimer);
  readyDotTimer = null;
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
  } else if (iconState === 'ready' && readyDotShown) {
    menuBarTray.setImage(createMicIcon('idle', isDark));
  } else {
    menuBarTray.setImage(createMicIcon(iconState, isDark));
    if (iconState === 'ready') {
      readyDotTimer = setTimeout(() => {
        readyDotTimer = null;
        readyDotShown = true;
        refreshMenuBarIcon();
      }, READY_DOT_MS);
    }
  }
}

// Harness schedules: launchd on a Mac, Task Scheduler on Windows (main/platform/scheduler.js).
// Tests keep their launchd jobs inside the throwaway profile and never load or register one.
let harnessSchedulerInstance = null;
function harnessScheduler() {
  if (!harnessSchedulerInstance) {
    harnessSchedulerInstance = createScheduler({
      kind: platform.HARNESS_SCHEDULER,
      agentsDir: IS_E2E ? path.join(app.getPath('userData'), 'LaunchAgents') : platform.launchAgentsDir(os.homedir()),
      dryRun: IS_E2E,
    });
  }
  return harnessSchedulerInstance;
}

async function handleUninstall() {
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Cancel', 'Uninstall'],
    defaultId: 0,
    cancelId: 0,
    title: 'Uninstall Promptly',
    message: 'Uninstall Promptly?',
    detail: platform.UNINSTALL_TEXT.detail,
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
  const scheduler = harnessScheduler();
  for (const { label } of await scheduler.list()) {
    const stopped = await scheduler.remove(label);
    if (!stopped.ok) log.warn('Uninstall: could not stop harness schedule', { label, error: stopped.error });
  }
  const bundle = app.isPackaged ? platform.appBundlePath(app.getPath('exe')) : null;
  const source = app.isPackaged ? platform.uninstallScriptPath(process.resourcesPath) : path.join(__dirname, 'scripts', 'uninstall.sh');
  try {
    const [cmd, args] = platform.uninstallLaunch({
      source,
      tmpDir: os.tmpdir(),
      pid: process.pid,
      bundlePath: bundle,
      dataPaths: platform.uninstallDataPaths(os.homedir(), BUNDLE_ID),
    });
    spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    log.info('Uninstall handed to the uninstall script', { bundle });
  } catch (err) {
    log.error('Uninstall script could not start', err);
    await dialog.showMessageBox({
      type: 'warning',
      title: 'Uninstall Promptly',
      message: "Promptly couldn't start its uninstaller",
      detail: platform.UNINSTALL_TEXT.fallback,
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
        // A short green flash confirms the copy, even after the result's own dot has gone.
        readyDotShown = false;
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
  // Asked for the window (Dock, second launch) while the launch splash is still playing.
  if (launchWin && !launchWin.isDestroyed()) { launchWin.destroy(); launchWin = null; }
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
  const otherAppInFront = !!(ctx && ctx.app && ctx.app.bundleId !== BUNDLE_ID && !String(ctx.app.bundleId || '').startsWith('com.github.Electron'));
  // The window can still count as focused while another app is in front (the Promptly window was
  // open behind Claude, and the words stayed in Promptly). The helper knows which app is really
  // in front: if it isn't Promptly, the words go to that app, through the pill.
  if (otherAppInFront && !pillSession && hotkeyRecordingLive) {
    pillSession = true;
    pillSend({ state: 'recording', mode: currentModeLabel });
  }
  if (otherAppInFront) {
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

// Hold-to-talk latency, key down → recording (Windows target: under 150 ms). The Windows helper
// stamps hotkey events with `t` on its own clock; the smallest arrival-minus-t seen since it
// (re)started maps that clock onto ours. The Swift helper sends no `t`, so the Mac logs nothing.
let helperClockOffset = null;
let hotkeyDownAt = 0;

function noteHotkeyTime(phase, t) {
  if (typeof t !== 'number') return;
  const lag = Date.now() - t;
  if (helperClockOffset == null || lag < helperClockOffset) helperClockOffset = lag;
  if (phase === 'down') hotkeyDownAt = t + helperClockOffset;
}

function logHotkeyLatency() {
  if (!hotkeyDownAt) return;
  const ms = Date.now() - hotkeyDownAt;
  hotkeyDownAt = 0;
  // A down that didn't start a recording (already recording, a tap) is stale by the next one.
  if (ms < 5000) log.info(`Hotkey latency: ${ms} ms (key down → recording)`);
}

function onHelperHotkey(phase, t) {
  noteHotkeyTime(phase, t);
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
    // A restarted helper's clock starts again from zero.
    helperClockOffset = null;
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
  // To float over full-screen apps, Electron turns Promptly into a background (UIElement) app and
  // is meant to turn it back; on macOS 26 it stays a background app, with no Dock icon and no menu
  // bar of its own. Showing the Dock icon makes it a normal app again and keeps the pill's reach.
  if (process.platform === 'darwin') app.dock?.show().catch(() => {});
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
    pillSend({ state: 'dictated', typed: lastDictation.typed, refused: lastDictation.refused });
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

// The launch splash plays first, and in full: the showreel's words gather into the name while
// the mark draws itself (launch.html). The rest of the app starts once it has finished. It is off
// in end-to-end runs unless a test asks for it, so every other test starts as before.
const LAUNCH_SPLASH = !IS_E2E || process.env.PROMPTLY_LAUNCH_SPLASH === '1';
const LAUNCH_SIZE = { width: 540, height: 360 };  // the 480×300 panel plus room for its shadow
const LAUNCH_INTRO_WAIT_MS = 6000;                // longest start-up waits on the intro
const LAUNCH_EXIT_WAIT_MS = 3500;                 // longest the app waits on the splash's exit
const LAUNCH_MAX_MS = 20000;                      // a start that never finishes still loses it

// Shows the launch splash and plays its intro. Resolves when the intro has finished; at once when
// there is no splash; and within LAUNCH_INTRO_WAIT_MS if the page never starts (it never holds
// the app up for long).
function showLaunchSplash() {
  if (!LAUNCH_SPLASH) return Promise.resolve();
  // On the screen you're using, like the window that follows it.
  const { workArea: wa } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const w = launchWin = new BrowserWindow({
    ...LAUNCH_SIZE,
    x: Math.round(wa.x + (wa.width - LAUNCH_SIZE.width) / 2),
    y: Math.round(wa.y + (wa.height - LAUNCH_SIZE.height) / 2),
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,              // the panel draws its own, inside the window
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,              // never takes focus from the app you were in
    // Above other apps' windows. Promptly stops being the active app for a moment when the pill
    // is set up, and the app you were in then came in front of the splash and hid it (2.20.6).
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false, // its timers must run on time even if it is covered
    },
  });
  w.loadFile(path.join(__dirname, 'launch.html'), { query: { v: app.getVersion() } });
  w.once('ready-to-show', () => { if (!w.isDestroyed()) w.showInactive(); });
  // Hidden, not closed: while it is the only window, closing it would quit the app.
  setTimeout(() => { if (!w.isDestroyed()) w.hide(); }, LAUNCH_MAX_MS);
  return new Promise((resolve) => {
    const giveUp = setTimeout(resolve, LAUNCH_INTRO_WAIT_MS);
    const done = () => { clearTimeout(giveUp); resolve(); };
    // Started from here, once the window is on screen, never from the page's own load: a window
    // that isn't showing yet still reports itself visible, and the intro played to nobody.
    w.once('show', () => {
      w.webContents.executeJavaScript('window.startSplash ? window.startSplash() : null', true).catch(() => {}).then(done);
    });
    w.webContents.once('did-fail-load', done);
    w.once('closed', done);
  });
}

// Plays the launch splash's exit (a beat on its finished frame, then a fade), then resolves.
// Resolves at once when there is no splash, and within LAUNCH_EXIT_WAIT_MS whatever the page does.
function dismissLaunchWindow() {
  if (launchDone) return launchDone;
  const w = launchWin;
  if (!w || w.isDestroyed()) return (launchDone = Promise.resolve());
  const exited = w.webContents.executeJavaScript('window.finishSplash ? window.finishSplash() : null', true).catch(() => {});
  const limit = new Promise((resolve) => setTimeout(resolve, LAUNCH_EXIT_WAIT_MS));
  launchDone = Promise.race([exited, limit]).then(() => {
    if (!w.isDestroyed()) w.destroy();
    if (launchWin === w) launchWin = null;
  });
  return launchDone;
}

// Resolves once the launch splash has closed (at once when there is none).
function whenLaunchGone() {
  const w = launchWin;
  if (!w || w.isDestroyed()) return Promise.resolve();
  return new Promise((resolve) => w.once('closed', resolve));
}

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
    ...platform.windowChrome(windowTheme()),
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
  win.on('blur', () => { winBlurredAt = Date.now(); });
  nativeTheme.on('updated', () => {
    for (const w of [win, splashWin]) {
      if (w && !w.isDestroyed()) w.setBackgroundColor(windowBackground());
    }
    // Windows' caption buttons are drawn in the window's colours, so they follow the theme too.
    const { titleBarOverlay } = platform.windowChrome(windowTheme());
    if (titleBarOverlay && win && !win.isDestroyed()) win.setTitleBarOverlay(titleBarOverlay);
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
  noteClaudeStatus(status);
  // Someone who uses their own API key instead of Claude Code doesn't need Claude Code set up.
  if (aiMode() !== 'claude' && hasApiKey()) return false;
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
  registerShortcut();
  // Runs again after the wizard is reopened from Settings; keep a single tray icon.
  if (!menuBarTray || menuBarTray.isDestroyed()) createMenuBarIcon();
  // The launch splash plays out first (no wait when there is none). windowBounds() already
  // placed the window: where it was left, or centred the first time. Centring here would move
  // it (and save that) on every launch.
  dismissLaunchWindow().then(() => { if (win && !win.isDestroyed()) win.show(); });
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
  // First thing on screen, in the app's theme. Finding Claude Code and speech-to-text and the
  // setup check run while it plays; the windows, the pill and the speech engine wait for its end.
  const intro = showLaunchSplash();
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
    const status = await claudeSetup.getClaudeStatus(claudePath);
    noteClaudeStatus(status);
    return status;
  });

  // What the setup screen says for this system, and anything that stops setup working on it:
  // Git for Windows missing, or an antivirus that quarantined the speech engine or the helper.
  // Wording answers at once; the checks can take seconds (they start the binaries), so they
  // have their own channel and the setup screen never shows the wrong system's words meanwhile.
  ipcMain.handle('setup-info', () => ({ installCommand: claudeSetup.INSTALL_COMMAND, terminal: platform.SETUP_TERMINAL, copy: platform.SETUP_COPY }));

  ipcMain.handle('setup-checks', async () => {
    const [{ gitMissing }, blocked] = await Promise.all([
      platform.checkPrerequisites(),
      platform.blockedBinaries([
        { file: path.join(BUNDLED_WHISPER_DIR, platform.WHISPER_CLI), args: ['--help'] },
        { file: HELPER_PATH, args: ['--version'] },
      ]),
    ]);
    return { gitMissing, blocked };
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
      dictationCleanup: stored.dictationCleanup !== false,
      autoLearn: stored.autoLearn !== false,
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
    if (typeof prefs.dictationCleanup === 'boolean') patch.dictationCleanup = prefs.dictationCleanup;
    if (typeof prefs.autoLearn === 'boolean') patch.autoLearn = prefs.autoLearn;
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

  // Where there's no Accessibility permission (Windows) it reports unavailable, which is what
  // makes setup skip its Accessibility step.
  ipcMain.handle('accessibility-status', async () => {
    const status = await helper.refreshStatus();
    const available = helper.isRunning() && !!platform.PRIVACY_SETTINGS.accessibility;
    return { available, ...(status ? { trusted: !!status.trusted, tap: !!status.tap } : helper.status()) };
  });

  // ── It writes like you ──

  ipcMain.handle('record-edit', (_event, { mode, before, after } = {}) => {
    const recorded = editLog.add({ mode, before, after });
    if (recorded) learnFromEdit({ mode, before, after }).catch((err) => log.warn('Learning from an edit failed', err.message));
    return { recorded, editCount: editLog.count() };
  });

  // Takes back one thing Promptly learned from an edit (the Undo on the window's notice).
  ipcMain.handle('undo-learned', (_event, { id } = {}) => {
    const undo = learned.get(Number(id));
    if (!undo) return { ok: false };
    learned.delete(Number(id));
    const stored = config.read();
    if (undo.kind === 'style') {
      config.update({ voiceNotes: removeRules(stored.voiceNotes, undo.rules) });
    } else {
      const words = parseWords(stored.dictionary);
      config.update({
        dictionary: serializeWords({ words: words.words, corrections: words.corrections.filter((c) => c.from.toLowerCase() !== undo.from.toLowerCase()) }),
        // Not learned again from the same edits.
        dismissedWords: [...(stored.dismissedWords || []), undo.from].slice(-100),
      });
    }
    return { ok: true };
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

  // A finished prompt rewritten for another AI, or for all of them ("standard"). Promptly's own
  // AI does the rewrite (Claude Code, or the user's key), so no key for the target is needed:
  // only the layout and wording change, never what the prompt asks for.
  ipcMain.handle('retarget-prompt', async (_event, { prompt, transcript, mode, target } = {}) => {
    const t = PROMPT_TARGETS.find((x) => x.key === target);
    const m = getMode(mode);
    if (!t || t === PROMPT_TARGETS[0] || !m.promptStyle) return { success: false, error: 'This result can only be shown as written.' };
    const text = String(prompt || '').trim().slice(0, 20000);
    if (!text) return { success: false, error: 'Nothing to rewrite yet' };
    const result = await claude.run(buildRetargetPrompt({ prompt: text, transcript, mode: m, target: t }), { timeoutMs: 120000 });
    if (!result.success) return result;
    const out = result.prompt.trim().replace(/^```[a-z]*\n([\s\S]*?)\n```$/i, '$1').trim();
    return out ? { success: true, prompt: out, target: t.key } : { success: false, error: 'Came back empty. Try again.' };
  });

  ipcMain.handle('open-accessibility-settings', () => {
    if (!platform.PRIVACY_SETTINGS.accessibility) return;
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

  // Asks the system for microphone access (macOS shows its prompt the first time).
  ipcMain.handle('request-microphone', async (_event, { prompt = true } = {}) => {
    if ((process.platform !== 'darwin' && process.platform !== 'win32') || IS_E2E) return { granted: true, status: 'granted' };
    return platform.microphoneAccess(systemPreferences, { prompt });
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

  // ── Project modes ──
  // Folders are always picked here, in main; the window only ever names a project by id.
  const pickFolder = async (title) => {
    if (IS_E2E && process.env.PROMPTLY_PROJECT_DIR) return process.env.PROMPTLY_PROJECT_DIR;
    const picked = await dialog.showOpenDialog(win, { title, properties: ['openDirectory'] });
    return picked.canceled || !picked.filePaths[0] ? null : picked.filePaths[0];
  };
  const projectCall = (fn) => async (event, ...args) => {
    if (!fromWindow(event, win)) return { error: 'Not allowed' };
    try { return await fn(...args); } catch (err) { return { error: err.message }; }
  };
  const PROJECT_PATCH = ['name', 'defaultOutput', 'lookDeeper', 'keepInFolder', 'folders'];
  ipcMain.handle('projects-list', projectCall(() => projects.list()));
  ipcMain.handle('project-connect', projectCall(async () => {
    const dir = await pickFolder('Connect a project folder');
    return dir ? projects.connect(dir) : { cancelled: true };
  }));
  ipcMain.handle('project-classify', projectCall((token) => projects.classify(String(token || ''))));
  ipcMain.handle('project-estimate', projectCall((token, folders) => projects.estimateCalls(String(token || ''), folders && typeof folders === 'object' ? folders : {})));
  ipcMain.handle('project-save', projectCall((fields = {}) => projects.save({
    token: String(fields.token || ''), name: fields.name, role: fields.role, writes: fields.writes, folders: fields.folders, keepInFolder: !!fields.keepInFolder,
  })));
  ipcMain.handle('project-cancel-build', projectCall((id) => projects.cancelBuild(String(id))));
  ipcMain.handle('project-summary-get', projectCall((id) => projects.getSummary(String(id))));
  ipcMain.handle('project-summary-set', projectCall((id, text) => projects.setSummary(String(id), String(text ?? '').slice(0, 200000))));
  ipcMain.handle('project-refresh', projectCall((id) => projects.refresh(String(id))));
  ipcMain.handle('project-rebuild', projectCall((id) => projects.rebuild(String(id))));
  ipcMain.handle('project-update', projectCall((id, patch) => {
    const clean = {};
    for (const key of PROJECT_PATCH) if (patch && key in patch) clean[key] = patch[key];
    return projects.update(String(id), clean);
  }));
  ipcMain.handle('project-remove', projectCall((id, opts) => projects.remove(String(id), { deletePromptlyMd: !!(opts && opts.deletePromptlyMd) })));
  ipcMain.handle('project-locate', projectCall(async (id) => {
    const dir = await pickFolder('Locate the project folder');
    return dir ? projects.locate(String(id), dir) : { cancelled: true };
  }));
  ipcMain.handle('project-folders-get', projectCall((id) => projects.folders(String(id))));
  ipcMain.handle('project-suggest', projectCall((text) => projects.suggest(String(text ?? '').slice(0, 50000))));

  // Image, Video and Workflow: one step of a builder, from its prompt file in main/prompts.
  ipcMain.handle('builder-step', (_event, { step, values } = {}) => {
    const prompt = buildBuilderPrompt(String(step || ''), values || {});
    if (!prompt) return { success: false, error: 'Unknown builder step', errorType: 'unknown' };
    return claude.run(prompt, { timeoutMs: 120000, slowWarningMs: 45000 });
  });

  // ── Harness mode ──

  // The files and run command are kept here, as Claude wrote them. Saving and scheduling use
  // this copy, never what the window sends back, because a schedule runs `run` as a command
  // (bash under launchd, PowerShell under Task Scheduler).
  let lastHarnessFiles = null; // { run, schedule, files } from the last harness-files result
  let lastSavedHarness = null; // { dir, run } from the last Save to project…

  // Harness runs on Claude Code only (D-AI-PROVIDERS): its files and schedules are built for
  // Claude Code, so an API key can't stand in. When prompts go to a key, it says so instead.
  // Only when the person chose their key, or has a key and no Claude Code. Otherwise Harness runs
  // on Claude Code as before, even if an earlier call fell back to the key.
  const harnessNeedsClaude = () => hasApiKey() && (aiMode() === 'api' || !claudePath);
  const harnessNeedsClaudeResult = () => ({
    success: false,
    errorType: 'needs-claude',
    error: aiMode() === 'api'
      ? 'Harness needs Claude Code. Choose Automatic or Claude Code in Settings › AI.'
      : 'Harness needs Claude Code. Set it up in Settings › Setup.',
  });

  ipcMain.handle('harness-plan', async (_event, { transcript, context = {} } = {}) => {
    const stored = config.read();
    const block = buildContextBlock(getMode('harness'), { ...context, ...profileFor(getMode('harness'), stored), dictionary: dictionaryWords() });
    if (harnessNeedsClaude()) return harnessNeedsClaudeResult();
    const result = await claudeCli.run(harness.buildPlanPrompt(String(transcript || ''), block), { timeoutMs: 120000, slowWarningMs: 45000 });
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
    if (harnessNeedsClaude()) return harnessNeedsClaudeResult();
    const result = await claudeCli.run(harness.buildFilesPrompt({ transcript: String(transcript || ''), plan, answers: answers || {} }), { timeoutMs: 300000, slowWarningMs: 90000, onDelta, thinking: false });
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
      const scheduler = harnessScheduler();
      const alreadyScheduled = await scheduler.has(scheduler.labelFor(dir));
      return { ok: true, dir, written, alreadyScheduled };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Runs the harness saved last on a schedule: a launchd job in the user's LaunchAgents on a Mac,
  // a Task Scheduler task on Windows (one per project folder; scheduling again replaces it).
  // Only the folder and command from that save are used, never paths sent by the window.
  ipcMain.handle('schedule-harness', async (event, { schedule } = {}) => {
    if (!fromWindow(event, win)) return { ok: false, error: 'Not allowed' };
    const sched = harness.checkSchedule(schedule);
    if (!lastSavedHarness?.run) return { ok: false, error: 'Save the harness to a project first' };
    if (!sched) return { ok: false, error: 'Pick when it should run' };
    const { dir, run } = lastSavedHarness;
    const scheduler = harnessScheduler();
    const label = scheduler.labelFor(dir);
    const claudeDir = claudePath ? platform.paths.dirname(claudePath) : '';
    const pathEnv = [claudeDir, platform.SCHEDULE_PATH].filter(Boolean).join(platform.PATH_DELIMITER);
    const installed = await scheduler.install({ label, dir, run, schedule: sched, pathEnv });
    if (!installed.ok) return { ok: false, error: installed.refused ? `${scheduler.systemName} didn't accept the schedule: ${installed.error}` : installed.error };
    log.info('Scheduled harness', { dir, label, schedule: sched });
    return { ok: true, label: harness.scheduleLabel(sched) };
  });

  ipcMain.handle('unschedule-harness', async (event) => {
    if (!fromWindow(event, win)) return { ok: false, error: 'Not allowed' };
    if (!lastSavedHarness) return { ok: false, error: 'No saved harness' };
    const scheduler = harnessScheduler();
    const label = scheduler.labelFor(lastSavedHarness.dir);
    const removed = await scheduler.remove(label);
    if (!removed.ok) return { ok: false, error: removed.refused ? `${scheduler.systemName} didn't stop the schedule: ${removed.error}` : removed.error };
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
    // Claude Code needs its path; a saved key doesn't (D-AI-PROVIDERS).
    if ((evalClaude.active() === 'claude' && !claudePath) || !transcript || !prompt) return { success: false };
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

  // ── AI provider (D-AI-PROVIDERS) ──
  // A key goes in once (save-ai-key) and never comes back out: the windows only learn which
  // providers have a key and its last four characters. Keys are never logged.

  function aiSettingsView() {
    const stored = config.read();
    const keys = {};
    for (const id of PROVIDER_IDS) {
      const key = secrets.decrypt(stored.apiKeys?.[id]);
      keys[id] = { saved: !!key, last4: key ? key.slice(-4) : '' };
    }
    return {
      mode: aiMode(),
      provider: PROVIDERS[stored.apiProvider] ? stored.apiProvider : null,
      providers: PROVIDER_IDS.map((id) => ({ id, label: PROVIDERS[id].label, keysUrl: PROVIDERS[id].keysUrl, keyHint: PROVIDERS[id].keyHint })),
      keys,
      models: stored.apiModels || {},
      // Asking macOS whether it can encrypt reads (or creates) a "promptly Safe Storage" Keychain
      // item, so it only happens once a key is stored; save-ai-key checks for real when saving.
      canStoreKeys: Object.values(stored.apiKeys || {}).some(Boolean) ? secrets.available() : true,
      claudeReady: isClaudeReady(),
      active: claude.active(),
    };
  }

  ipcMain.handle('get-ai-settings', () => aiSettingsView());

  // Checks the key by listing the provider's models, then saves it encrypted with the picked models.
  // claudeUnavailable: saved from the setup screen while Claude Code isn't working (missing, signed
  // out, not responding), so the key takes over now instead of after a failed call.
  ipcMain.handle('save-ai-key', async (event, { provider, key, claudeUnavailable = false } = {}) => {
    if (!fromWindow(event, win, splashWin)) return { ok: false, error: 'Not allowed from this window.' };
    if (!PROVIDERS[provider]) return { ok: false, error: 'Unknown AI provider.' };
    const trimmed = String(key || '').trim();
    const check = await listModels(provider, trimmed, { fetchImpl: aiFetch });
    // Here the person is looking at the key they just pasted, so "check it in Settings" won't help.
    if (!check.ok) return { ok: false, error: check.errorType === 'auth' ? `${PROVIDERS[provider].label} refused this key. Check you copied all of it.` : check.error };
    let encrypted;
    try { encrypted = secrets.encrypt(trimmed); } catch (err) { return { ok: false, error: err.message }; }
    const picked = pickModels(check.models, provider);
    const stored = config.read();
    config.update({
      apiProvider: provider,
      apiKeys: { ...(stored.apiKeys || {}), [provider]: encrypted },
      apiModels: { ...(stored.apiModels || {}), [provider]: { model: picked.model, fastModel: picked.fastModel } },
    });
    log.info(`AI key saved for ${PROVIDERS[provider].label}; model ${picked.model}, fast ${picked.fastModel}`);
    if (claudeUnavailable) claudeReadiness.unavailable('broken');
    return { ok: true, models: picked.models, settings: aiSettingsView() };
  });

  ipcMain.handle('remove-ai-key', (event, provider) => {
    if (!fromWindow(event, win, splashWin)) return { ok: false };
    if (!PROVIDERS[provider]) return { ok: false };
    const stored = config.read();
    const apiKeys = { ...(stored.apiKeys || {}) };
    delete apiKeys[provider];
    // Removing the key in use switches to another saved key if there is one; with none left,
    // "My API key" goes back to Automatic (Claude Code).
    const patch = { apiKeys };
    if (stored.apiProvider === provider) {
      const other = PROVIDER_IDS.find((id) => apiKeys[id]);
      if (other) patch.apiProvider = other;
      else if (stored.aiMode === 'api') patch.aiMode = 'auto';
    }
    config.update(patch);
    log.info(`AI key removed for ${PROVIDERS[provider].label}`);
    return { ok: true, settings: aiSettingsView() };
  });

  ipcMain.handle('set-ai-settings', (event, { mode, provider, model, fastModel } = {}) => {
    if (!fromWindow(event, win, splashWin)) return aiSettingsView();
    const stored = config.read();
    const patch = {};
    // "My API key" only makes sense with a key saved; without one it would send every call nowhere.
    if (['auto', 'claude'].includes(mode) || (mode === 'api' && hasApiKey())) patch.aiMode = mode;
    // The provider in use is always one with a saved key (saving a key makes it the one in use).
    if (PROVIDERS[provider] && stored.apiKeys?.[provider]) patch.apiProvider = provider;
    const target = patch.apiProvider || stored.apiProvider;
    if (PROVIDERS[target] && (typeof model === 'string' || typeof fastModel === 'string')) {
      const current = stored.apiModels?.[target] || {};
      patch.apiModels = { ...(stored.apiModels || {}), [target]: { ...current, ...(typeof model === 'string' && { model }), ...(typeof fastModel === 'string' && { fastModel }) } };
    }
    if (Object.keys(patch).length) config.update(patch);
    return aiSettingsView();
  });

  // The chat models the saved key can use, best first.
  ipcMain.handle('list-ai-models', async (_event, provider) => {
    if (!PROVIDERS[provider]) return { ok: false, models: [], error: 'Unknown AI provider.' };
    const key = secrets.decrypt(config.read().apiKeys?.[provider]);
    if (!key) return { ok: false, models: [], error: `No ${PROVIDERS[provider].label} key saved.` };
    const check = await listModels(provider, key, { fetchImpl: aiFetch });
    return check.ok ? { ok: true, models: pickModels(check.models, provider).models } : { ok: false, models: [], error: check.error };
  });

  // A tiny request to whoever answers prompts now: Claude Code or the saved key.
  ipcMain.handle('test-ai', async () => {
    const started = Date.now();
    const result = await evalClaude.run('respond with only the word READY', { timeoutMs: 20000, slowWarningMs: 0 });
    const ok = !!result.success && /ready/i.test(result.prompt || '');
    const who = result.provider === 'claude' ? 'Claude Code' : PROVIDERS[result.provider]?.label || 'AI';
    return { ok, provider: who, model: result.model || null, ms: Date.now() - started, error: ok ? null : result.error || `${who} gave an unexpected answer` };
  });

  ipcMain.handle('check-claude', async () => {
    const resolvedPath = claudePath || await resolveClaudePath(config.read().claudePath);
    if (!resolvedPath) {
      return { found: false, path: null, version: null, working: false, error: 'Claude CLI not found', authError: false };
    }
    claudePath = resolvedPath;

    const version = await evalCli.version();

    // This checks Claude Code itself, whichever provider is answering prompts.
    const test = await evalCli.run('respond with only the word READY', { timeoutMs: 15000, slowWarningMs: 0 });
    const working = test.success && test.prompt.toLowerCase().includes('ready');
    const authError = test.errorType === 'auth';
    // A working answer means ready; a sign-in error or a broken CLI means not. A timeout (a cold
    // start can be slow) decides nothing.
    if (working) claudeReadiness.working();
    else if (authError) claudeReadiness.unavailable('auth');
    else if (!test.timedOut) claudeReadiness.unavailable('broken');
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
        execFile(...platform.spawnArgs(cmd, args, { timeout: 10000 }), (err) => { err ? reject(err) : resolve(); });
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
        execFile(...platform.spawnArgs(resolvedPath, ['-version'], { timeout: 5000 }), (err) => { err ? reject(err) : resolve(); });
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
    if (appState === 'RECORDING' && currentAppState !== 'RECORDING') logHotkeyLatency();
    // A new result gets its green dot afresh.
    if (appState === 'PROMPT_READY' && currentAppState !== 'PROMPT_READY') readyDotShown = false;
    currentAppState = appState;
    // Each recording judges the speaker's volume afresh (pausing and resuming carries on).
    if (appState !== 'RECORDING' && appState !== 'PAUSED') {
      // The recording stopped, so the stop watchdog is done; left running, it saw the NEXT
      // recording 10 s later and logged a false "did not stop".
      clearTimeout(stopWatchdog);
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
  const setupNeeded = needsSetup();
  setupNeeded.catch(() => {});     // awaited below, after the intro
  // Setting up the pill makes Promptly give up being the active app for a moment, so nothing
  // that opens a window starts until the intro has played.
  await intro;
  createWindow();
  createPillWindow();
  helper.start();
  projects.start();
  // Returning users go straight to the window; setup only appears when something is missing.
  if (await setupNeeded) {
    dismissLaunchWindow().then(createSplashWindow);
  } else if (win.webContents.isLoading()) {
    // The setup check can outlast the page load, so only wait if it's still loading.
    win.webContents.once('did-finish-load', () => finishSetup());
  } else {
    finishSetup();
  }
  // Compile the GPU speech shaders in the background so the first recording doesn't wait; once
  // the splash has gone, so they can't make it stutter.
  whenLaunchGone()
    .then(() => whisper.warmUp(audioTmpDir))
    .then((gpu) => log.info(`Speech engine warm-up: ${gpu ? 'GPU ready' : 'using CPU'}`))
    .catch((err) => log.warn('Speech engine warm-up failed', err));
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  projects.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || !menuBarTray) {
    app.quit();
  }
});

app.on('activate', () => showWindow());

// Folders on network drives send no change events; a rescan when Promptly comes forward covers them.
app.on('browser-window-focus', () => projects.onFocus());
