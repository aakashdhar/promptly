'use strict';

process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[Promptly] Uncaught exception:', err.message, err.stack);
});

const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Menu, Tray, nativeImage, nativeTheme, shell, dialog, systemPreferences, session, screen } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const { deflateSync } = require('zlib');

const configPath = path.join(app.getPath('userData'), 'config.json');
function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { return {}; }
}
function writeConfig(data) {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

const SHORTCUT_PRIMARY = 'Alt+Space';
const SHORTCUT_FALLBACK = 'Control+`';

const PROMPT_TEMPLATE = `You are an expert Claude prompt engineer. Your job is to transform raw spoken descriptions into precision-engineered Claude prompts that get exceptional results.

Analyse the transcript carefully for:
- Core intent and primary goal
- What the user emphasised or repeated (make this prominent)
- Implied constraints they did not explicitly state
- Expected output format or deliverable
- Technical domain (code, writing, analysis, design, data)

Mode: {MODE_NAME}
Mode instruction: {MODE_INSTRUCTION}

Output rules — follow every rule precisely:
1. Output ONLY the final prompt. No preamble. No "Here is your prompt:". No explanation. Just the prompt itself.
2. Structure every prompt with these exact plain-text section labels on their own line, followed by a colon and newline:

Role:
Task:
Context:
Constraints:
Output format:

3. For technical/code prompts always add:

Tech stack:
Data model: (if data structures are involved)

4. For UI/design prompts always add:

Visual style:

5. What the user stressed or repeated must appear explicitly and prominently in the Task section.
6. Never invent requirements the user did not mention or imply.
7. Be specific enough that Claude cannot misinterpret the task.
8. If the user mentioned a specific format (table, list, code block), preserve it exactly.
9. Write the prompt in second person: "You are...", "Your task is...", "Write..."
10. Section labels must be plain text — no markdown bold, no asterisks, no hashtags.

The user said:
"{TRANSCRIPT}"`;

const MODE_CONFIG = {
  balanced:  { name: 'Balanced',         instruction: 'Create a well-rounded prompt with appropriate detail for general use.' },
  detailed:  { name: 'Detailed',         instruction: 'Create a thorough, comprehensive prompt with extensive context, edge cases, and detailed constraints.' },
  concise:   { name: 'Concise',          instruction: 'Create the shortest possible effective prompt — include only what is essential for Claude to succeed.' },
  chain:     { name: 'Chain of Thought', instruction: 'Structure the prompt to require Claude to reason step-by-step before answering. Include a Steps section with numbered reasoning stages.' },
  code:      { name: 'Code',             instruction: 'Optimise this prompt for code generation. Always include Tech stack and Data model sections. Be precise about interfaces, data shapes, and output format.' },
  refine:    { name: 'Refine',           standalone: true, instruction: `You are an expert design and product feedback analyst. The user has spoken a description of an existing design problem and what they want changed. Your job is to structure their spoken feedback into a precise, actionable Claude prompt that a designer or developer can use immediately to make the exact change needed — with zero ambiguity and zero unnecessary iteration.

Extract from the transcript:
- What currently exists (the element, its appearance, its behaviour)
- What is wrong with it (the specific problem — visual, functional, or both)
- What the desired outcome looks like (what "fixed" means exactly)
- What must NOT change (constraints, unchanged elements, preserved behaviour)
- Any brand, accessibility, or technical constraints mentioned

Output rules:
1. Output ONLY the final prompt. No preamble. No explanation. Just the prompt.
2. Use these exact plain-text section labels on their own line followed by a colon:

Current state:
Problem:
Desired outcome:
Constraints:

3. Current state — describe the existing element precisely. What it looks like, where it sits, what it does. Be specific enough that Claude can identify it without seeing the screen.
4. Problem — explain WHY it is wrong, not just that it is wrong. The visual or functional issue. What feeling or behaviour it creates that it shouldn't.
5. Desired outcome — describe the end result concretely. Not "make it better" — "reduce height from 56px to 40px, switch fill from primary blue to secondary grey, maintain the same label and position."
6. Constraints — list everything that must stay unchanged. If the user didn't mention constraints, infer sensible ones: accessibility contrast ratios, surrounding layout, existing brand colours, label text.
7. If the user mentioned specific values (px, colours, font sizes) preserve them exactly.
8. If the user was vague, make the best specific inference you can and flag it with "(inferred — verify)" at the end of that line.
9. Do not add a Role section. Do not add a Task section. The four sections above are the complete output.

The user said:
"{TRANSCRIPT}"` },
  design:    { name: 'Design',           standalone: true, instruction: `You are a world-class design director and prompt engineer. The user is a designer who has just spoken their creative vision out loud. Your job is to capture that vision with complete fidelity and turn it into a prompt that will make Claude produce exceptional, specific, production-ready design output.

Listen for and extract:
- The emotional tone and personality of the design (what should someone FEEL when they see it)
- The core visual metaphor or aesthetic direction the designer is reaching for
- Any references mentioned — apps, brands, movements, eras, materials
- What they want to AVOID as much as what they want to include
- Typography intent — even if vague ("something sophisticated", "feels editorial")
- Colour intent — even if loose ("warm", "muted", "high contrast", "earthy")
- Layout and spatial intent — how content should breathe and move
- Component behaviour — hover states, transitions, animations they described
- The user they are designing for — context changes everything
- Device and environment — where will this be seen and used

Output rules:
1. Output ONLY the final prompt. No preamble. No explanation.
2. Use these exact plain-text section labels:

Role:
Design brief:
Visual personality:
Colour direction:
Typography direction:
Layout and spacing:
Component behaviour:
Motion and feel:
What to avoid:
Reference points:
User and context:
Output format:

3. Under Design brief — capture the core intent in 2-3 sentences. What is being designed, for whom, and what is the single most important feeling it must create.
4. Under Visual personality — use vivid, specific adjectives. Not "clean" — "restrained, almost terse, like a Swiss grid poster". Not "modern" — "post-Figma minimal, confident negative space, nothing decorative".
5. Under Colour direction — give Claude a starting palette even if approximate. "Warm off-white background, deep forest green primary, no pure black — use #1a1a1a instead".
6. Under What to avoid — this section is mandatory. Every designer has things they hate. Extract them from the transcript. If not explicit, infer from the aesthetic direction.
7. Under Motion and feel — describe the quality of movement, not just what moves. "Transitions should feel unhurried, like turning a page" not just "add transitions".
8. Under Reference points — list every app, brand, website, or aesthetic the designer mentioned. If they said "like Notion but warmer" — write that exactly.
9. The prompt must be specific enough that two different designers reading it would produce similar work.

The user said:
"{TRANSCRIPT}"` },
  image:     { name: 'Image',            passthrough: true, instruction: '' },
  video:     { name: 'Video',            passthrough: true, instruction: '' },
  polish:    { name: 'Polish',           standalone: true, instruction: `You are an expert editor and writing coach. The user has spoken something rough — with filler words, repetition, grammatical errors, or unclear phrasing. Your job is to return two things and nothing else:

1. The polished version of what they said — clean, grammatically correct, well-phrased prose that preserves their exact meaning and intent.
2. A brief list of what you changed — maximum 4 bullet points, each under 10 words.

Tone: {TONE}

Tone guidance:
- Formal: professional, precise, suitable for workplace communication, emails, reports
- Casual: warm, natural, conversational, suitable for messages, slack, informal notes

Output format — return EXACTLY this structure with these exact labels, nothing else:

POLISHED:
{the polished text here}

CHANGES:
· {change note 1}
· {change note 2}
· {change note 3}

Rules:
1. Preserve the user's meaning exactly — do not add information they did not say
2. Remove filler words (uh, um, so basically, you know, like)
3. Fix repeated words, run-on sentences, grammatical errors
4. Keep it concise — do not pad or elaborate beyond what was said
5. CHANGES must be brief observations, not explanations
6. If the input is already clean, say so in CHANGES: "· Text was already well-formed"
7. Output ONLY the two sections above — no preamble, no sign-off

The user said:
"{TRANSCRIPT}"` },
};

let claudePath = null;
let whisperPath = null;
let win = null;
let splashWin = null;
let tray = null;
let isQuitting = false;
let menuBarTray = null;
let pulseInterval = null;
let currentIconState = 'idle';
let lastGeneratedPrompt = null;
let preExpandBounds = null;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngEncode(w, h, rgba) {
  function chunk(type, data) {
    const typeB = Buffer.from(type, 'ascii');
    const lenB = Buffer.allocUnsafe(4);
    lenB.writeUInt32BE(data.length, 0);
    const crcB = Buffer.allocUnsafe(4);
    crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
    return Buffer.concat([lenB, typeB, data, crcB]);
  }
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const rowLen = 1 + w * 4;
  const raw = Buffer.allocUnsafe(h * rowLen);
  for (let y = 0; y < h; y++) {
    raw[y * rowLen] = 0;
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 4;
      const dst = y * rowLen + 1 + x * 4;
      raw[dst]     = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function createMicIcon(state, isDark, showDot = true) {
  const W = 44, H = 44;
  const px = new Uint8Array(W * H * 4);

  function set(x, y, r, g, b, a) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  }
  function fillRect(x1, y1, x2, y2, r, g, b, a) {
    for (let y = y1; y <= y2; y++)
      for (let x = x1; x <= x2; x++)
        set(x, y, r, g, b, a);
  }
  function fillDisk(cx, cy, rad, r, g, b, a) {
    const r2 = rad * rad;
    for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++)
      for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r2)
          set(x, y, r, g, b, a);
  }

  const hidden = state === 'hidden';
  const alpha = hidden ? 115 : 255;
  const [mr, mg, mb] = (state === 'idle' || hidden) ? [0, 0, 0]
    : isDark ? [255, 255, 255] : [0, 0, 0];

  // Mic body: rounded top, flat bottom at y=25 (x=17..27)
  fillDisk(22, 10, 5, mr, mg, mb, alpha);
  fillRect(17, 10, 27, 25, mr, mg, mb, alpha);

  // Mic stand arc: ring at center (22,25), inner r=5, outer r=8, y>=25
  // Inner boundary at y=25 lands exactly on x=17 and x=27 (body edge)
  for (let y = 25; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d2 = (x - 22) ** 2 + (y - 25) ** 2;
      if (d2 >= 25 && d2 <= 64) set(x, y, mr, mg, mb, alpha);
    }

  // Stem and base
  fillRect(21, 33, 23, 37, mr, mg, mb, alpha);
  fillRect(14, 37, 30, 39, mr, mg, mb, alpha);

  // Diagonal slash for hidden state (mic-off indicator)
  if (hidden) {
    for (let t = 0; t <= 30; t++) {
      set(7 + t, 7 + t, 0, 0, 0, 255);
      set(8 + t, 7 + t, 0, 0, 0, 255);
      set(7 + t, 8 + t, 0, 0, 0, 255);
    }
  }

  // Status dot (top-right)
  if (showDot && state !== 'idle' && state !== 'hidden') {
    const [dr, dg, db] = state === 'recording' ? [255, 59, 48]
      : state === 'thinking' ? [10, 132, 255]
      : [52, 199, 89];
    fillDisk(30, 9, 7, dr, dg, db, 255);
  }

  const img = nativeImage.createFromBuffer(pngEncode(W, H, px), { scaleFactor: 2.0 });
  if (state === 'idle' || hidden) img.setTemplateImage(true);
  return img;
}

function createMenuBarIcon() {
  menuBarTray = new Tray(createMicIcon('idle'));
  menuBarTray.setToolTip('Promptly — ready');
  menuBarTray.on('click', () => {
    if (!win || win.isDestroyed()) return;
    if (win.isVisible()) { win.hide(); } else { win.show(); win.focus(); }
  });
  menuBarTray.on('right-click', () => {
    menuBarTray.popUpContextMenu(buildTrayMenu());
  });
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
  const BUNDLE_ID = 'io.betacraft.promptly';
  const home = os.homedir();
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Cancel', 'Uninstall'],
    defaultId: 0,
    cancelId: 0,
    title: 'Uninstall Promptly',
    message: 'Uninstall Promptly?',
    detail: 'This will remove Promptly and all its data:\n\n• Application bundle\n• App data and preferences\n• Logs\n• Microphone permission entry\n\nThis cannot be undone.',
  });
  if (response === 0) return { cancelled: true };

  const dataPaths = [
    path.join(home, 'Library', 'Application Support', 'promptly'),
    path.join(home, 'Library', 'Logs', 'promptly'),
    path.join(home, 'Library', 'Preferences', `${BUNDLE_ID}.plist`),
    path.join(home, 'Library', 'Saved Application State', `${BUNDLE_ID}.savedState`),
  ];
  for (const p of dataPaths) {
    try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  await new Promise((resolve) => {
    exec(`tccutil reset Microphone ${BUNDLE_ID}`, () => resolve());
  });
  await new Promise((resolve) => {
    exec('rm -rf "/Applications/Promptly.app"', () => resolve());
  });
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
        const prevState = currentIconState;
        updateMenuBarIcon('ready');
        setTimeout(() => {
          if (!menuBarTray || menuBarTray.isDestroyed()) return;
          updateMenuBarIcon(prevState === 'ready' ? 'idle' : prevState);
        }, 1200);
      },
    });
    template.push({ type: 'separator' });
  }
  template.push(
    {
      label: win && win.isVisible() ? 'Hide Promptly' : 'Show Promptly',
      click: () => {
        if (!win || win.isDestroyed()) return;
        if (win.isVisible()) { win.hide(); } else { win.show(); win.focus(); }
      },
    },
    { type: 'separator' },
    {
      label: 'Path configuration...',
      click: () => {
        if (win && !win.isDestroyed()) { win.show(); win.focus(); win.webContents.send('open-settings'); }
      },
    },
    { type: 'separator' },
    { label: 'Uninstall Promptly...', click: () => { handleUninstall(); } },
    { type: 'separator' },
    { label: 'Quit Promptly', click: () => { isQuitting = true; app.removeAllListeners('window-all-closed'); app.quit(); } }
  );
  return Menu.buildFromTemplate(template);
}

function updateTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
}


// Claude CLI is a Node.js script (#!/usr/bin/env node). In a packaged .app,
// process.env.PATH is minimal and excludes nvm's bin dir. Passing PATH enriched
// with the directory that contains the claude binary ensures 'node' is findable
// when the shebang is resolved by macOS.
function makeClaudeEnv(binPath) {
  // Resolve symlinks so we get the real bin dir (e.g. nvm's versioned dir, not /usr/local/bin)
  let realBin = binPath;
  try { realBin = fs.realpathSync(binPath); } catch { /* use as-is if resolution fails */ }
  const binDir = path.dirname(realBin);
  const base = process.env.PATH || '/usr/local/bin:/usr/bin:/bin';
  return { ...process.env, PATH: base.includes(binDir) ? base : binDir + ':' + base };
}

async function resolveClaudePath() {
  const stored = readConfig().claudePath;
  if (stored && stored.trim()) {
    try { if (fs.existsSync(stored.trim())) return stored.trim(); } catch { /* ignore */ }
  }
  const home = os.homedir();
  const commonPaths = [
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
  for (const p of commonPaths) {
    try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
  }
  const nvmDir = path.join(home, '.nvm', 'versions', 'node');
  try {
    if (fs.existsSync(nvmDir)) {
      for (const version of fs.readdirSync(nvmDir)) {
        const claudeBin = path.join(nvmDir, version, 'bin', 'claude');
        try { if (fs.existsSync(claudeBin)) return claudeBin; } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
  return new Promise((resolve) => {
    const nvmInit = `export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; which claude`;
    exec(`zsh -lc '${nvmInit}'`, (err, stdout) => {
      if (!err && stdout.trim()) { resolve(stdout.trim()); return; }
      exec(`bash -lc '${nvmInit}'`, (err2, stdout2) => {
        if (!err2 && stdout2.trim()) { resolve(stdout2.trim()); return; }
        resolve(null);
      });
    });
  });
}

function resolveShimToRealBinary(shimPath) {
  // Shims (pyenv/conda) need their tool initialized at runtime — resolve to the real binary
  // so it can be called directly without any shell environment
  return new Promise((resolve) => {
    exec('zsh -lc "pyenv which whisper 2>/dev/null"', (err, stdout) => {
      if (!err && stdout.trim()) { resolve(stdout.trim()); return; }
      exec('bash -lc "pyenv which whisper 2>/dev/null"', (err2, stdout2) => {
        resolve(stdout2?.trim() || shimPath);
      });
    });
  });
}

async function resolveWhisperPath() {
  const stored = readConfig().whisperPath;
  if (stored && stored.trim()) {
    try { if (fs.existsSync(stored.trim())) return stored.trim(); } catch { /* ignore */ }
  }
  const commonPaths = [
    '/usr/local/bin/whisper',
    '/usr/bin/whisper',
    path.join(os.homedir(), '.pyenv/shims/whisper'),
    path.join(os.homedir(), '.local/bin/whisper'),
    path.join(os.homedir(), '.local/pipx/venvs/openai-whisper/bin/whisper'),
    path.join(os.homedir(), 'Library/Python/3.9/bin/whisper'),
    path.join(os.homedir(), 'Library/Python/3.10/bin/whisper'),
    path.join(os.homedir(), 'Library/Python/3.11/bin/whisper'),
    path.join(os.homedir(), 'Library/Python/3.12/bin/whisper'),
    '/opt/homebrew/bin/whisper',
    '/opt/local/bin/whisper',
  ];
  for (const p of commonPaths) {
    try {
      if (fs.existsSync(p)) {
        if (p.includes('.pyenv/shims/')) return resolveShimToRealBinary(p);
        return p;
      }
    } catch { /* ignore */ }
  }
  const nvmWhisperDir = path.join(os.homedir(), '.nvm', 'versions', 'node');
  try {
    if (fs.existsSync(nvmWhisperDir)) {
      for (const version of fs.readdirSync(nvmWhisperDir)) {
        const whisperBin = path.join(nvmWhisperDir, version, 'bin', 'whisper');
        try { if (fs.existsSync(whisperBin)) return whisperBin; } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
  const shellResolved = await new Promise((resolve) => {
    exec('zsh -lc "which whisper"', (err, stdout) => {
      if (!err && stdout.trim()) { resolve(stdout.trim()); return; }
      exec('bash -lc "which whisper"', (err2, stdout2) => {
        if (!err2 && stdout2.trim()) { resolve(stdout2.trim()); return; }
        exec('zsh -lc "python3 -m whisper --help > /dev/null 2>&1 && echo found"', (err3, stdout3) => {
          if (!err3 && stdout3.trim()) { resolve('python3 -m whisper'); return; }
          resolve(null);
        });
      });
    });
  });
  if (shellResolved && shellResolved.includes('.pyenv/shims/')) {
    return resolveShimToRealBinary(shellResolved);
  }
  return shellResolved;
}

function winSend(channel, payload) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(channel, payload);
}

function registerShortcut() {
  const primaryRegistered = globalShortcut.register(SHORTCUT_PRIMARY, () => {
    winSend('shortcut-triggered');
  });
  if (!primaryRegistered) {
    const fallbackRegistered = globalShortcut.register(SHORTCUT_FALLBACK, () => {
      winSend('shortcut-triggered');
    });
    if (fallbackRegistered && win && !win.isDestroyed()) {
      win.webContents.on('did-finish-load', () => {
        winSend('shortcut-conflict', { fallback: SHORTCUT_FALLBACK });
      });
    }
  }
  globalShortcut.register('CommandOrControl+Shift+/', () => {
    winSend('show-shortcuts');
  });
  globalShortcut.register('Alt+P', () => {
    winSend('shortcut-pause');
  });
  globalShortcut.register('CommandOrControl+/', () => {
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
      winSend('open-settings');
    }
  });
  globalShortcut.register('CommandOrControl+Option+I', () => {
    if (win && !win.isDestroyed()) win.webContents.openDevTools({ mode: 'detach' });
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 520,
    height: 89,
    minWidth: 520,
    maxWidth: 520, // overridden at runtime by set-window-size IPC (calls setMinimumSize/setMaximumSize before setSize)
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#0A0A14',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
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
  win.loadFile(path.join(__dirname, 'dist-renderer/index.html'));
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
      updateTrayMenu();
    }
  });
  win.on('blur', () => {
    // Hide when focus moves to another app, unless mic is actively capturing or a
    // long-running Claude call is in progress (animated resize can trigger spurious blur)
    if (currentIconState !== 'recording' && currentIconState !== 'thinking' && currentIconState !== 'builder') win.hide();
  });
  win.on('hide', () => {
    clearInterval(pulseInterval);
    pulseInterval = null;
    if (menuBarTray && !menuBarTray.isDestroyed())
      menuBarTray.setImage(createMicIcon('hidden'));
  });
  win.on('show', () => {
    clearInterval(pulseInterval);
    pulseInterval = null;
    if (menuBarTray && !menuBarTray.isDestroyed())
      menuBarTray.setImage(createMicIcon('idle'));
  });
  nativeTheme.on('updated', () => {
    winSend('theme-changed', { dark: nativeTheme.shouldUseDarkColors });
    updateMenuBarIcon(currentIconState);
  });
  return win;
}

app.on('before-quit', () => { isQuitting = true; });

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.focus();
    }
  });
}

app.commandLine.appendSwitch('enable-transparent-visuals');

Menu.setApplicationMenu(null);

app.whenReady().then(async () => {
  // setPermissionCheckHandler: Chromium asks "do I already have this permission?" before
  // opening any stream. Returning true for 'media' tells Chromium it's already granted —
  // prevents the repeated per-call dialog. TCC is handled once in splash via askForMediaAccess.
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media';
  });
  // setPermissionRequestHandler: handles any fresh permission request that still comes through.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  claudePath = await resolveClaudePath();
  whisperPath = await resolveWhisperPath();

  splashWin = new BrowserWindow({
    width: 520,
    height: 300,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#0A0A14',
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

  createWindow();

  ipcMain.handle('splash-done', async () => {
    if (splashWin && !splashWin.isDestroyed()) splashWin.hide();
    setTimeout(() => {
      if (splashWin && !splashWin.isDestroyed()) { splashWin.destroy(); splashWin = null; }
      if (win && !win.isDestroyed()) { win.show(); win.center(); }
      registerShortcut();
      createMenuBarIcon();
    }, 1200);
  });

  ipcMain.handle('splash-check-cli', async () => {
    return { ok: !!claudePath, path: claudePath };
  });

  ipcMain.handle('splash-check-whisper', async () => {
    const ffmpegPaths = [
      '/usr/local/bin/ffmpeg',
      '/opt/homebrew/bin/ffmpeg',
      path.join(os.homedir(), '.local/bin/ffmpeg'),
      '/usr/bin/ffmpeg',
    ];
    const ffmpegFound = ffmpegPaths.some(p => {
      try { return fs.existsSync(p); } catch { return false; }
    });
    return { ok: !!whisperPath, path: whisperPath, ffmpegFound };
  });

  ipcMain.handle('splash-open-url', async (_event, url) => {
    if (typeof url === 'string' && url.startsWith('https://')) shell.openExternal(url);
  });

  ipcMain.handle('request-mic', async () => {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    return { ok: status === 'granted' };
  });

  ipcMain.handle('check-mic-status', async () => {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    return { granted: status === 'granted' };
  });

  // P1-008: IPC handlers
  ipcMain.handle('generate-prompt', (_event, { transcript, mode, options = {} }) => {
    return new Promise((resolve) => {
      if (!claudePath) {
        resolve({ success: false, error: 'Claude CLI not found. Install via npm i -g @anthropic-ai/claude-code' });
        return;
      }
      const modeConf = MODE_CONFIG[mode] || MODE_CONFIG.balanced;
      if (modeConf.passthrough) {
        resolve({ success: true, prompt: transcript });
        return;
      }
      let systemPrompt = modeConf.standalone
        ? modeConf.instruction.replace('{TRANSCRIPT}', transcript)
        : PROMPT_TEMPLATE
          .replace('{MODE_NAME}', modeConf.name)
          .replace('{MODE_INSTRUCTION}', modeConf.instruction)
          .replace('{TRANSCRIPT}', transcript);
      if (mode === 'polish') {
        const tone = options.tone || 'formal';
        systemPrompt = systemPrompt.replace('{TONE}', tone.charAt(0).toUpperCase() + tone.slice(1));
      }
      const child = spawn(claudePath, ['-p', systemPrompt, '--model', 'claude-sonnet-4-6'], { env: makeClaudeEnv(claudePath) });
      let stdout = '';
      let stderr = '';
      let resolved = false;
      const timer = setTimeout(() => {
        resolved = true;
        child.kill();
        resolve({ success: false, error: 'Claude took too long — try again' });
      }, 60000);
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.stdin.end();
      child.on('close', (code) => {
        if (resolved) return;
        clearTimeout(timer);
        resolved = true;
        if (code !== 0) {
          resolve({ success: false, error: stderr.trim() || 'Claude CLI error' });
          return;
        }
        const prompt = stdout.trim();
        if (!prompt) {
          resolve({ success: false, error: 'Claude returned an empty response — try again' });
          return;
        }
        resolve({ success: true, prompt });
      });
      child.on('error', (err) => {
        if (resolved) return;
        clearTimeout(timer);
        resolved = true;
        resolve({ success: false, error: err.message || 'Claude CLI error' });
      });
    });
  });

  ipcMain.handle('generate-raw', (_event, { systemPrompt }) => {
    return new Promise((resolve) => {
      if (!claudePath) {
        resolve({ success: false, error: 'Claude CLI not found.' });
        return;
      }
      const child = spawn(claudePath, ['-p', systemPrompt, '--model', 'claude-sonnet-4-6'], { env: makeClaudeEnv(claudePath) });
      let stdout = '', stderr = '', resolved = false;
      const timer = setTimeout(() => {
        resolved = true; child.kill();
        resolve({ success: false, error: 'Claude took too long — try again' });
      }, 60000);
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.stdin.end();
      child.on('close', (code) => {
        if (resolved) return;
        clearTimeout(timer); resolved = true;
        if (code !== 0) { resolve({ success: false, error: stderr.trim() || 'Claude CLI error' }); return; }
        const prompt = stdout.trim();
        if (!prompt) { resolve({ success: false, error: 'Claude returned empty response — try again' }); return; }
        resolve({ success: true, prompt });
      });
      child.on('error', (err) => {
        if (resolved) return;
        clearTimeout(timer); resolved = true;
        resolve({ success: false, error: err.message || 'Claude CLI error' });
      });
    });
  });

  ipcMain.handle('copy-to-clipboard', (_event, { text }) => {
    clipboard.writeText(text);
    return { success: true };
  });

  ipcMain.handle('resize-window', (_event, { height }) => {
    if (win) {
      win.setResizable(true);
      const [currentWidth] = win.getSize();
      win.setSize(currentWidth, height, true);
      win.setResizable(false);
    }
    return { ok: true };
  });

  ipcMain.handle('resize-window-width', (_event, { width }) => {
    if (win) {
      win.setResizable(true);
      const [, h] = win.getSize();
      win.setSize(width, h, true);
      win.setResizable(false);
    }
    return { ok: true };
  });

  ipcMain.handle('set-window-size', (_event, { width, height }) => {
    if (win) {
      win.setResizable(true);
      win.setMinimumSize(width, 50);
      win.setMaximumSize(width, 2000);
      if (width >= 1000) {
        // Expanding to full view — store pre-expand position, centre on current display
        preExpandBounds = win.getBounds();
        const display = screen.getDisplayNearestPoint({ x: preExpandBounds.x, y: preExpandBounds.y });
        const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
        const newX = Math.round(dx + (dw - width) / 2);
        // Clamp Y: shift up only as much as needed to clear the bottom edge
        const maxY = dy + dh - height;
        const newY = Math.max(Math.min(preExpandBounds.y, maxY), dy);
        win.setBounds({ x: newX, y: newY, width, height }, false);
      } else if (width <= 520 && preExpandBounds) {
        // Collapsing from expanded view — restore original x/y
        const { x, y } = preExpandBounds;
        win.setBounds({ x, y, width, height }, false);
        preExpandBounds = null;
      } else {
        win.setSize(width, height, true);
      }
      win.setResizable(false);
    }
    return { ok: true };
  });

  ipcMain.handle('set-window-buttons-visible', (_event, { visible }) => {
    if (win) win.setWindowButtonVisibility(visible);
    return { ok: true };
  });

  ipcMain.handle('show-mode-menu', (_event, { currentMode }) => {
    const modes = [
      { key: 'balanced', label: 'Balanced' },
      { key: 'detailed', label: 'Detailed' },
      { key: 'concise', label: 'Concise' },
      { key: 'chain', label: 'Chain' },
      { key: 'code', label: 'Code' },
      { key: 'design', label: 'Design' },
      { key: 'refine', label: 'Refine' },
      { key: 'polish', label: 'Polish' },
      { key: 'image', label: 'Image' },
      { key: 'video', label: 'Video' },
    ];
    const menu = Menu.buildFromTemplate([
      ...modes.map(({ key, label }) => ({
        label,
        type: 'checkbox',
        checked: currentMode === key,
        click: () => { winSend('mode-selected', key); },
      })),
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

  ipcMain.handle('show-tone-menu', (_event, { currentTone }) => {
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

  ipcMain.handle('transcribe-audio', async (_event, arrayBuffer) => {
    if (!whisperPath) {
      return { success: false, error: 'Whisper not found — install via pip install openai-whisper' };
    }
    const tmpFile = path.join(os.tmpdir(), `promptly-${Date.now()}.webm`);
    const outDir = os.tmpdir();
    const txtFile = path.join(outDir, path.basename(tmpFile, '.webm') + '.txt');
    try {
      fs.writeFileSync(tmpFile, Buffer.from(arrayBuffer));
      const transcript = await new Promise((resolve, reject) => {
        const whisperCmd = whisperPath === 'python3 -m whisper'
          ? `python3 -m whisper "${tmpFile}" --model tiny --language en --output_format txt --output_dir "${outDir}"`
          : `"${whisperPath}" "${tmpFile}" --model tiny --language en --output_format txt --output_dir "${outDir}"`;

        const pyenvVersion = process.env.PYENV_VERSION || '';
        const pythonPath = process.env.PYTHONPATH || '';
        const whisperEnv = {
          ...process.env,
          PATH: [
            '/usr/local/bin',
            '/usr/bin',
            '/bin',
            '/opt/homebrew/bin',
            '/opt/homebrew/sbin',
            '/opt/local/bin',
            path.join(os.homedir(), '.local/bin'),
            path.join(os.homedir(), '.pyenv/bin'),
            path.join(os.homedir(), '.pyenv/shims'),
            path.join(os.homedir(), 'anaconda3/bin'),
            path.join(os.homedir(), 'miniconda3/bin'),
            path.join(os.homedir(), 'miniforge3/bin'),
            '/usr/local/opt/ffmpeg/bin',
            process.env.PATH,
          ].filter(Boolean).join(':'),
          ...(pyenvVersion && { PYENV_VERSION: pyenvVersion }),
          ...(pythonPath && { PYTHONPATH: pythonPath }),
          PYTHONUNBUFFERED: '1',
          // Python.org macOS installer doesn't connect to the system keychain by default.
          // Point to macOS's system CA bundle so Whisper can download models over HTTPS.
          SSL_CERT_FILE: '/etc/ssl/cert.pem',
          REQUESTS_CA_BUNDLE: '/etc/ssl/cert.pem',
        };

        exec(whisperCmd, { timeout: 90000, env: whisperEnv }, (err, stdout, stderr) => {
          if (err) {
            reject(new Error(stderr || err.message || 'Whisper failed'));
            return;
          }
          try {
            const text = fs.readFileSync(txtFile, 'utf8').trim();
            try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
            try { fs.unlinkSync(txtFile); } catch { /* ignore */ }
            resolve(text);
          } catch {
            reject(new Error('Whisper output not found'));
          }
        });
      });
      return { success: true, transcript };
    } catch (err) {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
      return { success: false, error: err.message || 'Transcription failed' };
    }
  });

  ipcMain.handle('save-file', async (_event, { content, filename }) => {
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      defaultPath: filename,
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

  ipcMain.handle('check-claude-path', () => {
    if (claudePath) {
      return { found: true, path: claudePath };
    }
    return { found: false, error: 'Claude CLI not found.' };
  });

  ipcMain.handle('uninstall-promptly', () => handleUninstall());

  ipcMain.handle('get-stored-paths', () => {
    const config = readConfig();
    return {
      claudePath: claudePath || config.claudePath || '',
      whisperPath: whisperPath || config.whisperPath || '',
    };
  });

  ipcMain.handle('save-paths', async (_event, { claudePath: cp, whisperPath: wp }) => {
    const config = readConfig();
    if (cp && cp.trim()) { config.claudePath = cp.trim(); claudePath = cp.trim(); }
    if (wp && wp.trim()) { config.whisperPath = wp.trim(); whisperPath = wp.trim(); }
    writeConfig(config);
    return { ok: true };
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
    claudePath = await resolveClaudePath();
    whisperPath = await resolveWhisperPath();
    return {
      claude: { ok: !!claudePath, path: claudePath },
      whisper: { ok: !!whisperPath, path: whisperPath },
    };
  });

  ipcMain.handle('update-menubar-state', (_event, appState) => {
    const stateMap = {
      IDLE: 'idle', RECORDING: 'recording', PAUSED: 'recording',
      THINKING: 'thinking', ITERATING: 'thinking',
      PROMPT_READY: 'ready',
      IMAGE_BUILDER: 'builder', IMAGE_BUILDER_DONE: 'builder',
    };
    updateMenuBarIcon(stateMap[appState] || 'idle');
  });

  ipcMain.handle('set-last-prompt', (_event, prompt) => {
    lastGeneratedPrompt = prompt || null;
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || !menuBarTray) {
    app.quit();
  }
});

app.on('activate', () => {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    updateTrayMenu();
  }
});
