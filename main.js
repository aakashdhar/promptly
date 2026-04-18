'use strict';

const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, screen } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');

const SHORTCUT_PRIMARY = 'Alt+Space';
const SHORTCUT_FALLBACK = 'Control+`';

const MODE_SYSTEM_PROMPTS = {
  balanced: 'You are a prompt engineering assistant. Given the following description, write a structured Claude prompt with: a clear role, the specific task, concise constraints, and the desired output format. Be direct and precise. Return only the prompt — no explanation.',
  detailed: 'You are a prompt engineering assistant. Given the following description, write a thorough Claude prompt that includes: role, task, detailed constraints, edge cases to handle, output format, and one concrete example of the desired output. Return only the prompt — no explanation.',
  concise: 'You are a prompt engineering assistant. Given the following description, write the shortest possible Claude prompt that captures the core task with only the constraints that are necessary. Strip all scaffolding and fluff. Return only the prompt — no explanation.',
  chain: 'You are a prompt engineering assistant. Given the following description, write a chain-of-thought Claude prompt that breaks the task into explicit numbered steps Claude should work through in sequence before giving a final answer. Return only the prompt — no explanation.',
  code: 'You are a prompt engineering assistant. Given the following description, write a Claude prompt optimised for code generation. Specify: language, function signature or interface, constraints, edge cases to handle, and expected output format. Return only the prompt — no explanation.',
};

let claudePath = null;
let whisperPath = null;
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 80,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 10 },
    transparent: true,
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win.setPosition(Math.floor(width / 2 - 240), Math.floor(height - 120));

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
      const child = spawn(claudePath, [
        '--print',
        '--system-prompt', systemPrompt,
        '--no-session-persistence',
      ]);
      let stdout = '';
      let stderr = '';
      let resolved = false;
      const timer = setTimeout(() => {
        resolved = true;
        child.kill();
        resolve({ success: false, error: 'Claude took too long — try again' });
      }, 30000);
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
