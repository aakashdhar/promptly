'use strict';

const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Menu, shell } = require('electron');
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
};

let claudePath = null;
let whisperPath = null;
let win = null;
let splashWin = null;

function resolveClaudePath() {
  return new Promise((resolve) => {
    exec('zsh -lc "which claude"', (err, stdout) => {
      const p = stdout.trim();
      if (err || !p) {
        resolve(null);
      } else {
        resolve(p);
      }
    });
  });
}

function registerShortcut() {
  const primaryRegistered = globalShortcut.register(SHORTCUT_PRIMARY, () => {
    win.webContents.send('shortcut-triggered');
  });
  if (!primaryRegistered) {
    const fallbackRegistered = globalShortcut.register(SHORTCUT_FALLBACK, () => {
      win.webContents.send('shortcut-triggered');
    });
    if (fallbackRegistered) {
      win.webContents.on('did-finish-load', () => {
        win.webContents.send('shortcut-conflict', { fallback: SHORTCUT_FALLBACK });
      });
    }
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 520,
    height: 89,
    minWidth: 520,
    maxWidth: 520,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    vibrancy: 'fullscreen-ui',
    visualEffectState: 'active',
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
  win.loadFile('index.html');
  return win;
}

app.commandLine.appendSwitch('enable-transparent-visuals');
app.commandLine.appendSwitch('disable-gpu-compositing');

app.whenReady().then(async () => {
  claudePath = await resolveClaudePath();

  exec('zsh -lc "which whisper"', (err, stdout) => {
    whisperPath = stdout.trim() || null;
  });

  splashWin = new BrowserWindow({
    width: 520,
    height: 300,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    vibrancy: 'fullscreen-ui',
    visualEffectState: 'active',
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
  splashWin.loadFile('splash.html');
  splashWin.once('ready-to-show', () => {
    splashWin.show();
    splashWin.center();
  });

  createWindow();

  ipcMain.handle('splash-done', async () => {
    if (splashWin) splashWin.hide();
    setTimeout(() => {
      if (splashWin) { splashWin.destroy(); splashWin = null; }
      win.show();
      win.center();
      registerShortcut();
    }, 400);
  });

  ipcMain.handle('splash-check-cli', async () => {
    return { ok: !!claudePath, path: claudePath };
  });

  ipcMain.handle('splash-check-whisper', async () => {
    return { ok: !!whisperPath, path: whisperPath };
  });

  ipcMain.handle('splash-open-url', async (_event, url) => {
    if (typeof url === 'string' && url.startsWith('https://')) shell.openExternal(url);
  });

  ipcMain.handle('request-mic', async () => {
    return { ok: true };
  });

  // P1-008: IPC handlers
  ipcMain.handle('generate-prompt', (_event, { transcript, mode }) => {
    return new Promise((resolve) => {
      if (!claudePath) {
        resolve({ success: false, error: 'Claude CLI not found. Install via npm i -g @anthropic-ai/claude-code' });
        return;
      }
      const modeConf = MODE_CONFIG[mode] || MODE_CONFIG.balanced;
      const systemPrompt = PROMPT_TEMPLATE
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

  ipcMain.handle('copy-to-clipboard', (_event, { text }) => {
    clipboard.writeText(text);
    return { success: true };
  });

  ipcMain.handle('resize-window', (_event, { height }) => {
    if (win) {
      win.setResizable(true);
      win.setSize(520, height, true);
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
    ];
    const menu = Menu.buildFromTemplate(modes.map(({ key, label }) => ({
      label,
      type: 'radio',
      checked: currentMode === key,
      click: () => { win.webContents.send('mode-selected', key); },
    })));
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
        exec(`"${whisperPath}" "${tmpFile}" --model tiny --output_format txt --output_dir "${outDir}"`, { timeout: 60000 }, (err, _stdout, stderr) => {
          try {
            const text = fs.readFileSync(txtFile, 'utf8').trim();
            try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
            try { fs.unlinkSync(txtFile); } catch { /* ignore */ }
            resolve(text);
          } catch {
            reject(new Error(stderr || err?.message || 'Whisper output not found'));
          }
        });
      });
      return { success: true, transcript };
    } catch (err) {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
      return { success: false, error: err.message || 'Transcription failed' };
    }
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!win || win.isDestroyed()) {
    createWindow();
  } else if (!win.isVisible()) {
    win.show();
  }
});
