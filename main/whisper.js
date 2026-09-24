'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');
const platform = require('./platform');
const { PYTHON_WHISPER } = require('./binaries');

// Must match the model the onboarding wizard downloads and check-whisper-model looks for.
const WHISPER_MODEL = 'base';
const MIN_MODEL_BYTES = 100 * 1024 * 1024;

function makeWhisperEnv(ffmpegPath, env = process.env, home = os.homedir()) {
  return {
    ...env,
    PATH: [...platform.whisperPathDirs(home), ffmpegPath ? path.dirname(ffmpegPath) : null, env.PATH]
      .filter(Boolean).join(platform.PATH_DELIMITER),
    PYTHONUNBUFFERED: '1',
    ...platform.SSL_ENV,
  };
}

// whisperPath is either a binary path or the literal 'python3 -m whisper'.
function whisperCommand(whisperPath, args) {
  return whisperPath === PYTHON_WHISPER
    ? ['python3', ['-m', 'whisper', ...args]]
    : [whisperPath, args];
}

function findDownloadedModel(home = os.homedir()) {
  for (const dir of platform.whisperModelCacheDirs(home)) {
    const p = path.join(dir, `${WHISPER_MODEL}.pt`);
    try {
      const { size } = fs.statSync(p);
      if (size > MIN_MODEL_BYTES) return { path: p, sizeMB: Math.round(size / 1048576) };
    } catch { /* not in this cache dir */ }
  }
  return null;
}

function createWhisperRunner({ getWhisperPath, getFfmpegPath, onSlow = () => {}, children = new Set() }) {
  // Transcribes an audio file and resolves with its text. Uses execFile (no shell), so a
  // path saved in Settings can never be interpreted as shell syntax.
  function transcribe(audioFile, { timeoutMs, slowWarningMs }) {
    const outDir = path.dirname(audioFile);
    const txtFile = path.join(outDir, path.basename(audioFile, path.extname(audioFile)) + '.txt');
    const [cmd, args] = whisperCommand(getWhisperPath(), [
      audioFile, '--model', WHISPER_MODEL, '--language', 'en', '--output_format', 'txt', '--output_dir', outDir,
    ]);
    return new Promise((resolve, reject) => {
      let timedOut = false;
      const child = execFile(cmd, args, { env: makeWhisperEnv(getFfmpegPath()), maxBuffer: 10 * 1024 * 1024 }, (err, _stdout, stderr) => {
        clearTimeout(slowTimer);
        clearTimeout(killTimer);
        children.delete(child);
        if (err) {
          const wrapped = new Error(stderr || err.message || 'Whisper failed');
          if (timedOut) wrapped.timedOut = true;
          reject(wrapped);
          return;
        }
        try {
          const text = fs.readFileSync(txtFile, 'utf8').trim();
          try { fs.unlinkSync(txtFile); } catch { /* ignore */ }
          resolve(text);
        } catch {
          reject(new Error('Whisper output not found'));
        }
      });
      children.add(child);
      const slowTimer = setTimeout(onSlow, slowWarningMs);
      const killTimer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);
    });
  }

  // Runs Whisper on an empty input so it downloads the model, reporting tqdm progress.
  function downloadModel(onProgress) {
    return new Promise((resolve) => {
      const [cmd, args] = whisperCommand(getWhisperPath(), [os.devNull, '--model', WHISPER_MODEL]);
      const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: makeWhisperEnv(getFfmpegPath()) });
      let stderrBuf = '';
      let settled = false;
      const finish = (result) => { if (!settled) { settled = true; resolve(result); } };
      child.stderr.on('data', (d) => {
        stderrBuf += d.toString();
        // tqdm rewrites its line with \r — split on both.
        const lines = stderrBuf.split(/[\r\n]/);
        stderrBuf = lines.pop();
        for (const line of lines) {
          const progress = parseTqdmLine(line);
          if (progress) onProgress(progress);
        }
      });
      child.stdout.on('data', () => {});
      child.on('close', (code) => finish(code === 0 ? { success: true } : { success: false, error: stderrBuf.trim() || 'Download failed' }));
      child.on('error', (err) => finish({ success: false, error: err.message || 'Download failed' }));
    });
  }

  return { transcribe, downloadModel };
}

// tqdm remaining-time "mm:ss" or "h:mm:ss" → seconds
function parseTqdmTime(s) {
  if (!s) return null;
  const parts = s.trim().split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || null;
}

function parseTqdmLine(line) {
  const m = line.match(/(\d+)%\|.*?\|\s*([\d.]+)M\/([\d.]+)M\s*\[(.+?)<(.+?),/);
  if (!m) return null;
  return {
    percent: parseInt(m[1], 10),
    mbDone: parseFloat(m[2]),
    mbTotal: parseFloat(m[3]),
    secondsLeft: parseTqdmTime(m[5]),
  };
}

module.exports = { WHISPER_MODEL, makeWhisperEnv, whisperCommand, findDownloadedModel, createWhisperRunner, parseTqdmLine };
