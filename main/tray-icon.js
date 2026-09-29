'use strict';

// Draws the 22pt (@2x) menu bar icon (the Promptly mark) as a PNG buffer, with no Electron dependency,
// and the coloured 16/32 px Windows tray icons.
// States: idle | hidden | recording | thinking | ready | builder.

const { deflateSync } = require('zlib');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngEncode(w, h, rgba) {
  function chunk(type, data) {
    const typeB = Buffer.from(type, 'ascii');
    const lenB = Buffer.allocUnsafe(4);
    lenB.writeUInt32BE(data.length, 0);
    const crcB = Buffer.allocUnsafe(4);
    crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
    return Buffer.concat([lenB, typeB, data, crcB]);
  }
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const rowLen = 1 + w * 4;
  const raw = Buffer.allocUnsafe(h * rowLen);
  for (let y = 0; y < h; y++) {
    raw[y * rowLen] = 0;
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 4;
      const dst = y * rowLen + 1 + x * 4;
      raw[dst]     = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Stroke coverage for a pixel: its centre's distance to the nearest segment ([x1, y1, x2, y2],
// round caps), smoothed over one pixel.
function segDist2(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2)) : 0;
  const ex = px - (x1 + t * dx), ey = py - (y1 + t * dy);
  return ex * ex + ey * ey;
}
function coverage(x, y, segs, width) {
  let d2 = Infinity;
  for (let k = 0; k < segs.length; k++) d2 = Math.min(d2, segDist2(x + 0.5, y + 0.5, segs[k]));
  return Math.max(0, Math.min(1, width / 2 + 0.5 - Math.sqrt(d2)));
}
// A polyline as segments: one sine period of `amp` along y between x0 and x1.
function waveSegs(x0, x1, y, amp, n = 16) {
  const segs = [];
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    segs.push([x0 + (x1 - x0) * t0, y - amp * Math.sin(2 * Math.PI * t0), x0 + (x1 - x0) * t1, y - amp * Math.sin(2 * Math.PI * t1)]);
  }
  return segs;
}

// The mark (D-LOGO) on the 44 px menu bar grid: two loose words, a wave, a straight line.
// The words stop short of the top-right corner, where the status dot goes.
const MAC_MARK = [[7, 12, 14, 12], [18, 14, 26, 14], ...waveSegs(7, 37, 22, 3), [7, 32, 37, 32]];
const MAC_STROKE = 4;
const MAC_SLASH = [[7, 7, 37, 37]];

// The mark's coverage masks (0–255 per pixel) are worked out ahead of time by
// scripts/generate-icon.js into tray-masks.json: working them out at startup cost about 2 s under
// the e2e debugger. tests/main.test.js checks the file still matches computeMacMasks().
function computeMacMasks() {
  const grid = (segs, width) => {
    const m = new Uint8Array(44 * 44);
    for (let y = 0; y < 44; y++) for (let x = 0; x < 44; x++) m[y * 44 + x] = Math.round(coverage(x, y, segs, width) * 255);
    return m;
  };
  return { mark: grid(MAC_MARK, MAC_STROKE), gap: grid(MAC_SLASH, 8), slash: grid(MAC_SLASH, 3.5) };
}
let macMasks = null;
function loadMacMasks() {
  if (!macMasks) {
    const json = require('./tray-masks.json');
    macMasks = Object.fromEntries(Object.entries(json).map(([k, b64]) => [k, new Uint8Array(Buffer.from(b64, 'base64'))]));
  }
  return macMasks;
}

// Finished icons are cached: the recording pulse asks for the same two every 600 ms.
const iconCache = new Map();

function drawMicIconPng(state, isDark, showDot = true) {
  const key = `${state}|${isDark}|${showDot}`;
  if (!iconCache.has(key)) iconCache.set(key, drawMacIcon(state, isDark, showDot));
  return iconCache.get(key);
}

function drawMacIcon(state, isDark, showDot) {
  const W = 44, H = 44;
  const px = new Uint8Array(W * H * 4);
  const { mark, gap, slash } = loadMacMasks();

  const hidden = state === 'hidden';
  const alpha = hidden ? 115 : 255;
  const [mr, mg, mb] = (state === 'idle' || hidden) ? [0, 0, 0]
    : isDark ? [255, 255, 255] : [0, 0, 0];
  const dot = showDot && state !== 'idle' && !hidden;
  const [dr, dg, db] = state === 'recording' ? [255, 59, 48]
    : state === 'thinking' ? [10, 132, 255]
    : [52, 199, 89];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const k = y * W + x;
      let a = (mark[k] / 255) * alpha;
      // Hidden: a full-strength slash with a clear gap either side of it.
      if (hidden) {
        a *= 1 - gap[k] / 255;
        a = Math.max(a, slash[k]);
      }
      px[i] = mr; px[i + 1] = mg; px[i + 2] = mb; px[i + 3] = Math.round(a);
      if (dot) {
        const d = Math.hypot(x + 0.5 - 35, y + 0.5 - 10);
        const c = Math.max(0, Math.min(1, 6.5 - d));
        if (c > 0) {
          px[i] = Math.round(dr * c + mr * (1 - c) * (a / 255));
          px[i + 1] = Math.round(dg * c + mg * (1 - c) * (a / 255));
          px[i + 2] = Math.round(db * c + mb * (1 - c) * (a / 255));
          px[i + 3] = Math.round(255 * c + a * (1 - c));
        }
      }
    }
  }

  return pngEncode(W, H, px);
}

// Idle and hidden icons are drawn black and rendered as macOS template images.
function isTemplateState(state) {
  return state === 'idle' || state === 'hidden';
}

// ── Windows tray ──────────────────────────────────────────────────────────────
// Windows has no template images and the taskbar may be light or dark, so each state is a
// disc with the mark on it. Idle is the app icon in small (paper disc, ink strokes, cobalt line),
// which reads on a dark taskbar by its disc and on a light one by its strokes; the other states
// are the status colour with white strokes.
// Drawn at 16 px and 32 px for 100% and 200% display scaling.

const WIN_TRAY_SIZES = [16, 32];

// Disc colours match the Mac status dots; idle is the app icon's paper.
const WIN_DISC = {
  idle:      [243, 247, 236],
  recording: [255, 59, 48],
  thinking:  [10, 132, 255],
  ready:     [52, 199, 89],
};
const WIN_IDLE_INK = [28, 36, 24];
const WIN_IDLE_LINE = [42, 63, 201];

// The mark on a 32-unit grid, so both sizes share one drawing: words, wave, line. Strokes are
// 2 units on odd rows, so they land on whole pixels at 16 px (1 px) and at 32 px (2 px).
const WIN_WORDS = [[9, 9, 14, 9], [18, 9, 23, 9]];
const WIN_WAVE = waveSegs(9, 23, 15, 2, 12);
const WIN_LINE = [[9, 21, 23, 21]];
const WIN_STROKE = 2;
const onSegs = (x, y, segs) => segs.some((s) => segDist2(x, y, s) <= (WIN_STROKE / 2) ** 2);

function inWinSlash(x, y) {
  return Math.abs(x - y) <= 1.5 && x >= 7 && x <= 25;
}

// RGBA pixels for one state at one size. With showDot off, recording and thinking fall back
// to the idle disc, so the pulse blinks the whole icon the way the Mac pulse blinks the dot.
function drawWinTrayIconRgba(state, size, showDot = true) {
  const hidden = state === 'hidden';
  const lit = !hidden && state !== 'idle' && showDot;
  const disc = lit ? (WIN_DISC[state] || WIN_DISC.ready) : WIN_DISC.idle;
  const ink = lit ? [255, 255, 255] : WIN_IDLE_INK;
  const line = lit ? [255, 255, 255] : WIN_IDLE_LINE;
  // The hidden icon is the idle one, dimmed and struck through like the Mac hidden icon, but
  // dimmed less: hidden is a tray app's resting state, so it must stay easy to spot.
  const alpha = hidden ? 0.8 : 1;

  const SS = 4;
  const unit = 32 / size;
  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const ux = (x + (sx + 0.5) / SS) * unit;
          const uy = (y + (sy + 0.5) / SS) * unit;
          let c = null;
          if ((ux - 16) ** 2 + (uy - 16) ** 2 <= 15.5 ** 2) c = disc;
          if (c && (onSegs(ux, uy, WIN_WORDS) || onSegs(ux, uy, WIN_WAVE) || (hidden && inWinSlash(ux, uy)))) c = ink;
          else if (c && onSegs(ux, uy, WIN_LINE)) c = line;
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1; }
        }
      }
      if (!a) continue;
      const i = (y * size + x) * 4;
      px[i] = Math.round(r / a);
      px[i + 1] = Math.round(g / a);
      px[i + 2] = Math.round(b / a);
      px[i + 3] = Math.round((a / (SS * SS)) * alpha * 255);
    }
  }
  return px;
}

// The Windows tray image for a state: one PNG per scale factor, never a template image.
const winCache = new Map();
function drawWinTrayIcons(state, showDot = true) {
  const key = `${state}|${showDot}`;
  if (!winCache.has(key)) winCache.set(key, drawWinTray(state, showDot));
  return winCache.get(key);
}
function drawWinTray(state, showDot) {
  return {
    template: false,
    representations: WIN_TRAY_SIZES.map((size) => ({
      scaleFactor: size / 16,
      width: size,
      height: size,
      buffer: pngEncode(size, size, drawWinTrayIconRgba(state, size, showDot)),
    })),
  };
}

module.exports = { drawMicIconPng, isTemplateState, computeMacMasks, pngEncode, WIN_TRAY_SIZES, drawWinTrayIconRgba, drawWinTrayIcons };
