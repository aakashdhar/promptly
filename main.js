'use strict';

process.on('uncaughtException', (err) => {
  console.error('[Promptly] Uncaught exception:', err.message, err.stack);
});

const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Menu, Tray, nativeImage, nativeTheme, shell, dialog, systemPreferences, session } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');

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
};

let claudePath = null;
let whisperPath = null;
let win = null;
let splashWin = null;
let tray = null;

function updateTrayMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    {
      label: win && win.isVisible() ? 'Hide Promptly' : 'Show Promptly',
      click: () => {
        if (!win || win.isDestroyed()) return;
        if (win.isVisible()) { win.hide(); } else { win.show(); win.focus(); }
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (!win || win.isDestroyed()) return;
    if (win.isVisible()) { win.hide(); } else { win.show(); win.focus(); }
    updateTrayMenu();
  });
}

function createTray() {
  // Minimal 16x16 black circle on transparent background — template image (macOS inverts for dark/light menu bar)
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAAP0lEQVQ4jWNgGAWjgJqAkYGBgYGJiYmBiYkJIsDAwMDAxMTEwMTExMDExMTAxMTEwMTExMDExMTAxMTEMAIAsAAFoAABFhAAAAAASUVORK5CYII='
  );
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Promptly');
  updateTrayMenu();
  if (app.dock) app.dock.hide();
}

async function resolveClaudePath() {
  const commonPaths = [
    '/usr/local/bin/claude',
    '/usr/bin/claude',
    path.join(os.homedir(), '.local/bin/claude'),
    path.join(os.homedir(), '.npm-global/bin/claude'),
    path.join(os.homedir(), 'node_modules/.bin/claude'),
    '/opt/homebrew/bin/claude',
    '/opt/local/bin/claude',
  ];
  for (const p of commonPaths) {
    try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
  }
  return new Promise((resolve) => {
    exec('zsh -lc "which claude"', (err, stdout) => {
      if (!err && stdout.trim()) { resolve(stdout.trim()); return; }
      exec('bash -lc "which claude"', (err2, stdout2) => {
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
  win.loadFile(path.join(__dirname, 'dist-renderer/index.html'))
  nativeTheme.on('updated', () => {
    winSend('theme-changed', { dark: nativeTheme.shouldUseDarkColors });
  });
  return win;
}

app.commandLine.appendSwitch('enable-transparent-visuals');

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
      createTray();
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
    const granted = await systemPreferences.askForMediaAccess('microphone');
    return { ok: granted };
  });

  ipcMain.handle('check-mic-status', async () => {
    // askForMediaAccess uses the native macOS TCC API — persists for unsigned apps,
    // returns true immediately without a prompt if permission was already granted
    const granted = await systemPreferences.askForMediaAccess('microphone');
    return { granted };
  });

  // P1-008: IPC handlers
  ipcMain.handle('generate-prompt', (_event, { transcript, mode }) => {
    return new Promise((resolve) => {
      if (!claudePath) {
        resolve({ success: false, error: 'Claude CLI not found. Install via npm i -g @anthropic-ai/claude-code' });
        return;
      }
      const modeConf = MODE_CONFIG[mode] || MODE_CONFIG.balanced;
      const systemPrompt = modeConf.standalone
        ? modeConf.instruction.replace('{TRANSCRIPT}', transcript)
        : PROMPT_TEMPLATE
          .replace('{MODE_NAME}', modeConf.name)
          .replace('{MODE_INSTRUCTION}', modeConf.instruction)
          .replace('{TRANSCRIPT}', transcript);
      const { spawn } = require('child_process');
      const child = spawn(claudePath, ['-p', systemPrompt, '--model', 'claude-sonnet-4-6']);
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
      const { spawn } = require('child_process');
      const child = spawn(claudePath, ['-p', systemPrompt, '--model', 'claude-sonnet-4-6']);
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
      win.setSize(width, height, true);
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
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || !tray) {
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
