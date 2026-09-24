'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');
const platform = require('./platform');
const { PYTHON_WHISPER } = require('./binaries');

// ── Built-in engine (whisper.cpp, shipped in the app) ─────────────────────────
// scripts/fetch-whisper.sh builds these into vendor/whisper/; electron-builder copies that
// folder to Contents/Resources/whisper/.
const BUNDLED_CLI = 'whisper-cli';
const BUNDLED_MODEL = 'ggml-base.en-q5_1.bin';
// Silero voice-activity model: cuts silence out before transcribing, so pauses can't make the
// model stop early or invent words. Optional: an older vendor/whisper without it still works.
const BUNDLED_VAD = 'ggml-silero-v5.1.2.bin';

// ── Python fallback (openai-whisper) ──────────────────────────────────────────
// Must match the model the Python download step fetches and check-whisper-model looks for.
const WHISPER_MODEL = 'base';
const MIN_MODEL_BYTES = 100 * 1024 * 1024;

function findBundledEngine(dir) {
  if (!dir) return null;
  const cli = path.join(dir, BUNDLED_CLI);
  const model = path.join(dir, BUNDLED_MODEL);
  try {
    fs.accessSync(cli, fs.constants.X_OK);
    fs.accessSync(model, fs.constants.R_OK);
    const vad = path.join(dir, BUNDLED_VAD);
    try { fs.accessSync(vad, fs.constants.R_OK); return { cli, model, vad }; } catch { return { cli, model }; }
  } catch {
    return null;
  }
}

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

// whisper.cpp prints markers like [BLANK_AUDIO] or (music) for non-speech.
function cleanTranscript(text) {
  return text
    .replace(/\[(BLANK_AUDIO|MUSIC|SILENCE|NO_SPEECH)\]/gi, '')
    .replace(/^\s*[([][^)\]]*[)\]]\s*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const TIMESTAMP = /^\s*\[\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\]\s*/;

// whisper-cli prints one "[00:00:01.000 --> 00:00:04.180]   text" line per segment.
function segmentsToText(stdout) {
  return cleanTranscript(String(stdout || '').split('\n')
    .map((line) => line.replace(TIMESTAMP, '').trim())
    .filter((line) => line && !/^[([][^)\]]*[)\]]$/.test(line))
    .join(' '));
}

// Arguments for the built-in engine. Timestamps stay on (no --no-timestamps): without them
// whisper.cpp jumps to the next 30-second window whenever the model stops early, which after a
// pause silently dropped everything said in between.
function bundledArgs({ model, vad, audioFile, language = 'en', useGpu = false, hint = '' }) {
  const args = ['-m', model, '-f', audioFile, '-l', language, '--no-prints'];
  if (vad) args.push('--vad', '-vm', vad);
  if (!useGpu) args.push('--no-gpu');
  // Biases spelling toward the user's dictionary words (names, jargon).
  if (hint) args.push('--prompt', hint);
  return args;
}

// Length in seconds of a PCM WAV, from its header; 0 when it can't tell.
function wavSeconds(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const head = Buffer.alloc(44);
    fs.readSync(fd, head, 0, 44, 0);
    fs.closeSync(fd);
    if (head.toString('ascii', 0, 4) !== 'RIFF') return 0;
    const byteRate = head.readUInt32LE(28);
    return byteRate ? Math.max(0, fs.statSync(file).size - 44) / byteRate : 0;
  } catch {
    return 0;
  }
}

// People speak 2–3 words a second; under 0.4 over a long recording means speech went missing
// (or voice detection cut a quiet speaker), so it's worth a second pass.
function looksIncomplete(text, seconds) {
  if (seconds < 20) return false;
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  return words / seconds < 0.4;
}

// A 16 kHz mono PCM WAV of silence, used to warm up the GPU path.
function silentWav(seconds = 1, sampleRate = 16000) {
  const samples = seconds * sampleRate;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples * 2, 40);
  return buf;
}

function createWhisperRunner({
  getBundledDir = () => null,
  getWhisperPath,
  getFfmpegPath,
  getPromptHint = () => '',
  // The downloaded "Best accuracy" model, when the user chose it: { path } or null.
  getAccurateModel = () => null,
  getLanguage = () => 'en',
  onSlow = () => {},
  children = new Set(),
}) {
  // The GPU path compiles Metal shaders on first use (~20 s, once per Mac). Until a background
  // warm-up has done that, transcribe on the CPU so no recording waits for it.
  let gpuReady = false;

  function engine() {
    const bundled = findBundledEngine(getBundledDir());
    if (bundled) return { type: 'bundled', ...bundled };
    const whisperPath = getWhisperPath();
    return whisperPath ? { type: 'python', whisperPath } : null;
  }

  // Runs a binary without a shell, tracked for cancellation, with slow/timeout handling.
  function run(cmd, args, { env, timeoutMs, slowWarningMs }) {
    return new Promise((resolve, reject) => {
      let timedOut = false;
      const child = execFile(cmd, args, { env, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        clearTimeout(slowTimer);
        clearTimeout(killTimer);
        children.delete(child);
        if (err) {
          const wrapped = new Error(stderr || err.message || 'Whisper failed');
          if (timedOut) wrapped.timedOut = true;
          reject(wrapped);
          return;
        }
        resolve(stdout);
      });
      children.add(child);
      const slowTimer = slowWarningMs ? setTimeout(onSlow, slowWarningMs) : null;
      const killTimer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);
    });
  }

  async function transcribeBundled({ cli, model, vad }, audioFile, opts) {
    const accurate = getAccurateModel();
    const seconds = wavSeconds(audioFile);
    const base = {
      model: accurate ? accurate.path : model,
      audioFile,
      // The built-in model only knows English; the accurate one takes the chosen language.
      language: accurate ? getLanguage() || 'en' : 'en',
      // The large model is far too slow on the CPU, so it waits for the GPU if it must.
      useGpu: gpuReady || !!accurate,
      hint: getPromptHint(),
    };
    // Longer recordings (and the larger model) get more time before giving up.
    const timeoutMs = Math.max(opts.timeoutMs || 60000, 60000 + seconds * (accurate ? 2000 : 500));
    const slowWarningMs = opts.slowWarningMs && Math.max(opts.slowWarningMs, seconds * (accurate ? 200 : 60));
    const once = async (withVad) => segmentsToText(await run(cli, bundledArgs({ ...base, vad: withVad ? vad : null }), { env: process.env, ...opts, timeoutMs, slowWarningMs }));

    const text = await once(!!vad);
    if (!vad || !looksIncomplete(text, seconds)) return text;
    // Too few words for the length: try again without voice detection and keep the fuller one.
    const again = await once(false).catch(() => '');
    return again.split(/\s+/).length > text.split(/\s+/).length ? again : text;
  }

  async function transcribePython(whisperPath, audioFile, opts) {
    const outDir = path.dirname(audioFile);
    const txtFile = path.join(outDir, path.basename(audioFile, path.extname(audioFile)) + '.txt');
    const [cmd, args] = whisperCommand(whisperPath, [
      audioFile, '--model', WHISPER_MODEL, '--language', 'en', '--output_format', 'txt', '--output_dir', outDir,
    ]);
    await run(cmd, args, { env: makeWhisperEnv(getFfmpegPath()), ...opts });
    try {
      const text = fs.readFileSync(txtFile, 'utf8').trim();
      try { fs.unlinkSync(txtFile); } catch { /* ignore */ }
      return text;
    } catch {
      throw new Error('Whisper output not found');
    }
  }

  // Transcribes a 16 kHz mono WAV (what the renderer records) and resolves with its text.
  function transcribe(audioFile, opts) {
    const e = engine();
    if (!e) return Promise.reject(new Error('Speech-to-text is not available — reinstall Promptly'));
    return e.type === 'bundled' ? transcribeBundled(e, audioFile, opts) : transcribePython(e.whisperPath, audioFile, opts);
  }

  // Compiles the GPU shaders in the background so later transcriptions can use the GPU.
  async function warmUp(tmpDir) {
    const e = engine();
    if (!e || e.type !== 'bundled' || gpuReady) return false;
    const file = path.join(tmpDir, 'warmup.wav');
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(file, silentWav());
      await run(e.cli, bundledArgs({ model: e.model, audioFile: file, useGpu: true }), { env: process.env, timeoutMs: 120000 });
      gpuReady = true;
    } catch {
      // Stay on the CPU path; it's fast enough on its own.
    } finally {
      try { fs.unlinkSync(file); } catch { /* ignore */ }
    }
    return gpuReady;
  }

  // Runs Python Whisper on an empty input so it downloads its model, reporting tqdm progress.
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

  return { engine, transcribe, warmUp, downloadModel, isGpuReady: () => gpuReady };
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

module.exports = {
  WHISPER_MODEL,
  BUNDLED_CLI,
  BUNDLED_MODEL,
  BUNDLED_VAD,
  findBundledEngine,
  segmentsToText,
  bundledArgs,
  wavSeconds,
  looksIncomplete,
  makeWhisperEnv,
  whisperCommand,
  findDownloadedModel,
  cleanTranscript,
  silentWav,
  createWhisperRunner,
  parseTqdmLine,
};
