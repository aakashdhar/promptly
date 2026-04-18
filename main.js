'use strict';

const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, screen } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');

const SHORTCUT_PRIMARY = 'Alt+Space';
const SHORTCUT_FALLBACK = 'Control+`';

let claudePath = null;
let whisperPath = null;
let win = null;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 480;
  const windowHeight = 44;

  win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round((screenWidth - windowWidth) / 2),
    y: Math.round(screenHeight * 0.85),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 10 },
    transparent: true,
    vibrancy: 'sidebar',
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
  win.webContents.openDevTools({ mode: 'detach' });
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
    console.log('generate-prompt called — transcript:', transcript, 'mode:', mode);
    return '[placeholder — Claude integration coming in F-CLAUDE]';
  });

  ipcMain.handle('copy-to-clipboard', (_event, { text }) => {
    clipboard.writeText(text);
    return { success: true };
  });

  ipcMain.handle('resize-window', (_event, { height }) => {
    if (win) {
      win.setContentSize(480, height);
    }
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
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
