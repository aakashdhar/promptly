'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let claudePath = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 80,
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

  // P1-007: global shortcut registration added here
  // P1-008: IPC channel stubs added here
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
