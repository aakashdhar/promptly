// Draws the app icon (build/icon.png, 1024 px) and derives the Windows icon (build/icon.ico) from it.
//   node scripts/generate-icon.js         draw icon.png (needs the `canvas` package), then write icon.ico
//   node scripts/generate-icon.js --ico   only rebuild icon.ico from the committed icon.png, no packages needed
'use strict';

const fs = require('fs');
const path = require('path');
const { inflateSync } = require('zlib');
const { pngEncode } = require('../main/tray-icon');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const PNG_PATH = path.join(BUILD_DIR, 'icon.png');
const ICO_PATH = path.join(BUILD_DIR, 'icon.ico');

const SIZE = 1024;
const RADIUS = 230;
const CX = SIZE / 2;
const CY = SIZE / 2;

function drawAppIconPng() {
  // Required here so --ico works without the native canvas build.
  const { createCanvas } = require('canvas');

  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // ── Background: rounded rect #0A0A14 ──────────────────────────────────────────
  ctx.beginPath();
  ctx.roundRect(0, 0, SIZE, SIZE, RADIUS);
  ctx.fillStyle = '#0A0A14';
  ctx.fill();
  ctx.clip();

  // ── Purple glow — bottom-left ─────────────────────────────────────────────────
  {
    const grd = ctx.createRadialGradient(220, 820, 0, 220, 820, 520);
    grd.addColorStop(0, 'rgba(120,40,200,0.22)');
    grd.addColorStop(1, 'rgba(120,40,200,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // ── Blue glow — top-right ─────────────────────────────────────────────────────
  {
    const grd = ctx.createRadialGradient(820, 200, 0, 820, 200, 480);
    grd.addColorStop(0, 'rgba(10,132,255,0.16)');
    grd.addColorStop(1, 'rgba(10,132,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // ── Outer pulse rings ─────────────────────────────────────────────────────────
  function ring(r, color) {
    ctx.beginPath();
    ctx.arc(CX, CY, r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ring(310, 'rgba(10,132,255,0.06)');
  ring(260, 'rgba(10,132,255,0.10)');

  // ── Blue circle background at centre ─────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(CX, CY, 200, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10,132,255,0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,132,255,0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // ── Mic body ─────────────────────────────────────────────────────────────────
  // Rounded rect: 88px wide, 140px tall, radius 44 (full pill top)
  const micW = 88;
  const micH = 140;
  const micR = 44;
  const micX = CX - micW / 2;
  const micY = CY - 120;

  ctx.beginPath();
  ctx.roundRect(micX, micY, micW, micH, micR);
  ctx.strokeStyle = 'rgba(130,190,255,0.95)';
  ctx.lineWidth = 8;
  ctx.stroke();

  // ── Inner mic lines ───────────────────────────────────────────────────────────
  const lineY1 = micY + micH * 0.32;
  const lineY2 = micY + micH * 0.52;
  const lineY3 = micY + micH * 0.72;
  const lineInset = 20;

  [
    ['rgba(100,180,255,0.35)', lineY1],
    ['rgba(100,180,255,0.25)', lineY2],
    ['rgba(100,180,255,0.18)', lineY3],
  ].forEach(([color, y]) => {
    ctx.beginPath();
    ctx.moveTo(micX + lineInset, y);
    ctx.lineTo(micX + micW - lineInset, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
  });

  // ── Mic arc below body ────────────────────────────────────────────────────────
  const arcY = micY + micH + 4;
  const arcR = 62;
  ctx.beginPath();
  ctx.arc(CX, arcY, arcR, Math.PI, 0, false);
  ctx.strokeStyle = 'rgba(120,185,255,0.88)';
  ctx.lineWidth = 7;
  ctx.stroke();

  // ── Mic stand: vertical line ──────────────────────────────────────────────────
  const standTopY = arcY;
  const standBotY = arcY + arcR - 2;
  ctx.beginPath();
  ctx.moveTo(CX, standTopY);
  ctx.lineTo(CX, standBotY);
  ctx.strokeStyle = 'rgba(120,185,255,0.85)';
  ctx.lineWidth = 7;
  ctx.stroke();

  // ── Mic stand: horizontal bar ─────────────────────────────────────────────────
  const barHalfW = 44;
  ctx.beginPath();
  ctx.moveTo(CX - barHalfW, standBotY);
  ctx.lineTo(CX + barHalfW, standBotY);
  ctx.strokeStyle = 'rgba(120,185,255,0.85)';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineCap = 'butt';

  // ── Helper: glow circle ───────────────────────────────────────────────────────
  function glowCircle(x, y, r, color, glowR, glowColor) {
    if (glowR && glowColor) {
      const grd = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      grd.addColorStop(0, glowColor);
      grd.addColorStop(1, 'rgba(168,85,247,0)');
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // ── Purple spark — large (top-right of mic) ───────────────────────────────────
  glowCircle(CX + 108, micY - 30, 12, 'rgba(168,85,247,0.95)', 40, 'rgba(168,85,247,0.3)');

  // ── Purple spark — medium (left of mic) ──────────────────────────────────────
  glowCircle(CX - 118, micY + 30, 8, 'rgba(168,85,247,0.75)', 26, 'rgba(168,85,247,0.2)');

  // ── Blue spark (bottom-right) ─────────────────────────────────────────────────
  glowCircle(CX + 95, arcY + 20, 7, 'rgba(100,160,255,0.8)', 22, 'rgba(100,160,255,0.2)');

  // ── Tiny sparks ───────────────────────────────────────────────────────────────
  glowCircle(CX - 80, micY - 55, 5, 'rgba(168,85,247,0.55)');
  glowCircle(CX + 60, micY - 75, 4, 'rgba(200,150,255,0.5)');

  return canvas.toBuffer('image/png');
}

// ── icon.ico ──────────────────────────────────────────────────────────────────
// The sizes Explorer, the taskbar, the Start menu and the NSIS installer pick from.
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

// Decodes the 8-bit RGBA, non-interlaced PNG that drawAppIconPng writes.
function decodePng(buf) {
  let off = 8;
  let w = 0, h = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error('icon.png must be 8-bit RGBA, non-interlaced');
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const px = new Uint8Array(w * h * 4);
  const stride = w * 4;
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? px[y * stride + i - 4] : 0;
      const b = y > 0 ? px[(y - 1) * stride + i] : 0;
      const c = i >= 4 && y > 0 ? px[(y - 1) * stride + i - 4] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + i] = (row[i] + pred) & 0xFF;
    }
  }
  return { w, h, px };
}

// Area-average downscale in premultiplied alpha, so transparent corners don't darken the edge.
function resize({ w, h, px }, size) {
  const out = new Uint8Array(size * size * 4);
  const scale = w / size;
  for (let oy = 0; oy < size; oy++) {
    const y0 = oy * scale, y1 = y0 + scale;
    for (let ox = 0; ox < size; ox++) {
      const x0 = ox * scale, x1 = x0 + scale;
      let r = 0, g = 0, b = 0, a = 0, total = 0;
      for (let y = Math.floor(y0); y < Math.min(h, Math.ceil(y1)); y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0);
        for (let x = Math.floor(x0); x < Math.min(w, Math.ceil(x1)); x++) {
          const wt = wy * (Math.min(x + 1, x1) - Math.max(x, x0));
          const i = (y * w + x) * 4;
          const pa = px[i + 3] * wt;
          r += px[i] * pa; g += px[i + 1] * pa; b += px[i + 2] * pa;
          a += pa; total += wt;
        }
      }
      const i = (oy * size + ox) * 4;
      if (a > 0) {
        out[i] = Math.round(r / a); out[i + 1] = Math.round(g / a); out[i + 2] = Math.round(b / a);
      }
      out[i + 3] = Math.round(a / total);
    }
  }
  return out;
}

// 32-bit BMP entry (BITMAPINFOHEADER + bottom-up BGRA + AND mask). Sizes below 256 use BMP, the form
// every icon reader takes (installer tools included); only 256 px is PNG, as in Windows' own icons.
function bmpEntry(size, rgba) {
  const maskStride = Math.ceil(size / 32) * 4;
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // XOR bitmap + AND mask
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(size * size * 4 + maskStride * size, 20);
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4;
      const d = ((size - 1 - y) * size + x) * 4;
      pixels[d] = rgba[s + 2]; pixels[d + 1] = rgba[s + 1]; pixels[d + 2] = rgba[s]; pixels[d + 3] = rgba[s + 3];
    }
  }
  // The alpha channel decides transparency; an all-zero mask keeps every pixel.
  return Buffer.concat([header, pixels, Buffer.alloc(maskStride * size)]);
}

function buildIco(source) {
  const images = ICO_SIZES.map((size) => {
    const rgba = resize(source, size);
    return { size, data: size >= 256 ? pngEncode(size, size, rgba) : bmpEntry(size, rgba) };
  });
  const dir = Buffer.alloc(6 + 16 * images.length);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2); // 1 = icon
  dir.writeUInt16LE(images.length, 4);
  let offset = dir.length;
  images.forEach(({ size, data }, k) => {
    const e = 6 + 16 * k;
    dir[e] = size >= 256 ? 0 : size; // 0 means 256
    dir[e + 1] = size >= 256 ? 0 : size;
    dir.writeUInt16LE(1, e + 4);
    dir.writeUInt16LE(32, e + 6);
    dir.writeUInt32LE(data.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([dir, ...images.map((img) => img.data)]);
}

if (require.main === module) {
  if (!process.argv.includes('--ico')) {
    const buf = drawAppIconPng();
    fs.writeFileSync(PNG_PATH, buf);
    console.log(`Icon written to ${PNG_PATH} (${buf.length} bytes)`);
  }
  const ico = buildIco(decodePng(fs.readFileSync(PNG_PATH)));
  fs.writeFileSync(ICO_PATH, ico);
  console.log(`Windows icon written to ${ICO_PATH} (${ICO_SIZES.join('/')} px, ${ico.length} bytes)`);
}

module.exports = { ICO_SIZES, decodePng, resize, buildIco };
