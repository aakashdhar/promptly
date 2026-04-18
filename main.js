'use strict';

const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, screen } = require('electron');
const path = require('path');
const { exec } = require('child_process');

const SHORTCUT_PRIMARY = 'Alt+Space';
const SHORTCUT_FALLBACK = 'Control+`';

let claudePath = null;
let win = null;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 480;
  const windowHeight = 80;

  win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round((screenWidth - windowWidth) / 2),
    y: Math.round(screenHeight * 0.85),
    frame: false,
    transparent: false,
    vibrancy: 'sidebar',
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
  return win;
}

app.whenReady().then(() => {
  createWindow();

  // P1-006: PATH resolution
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
        win.webContents.send('shortcut-conflict');
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

  ipcMain.handle('copy-to-clipboard', (_event, text) => {
    clipboard.writeText(text);
    return { ok: true };
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
