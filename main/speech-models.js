'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

// "Best accuracy" speech recognition: Whisper large-v3-turbo, downloaded once on request. It
// hears accents, fast speech, names and jargon far better than the built-in base.en model, and
// understands Hindi and 90+ other languages. Too big to ship in the app (the DMG stays small),
// so it lives in userData/models and the built-in model stays as the fallback.
const ACCURATE_MODEL = {
  file: 'ggml-large-v3-turbo-q5_0.bin',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin',
  sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2',
  bytes: 574041195,
};

// Languages the Settings picker offers with the accurate model ("auto" lets Whisper detect it).
const SPEECH_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'auto', label: 'Detect automatically' },
];

// stallMs: a connection that sends nothing for this long is dropped, so a silent Wi-Fi
// drop ends in an error instead of "downloading" forever.
function createSpeechModels({ dir, model = ACCURATE_MODEL, stallMs = 30000 }) {
  const target = path.join(dir, model.file);
  const partial = `${target}.part`;
  let active = null; // { request, file, cancelled }

  function installedPath() {
    try {
      return fs.statSync(target).size === model.bytes ? target : null;
    } catch {
      return null;
    }
  }

  // GET that follows redirects (Hugging Face sends downloads on to its CDN).
  function get(url, redirects = 5) {
    return new Promise((resolve, reject) => {
      const lib = url.startsWith('http:') ? http : https;
      const request = lib.get(url, { headers: { 'User-Agent': 'Promptly' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          res.resume();
          resolve(get(new URL(res.headers.location, url).toString(), redirects - 1));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Download failed (HTTP ${res.statusCode})`));
          return;
        }
        resolve(res);
      });
      request.on('error', reject);
      request.setTimeout(stallMs, () => { if (active) active.stalled = true; request.destroy(Object.assign(new Error('The download stalled — check your connection and try again'), { code: 'ESTALLED' })); });
      if (active) active.request = request;
    });
  }

  // Downloads to a .part file, checks its SHA-256, then moves it into place. onProgress gets
  // { percent, mbDone, mbTotal } a few times a second.
  async function download(onProgress = () => {}) {
    if (installedPath()) return { success: true };
    if (active) return { success: false, error: 'Already downloading' };
    active = { request: null, cancelled: false };
    const job = active;
    let res = null;
    let out = null;
    try {
      fs.mkdirSync(dir, { recursive: true });
      res = await get(model.url);
      if (job.cancelled) { res.destroy(); throw new Error('cancelled'); }
      const total = Number(res.headers['content-length']) || model.bytes;
      const hash = crypto.createHash('sha256');
      out = fs.createWriteStream(partial);
      let done = 0;
      let lastReport = 0;
      await new Promise((resolve, reject) => {
        res.on('data', (chunk) => {
          hash.update(chunk);
          done += chunk.length;
          const now = Date.now();
          if (now - lastReport > 250) {
            lastReport = now;
            onProgress({ percent: Math.floor((done / total) * 100), mbDone: Math.round(done / 1048576), mbTotal: Math.round(total / 1048576) });
          }
        });
        res.on('error', reject);
        res.on('close', () => { if (!res.complete) reject(new Error(job.cancelled ? 'cancelled' : job.stalled ? 'The download stalled — check your connection and try again' : 'Download interrupted')); });
        out.on('error', reject);
        out.on('finish', resolve);
        res.pipe(out);
      });
      if (job.cancelled) throw new Error('cancelled');
      if (hash.digest('hex') !== model.sha256) throw new Error('The download was damaged, please try again');
      fs.renameSync(partial, target);
      onProgress({ percent: 100, mbDone: Math.round(total / 1048576), mbTotal: Math.round(total / 1048576) });
      return { success: true };
    } catch (err) {
      // Close the half-written file before removing it, or its descriptor stays open.
      if (res && out) res.unpipe(out);
      out?.destroy();
      try { fs.unlinkSync(partial); } catch { /* nothing to clean */ }
      if (job.cancelled || err.message === 'cancelled') return { success: false, cancelled: true };
      if (job.stalled) return { success: false, error: 'The download stalled — check your connection and try again' };
      return { success: false, error: err.code === 'ENOTFOUND' || err.code === 'ECONNRESET' ? 'No internet connection' : err.message || 'Download failed' };
    } finally {
      active = null;
    }
  }

  function cancel() {
    if (!active) return false;
    active.cancelled = true;
    active.request?.destroy();
    return true;
  }

  function remove() {
    cancel();
    try { fs.unlinkSync(target); } catch { /* already gone */ }
    try { fs.unlinkSync(partial); } catch { /* already gone */ }
  }

  return {
    installedPath,
    download,
    cancel,
    remove,
    isDownloading: () => !!active,
    sizeMB: Math.round(model.bytes / 1048576),
  };
}

module.exports = { ACCURATE_MODEL, SPEECH_LANGUAGES, createSpeechModels };
