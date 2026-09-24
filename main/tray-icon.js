'use strict';

// Draws the 22pt (@2x) menu bar microphone as a PNG buffer, with no Electron dependency.
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

function drawMicIconPng(state, isDark, showDot = true) {
  const W = 44, H = 44;
  const px = new Uint8Array(W * H * 4);

  function set(x, y, r, g, b, a) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  }
  function fillRect(x1, y1, x2, y2, r, g, b, a) {
    for (let y = y1; y <= y2; y++)
      for (let x = x1; x <= x2; x++)
        set(x, y, r, g, b, a);
  }
  function fillDisk(cx, cy, rad, r, g, b, a) {
    const r2 = rad * rad;
    for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++)
      for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r2)
          set(x, y, r, g, b, a);
  }

  const hidden = state === 'hidden';
  const alpha = hidden ? 115 : 255;
  const [mr, mg, mb] = (state === 'idle' || hidden) ? [0, 0, 0]
    : isDark ? [255, 255, 255] : [0, 0, 0];

  // Mic body: rounded top, flat bottom at y=25 (x=17..27)
  fillDisk(22, 10, 5, mr, mg, mb, alpha);
  fillRect(17, 10, 27, 25, mr, mg, mb, alpha);

  // Mic stand arc: ring at center (22,25), inner r=5, outer r=8, y>=25
  // Inner boundary at y=25 lands exactly on x=17 and x=27 (body edge)
  for (let y = 25; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d2 = (x - 22) ** 2 + (y - 25) ** 2;
      if (d2 >= 25 && d2 <= 64) set(x, y, mr, mg, mb, alpha);
    }

  // Stem and base
  fillRect(21, 33, 23, 37, mr, mg, mb, alpha);
  fillRect(14, 37, 30, 39, mr, mg, mb, alpha);

  // Diagonal slash for hidden state (mic-off indicator)
  if (hidden) {
    for (let t = 0; t <= 30; t++) {
      set(7 + t, 7 + t, 0, 0, 0, 255);
      set(8 + t, 7 + t, 0, 0, 0, 255);
      set(7 + t, 8 + t, 0, 0, 0, 255);
    }
  }

  // Status dot (top-right)
  if (showDot && state !== 'idle' && state !== 'hidden') {
    const [dr, dg, db] = state === 'recording' ? [255, 59, 48]
      : state === 'thinking' ? [10, 132, 255]
      : [52, 199, 89];
    fillDisk(30, 9, 7, dr, dg, db, 255);
  }

  return pngEncode(W, H, px);
}

// Idle and hidden icons are drawn black and rendered as macOS template images.
function isTemplateState(state) {
  return state === 'idle' || state === 'hidden';
}

module.exports = { drawMicIconPng, isTemplateState, pngEncode };
