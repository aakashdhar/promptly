const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZE = 1024;
const RADIUS = 230;
const CX = SIZE / 2;
const CY = SIZE / 2;

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

// ── Write output ──────────────────────────────────────────────────────────────
const outPath = path.join(__dirname, '..', 'build', 'icon.png');
const buf = canvas.toBuffer('image/png');
fs.writeFileSync(outPath, buf);
console.log(`Icon written to ${outPath} (${buf.length} bytes)`);
