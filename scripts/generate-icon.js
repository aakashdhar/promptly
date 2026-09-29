// Draws the app icon from one SVG and renders every file that shows it:
//   build/icon.svg    the Mac master (macOS icon grid: an 824 px tile inside 1024, soft shadow)
//   build/icon.png    1024 px render of it
//   build/icon.icns   16–1024 px, via iconutil (macOS only)
//   build/icon.ico    16–256 px, full-bleed tile (Windows draws its own margins)
//   site/assets/icon.png  512 px full-bleed tile: the site's header mark, large favicon, touch icon
//   site/assets/favicon-32.png  the browser-tab icon, drawn in the heavy small-size cut
//   main/tray-masks.json  the menu bar icon's coverage masks (main/tray-icon.js draws from them)
//
//   node scripts/generate-icon.js     (needs Playwright's Chromium: npx playwright install chromium)
//
// The mark ("rough to right", D-LOGO): three strokes on pistachio paper. Loose words, then a
// waveform, then one straight cobalt line: what you think, what you say, what you get. At 32 px
// and below a heavier cut is drawn (two words, one wave), and at 16 px one snapped to the pixel grid.
'use strict';
/* global Image, document -- used inside page.evaluate, which runs in Chromium */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pngEncode, computeMacMasks } = require('../main/tray-icon');

const ROOT = path.join(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build');

const PAPER = '#F3F7EC';
const INK = '#1C2418';
const COBALT = '#2A3FC9';

// Shapes on the 1024 grid, placed for the Mac tile (100..924); the full-bleed tile scales them up.
// Each cut: stroke width, the loose words ([x0, y, x1]), the wave, and where the lines run.
const BASE = { x0: 262, x1: 762, waveY: 512, lineY: 694 };
const CUTS = {
  regular: {
    ...BASE, stroke: 64,
    words: [[262, 322, 362], [436, 338, 520], [596, 316, 762]],
    wave: { amp: 34, periods: 2 },
    hair: { width: 4, opacity: 0.14 },
  },
  small: {
    ...BASE, stroke: 92,
    words: [[262, 318, 430], [530, 334, 762]],
    wave: { amp: 40, periods: 1 },
    hair: { width: 22, opacity: 0.26 },
  },
  // 16 px: 2 px strokes centred on pixel rows (64 units = 1 px), drawn in the tile's own space.
  tinyMac: {
    x0: 262, x1: 762, waveY: 512, lineY: 704, stroke: 128,
    words: [[262, 320, 470], [554, 320, 762]],
    wave: { amp: 52, periods: 1 },
    hair: { width: 36, opacity: 0.3 },
  },
  tinyFull: {
    x0: 201, x1: 823, waveY: 512, lineY: 768, stroke: 128, unscaled: true,
    words: [[201, 256, 450], [574, 256, 823]],
    wave: { amp: 48, periods: 1 },
    hair: { width: 30, opacity: 0.3 },
  },
};

function wavePath({ x0, x1, waveY, wave: { amp, periods } }) {
  const n = 64;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(`${(x0 + (x1 - x0) * t).toFixed(1)} ${(waveY - amp * Math.sin(2 * Math.PI * periods * t)).toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
}

// variant 'mac': the 824 tile on the 1024 canvas with a shadow; 'full': the tile fills the canvas.
function iconSvg({ variant = 'mac', cut = 'regular' } = {}) {
  const full = variant === 'full';
  const c = CUTS[cut === 'tiny' ? (full ? 'tinyFull' : 'tinyMac') : cut];
  const inset = full ? 0 : 100;
  const tile = 1024 - 2 * inset;
  const radius = Math.round(tile * 0.2245);
  const scale = full && !c.unscaled ? 1024 / 824 : 1;
  const words = c.words.map(([x0, y, x1]) => `M${x0} ${y} L${x1} ${y}`).join(' ');
  const shadow = !full && cut === 'regular';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
${shadow ? '<defs><filter id="s" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#1C2418" flood-opacity="0.22"/></filter></defs>\n' : ''}<rect x="${inset}" y="${inset}" width="${tile}" height="${tile}" rx="${radius}" fill="${PAPER}"${shadow ? ' filter="url(#s)"' : ''}/>
<rect x="${inset + c.hair.width / 2}" y="${inset + c.hair.width / 2}" width="${tile - c.hair.width}" height="${tile - c.hair.width}" rx="${radius - c.hair.width / 2}" fill="none" stroke="${INK}" stroke-opacity="${c.hair.opacity}" stroke-width="${c.hair.width}"/>
<g transform="translate(512 512) scale(${scale.toFixed(4)}) translate(-512 -512)" fill="none" stroke-width="${c.stroke}" stroke-linecap="round" stroke-linejoin="round">
<path stroke="${INK}" d="${words}"/>
<path stroke="${INK}" d="${wavePath(c)}"/>
<path stroke="${COBALT}" d="M${c.x0} ${c.lineY} L${c.x1} ${c.lineY}"/>
</g>
</svg>
`;
}

// Renders SVGs to RGBA pixels in headless Chromium (the only SVG renderer this repo already has).
async function openRenderer() {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  return {
    async render(svg, size) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg.replace('width="1024" height="1024"', `width="${size}" height="${size}"`)}</body></html>`);
      // Pixels straight from a canvas, so the PNG encoding is ours (8-bit RGBA) whatever the screenshot format.
      const data = await page.evaluate(async (n) => {
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(document.querySelector('svg').outerHTML);
        await img.decode();
        const cv = document.createElement('canvas');
        cv.width = n; cv.height = n;
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, n, n);
        return Array.from(ctx.getImageData(0, 0, n, n).data);
      }, size);
      return Uint8Array.from(data);
    },
    close: () => browser.close(),
  };
}

// ── icon.ico ──────────────────────────────────────────────────────────────────
// The sizes Explorer, the taskbar, the Start menu and the NSIS installer pick from.
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

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

// images: { [size]: rgba } for every ICO size.
function buildIco(images) {
  const entries = ICO_SIZES.map((size) => ({ size, data: size >= 256 ? pngEncode(size, size, images[size]) : bmpEntry(size, images[size]) }));
  const dir = Buffer.alloc(6 + 16 * entries.length);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2); // 1 = icon
  dir.writeUInt16LE(entries.length, 4);
  let offset = dir.length;
  entries.forEach(({ size, data }, k) => {
    const e = 6 + 16 * k;
    dir[e] = size >= 256 ? 0 : size; // 0 means 256
    dir[e + 1] = size >= 256 ? 0 : size;
    dir.writeUInt16LE(1, e + 4);
    dir.writeUInt16LE(32, e + 6);
    dir.writeUInt32LE(data.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([dir, ...entries.map((img) => img.data)]);
}

const cutFor = (size) => (size <= 16 ? 'tiny' : size <= 32 ? 'small' : 'regular');

async function main() {
  const r = await openRenderer();
  try {
    const macSvg = iconSvg({ variant: 'mac' });
    fs.writeFileSync(path.join(BUILD_DIR, 'icon.svg'), macSvg);
    fs.writeFileSync(path.join(BUILD_DIR, 'icon.png'), pngEncode(1024, 1024, await r.render(macSvg, 1024)));

    if (process.platform === 'darwin') {
      const set = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-icon-')) + '/icon.iconset';
      fs.mkdirSync(set);
      for (const base of [16, 32, 128, 256, 512]) {
        for (const scale of [1, 2]) {
          const px = base * scale;
          const svg = iconSvg({ variant: 'mac', cut: cutFor(px) });
          fs.writeFileSync(path.join(set, `icon_${base}x${base}${scale === 2 ? '@2x' : ''}.png`), pngEncode(px, px, await r.render(svg, px)));
        }
      }
      execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(BUILD_DIR, 'icon.icns')]);
    } else {
      console.log('Not on macOS: build/icon.icns left as it is (iconutil is macOS only).');
    }

    const ico = {};
    for (const size of ICO_SIZES) ico[size] = await r.render(iconSvg({ variant: 'full', cut: cutFor(size) }), size);
    fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), buildIco(ico));

    // The menu bar icon's shapes, worked out here so the app doesn't at startup.
    const masks = computeMacMasks();
    fs.writeFileSync(path.join(ROOT, 'main', 'tray-masks.json'), JSON.stringify(Object.fromEntries(Object.entries(masks).map(([k, m]) => [k, Buffer.from(m).toString('base64')])), null, 2) + '\n');

    const site = path.join(ROOT, 'site', 'assets');
    fs.writeFileSync(path.join(site, 'icon.png'), pngEncode(512, 512, await r.render(iconSvg({ variant: 'full' }), 512)));
    fs.writeFileSync(path.join(site, 'favicon-32.png'), pngEncode(32, 32, await r.render(iconSvg({ variant: 'full', cut: 'small' }), 32)));
  } finally {
    await r.close();
  }
  console.log('Wrote build/icon.svg, icon.png, icon.icns, icon.ico, site/assets/icon.png, favicon-32.png and main/tray-masks.json');
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { ICO_SIZES, CUTS, iconSvg, buildIco };
