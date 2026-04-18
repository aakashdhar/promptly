'use strict';

const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Menu } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');

const SHORTCUT_PRIMARY = 'Alt+Space';
const SHORTCUT_FALLBACK = 'Control+`';

const MODE_SYSTEM_PROMPTS = {
  balanced: 'You are a prompt engineering assistant. Turn the following description into a structured Claude prompt. Use exactly these bold section headers, each on its own line: **Role:**, **Task:**, **Constraints:**, **Output Format:**. Write the section content on the lines below each header. Make reasonable assumptions for any unspecified details. Do not ask clarifying questions. Return only the prompt — no preamble, no commentary.',
  detailed: 'You are a prompt engineering assistant. Turn the following description into a detailed Claude prompt. Use exactly these bold section headers, each on its own line: **Role:**, **Task:**, **Detailed Constraints:**, **Edge Cases:**, **Output Format:**, **Example:**. Write content under each header. Make reasonable assumptions for any unspecified details. Do not ask clarifying questions. Return only the prompt — no preamble, no commentary.',
  concise: 'You are a prompt engineering assistant. Turn the following description into the shortest possible Claude prompt that still works. Use only the bold section headers that are essential — at minimum **Role:** and **Task:**. Make reasonable assumptions. Do not ask clarifying questions. Return only the prompt — no preamble, no commentary.',
  chain: 'You are a prompt engineering assistant. Turn the following description into a chain-of-thought Claude prompt. Use exactly these bold section headers, each on its own line: **Role:**, **Task:**, **Steps:**, **Output Format:**. Under **Steps:** write numbered steps Claude must work through before answering. Make reasonable assumptions. Do not ask clarifying questions. Return only the prompt — no preamble, no commentary.',
  code: 'You are a prompt engineering assistant. Turn the following description into a Claude prompt optimised for code generation. Use exactly these bold section headers, each on its own line: **Role:**, **Task:**, **Language & Interface:**, **Constraints:**, **Output Format:**. Make reasonable assumptions. Do not ask clarifying questions. Return only the prompt — no preamble, no commentary.',
};

let claudePath = null;
let whisperPath = null;
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 520,
    height: 101,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 10 },
    transparent: true,
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    alwaysOnTop: true,
    maximizable: false,
    fullscreenable: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.center();
  win.loadFile('index.html');
  return win;
}

app.whenReady().then(() => {
  createWindow();

  // PATH resolution — claude + whisper
  exec('zsh -lc "which whisper"', (err, stdout) => {
    whisperPath = stdout.trim() || null;
    console.log('whisperPath:', whisperPath || 'not found');
  });

  exec('zsh -lc "which claude"', (err, stdout) => {
    claudePath = stdout.trim();
    if (err || !claudePath) {
      claudePath = null;
      console.log('claudePath: not resolved —', err?.message);
    } else {
      console.log('claudePath:', claudePath);
    }
  });

  // P1-007: global shortcut registration
  const primaryRegistered = globalShortcut.register(SHORTCUT_PRIMARY, () => {
    win.webContents.send('shortcut-triggered');
  });

  if (primaryRegistered) {
    console.log('Shortcut registered:', SHORTCUT_PRIMARY);
  } else {
    const fallbackRegistered = globalShortcut.register(SHORTCUT_FALLBACK, () => {
      win.webContents.send('shortcut-triggered');
    });

    if (fallbackRegistered) {
      console.log('Shortcut registered (fallback):', SHORTCUT_FALLBACK);
      win.webContents.on('did-finish-load', () => {
        win.webContents.send('shortcut-conflict', { fallback: SHORTCUT_FALLBACK });
      });
    } else {
      console.log('Shortcut registration failed for both', SHORTCUT_PRIMARY, 'and', SHORTCUT_FALLBACK);
    }
  }

  // P1-008: IPC channel stubs
  ipcMain.handle('generate-prompt', (_event, { transcript, mode }) => {
    return new Promise((resolve) => {
      if (!claudePath) {
        resolve({ success: false, error: 'Claude CLI not found. Install via npm i -g @anthropic-ai/claude-code' });
        return;
      }
      const systemPrompt = MODE_SYSTEM_PROMPTS[mode] || MODE_SYSTEM_PROMPTS.balanced;
      const { spawn } = require('child_process');
      const child = spawn(claudePath, ['-p', systemPrompt]);
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
      child.stdin.write(transcript);
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
  // Only recreate the main window — pill window lifecycle is managed per-recording
  if (!win || win.isDestroyed()) {
    createWindow();
  } else if (!win.isVisible()) {
    win.show();
  }
});
