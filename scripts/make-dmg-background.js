'use strict';

// Renders the DMG window background (build/dmg-background.png and @2x) from HTML.
// Run with: npx electron scripts/make-dmg-background.js
// The app is self-signed, so the first open is blocked by macOS; the background tells people
// exactly how to get past that, right where they install.

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const WIDTH = 600;
const HEIGHT = 440;
const OUT_DIR = path.join(__dirname, '..', 'build');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden;
    background: #F4F4F6; color: #1C1C20;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  h1 { position: absolute; top: 26px; left: 0; right: 0; text-align: center; font-size: 17px; font-weight: 650; letter-spacing: -0.01em; }
  .drag { position: absolute; top: 52px; left: 0; right: 0; text-align: center; font-size: 12.5px; color: rgba(28,28,32,0.6); }
  /* Finder draws the app icon at (150, 170) and Applications at (450, 170); the arrow sits between. */
  .arrow { position: absolute; top: 158px; left: 232px; width: 136px; height: 24px; }
  .first {
    position: absolute; left: 32px; right: 32px; bottom: 26px; padding: 16px 18px;
    background: #FFFFFF; border: 1px solid rgba(28,28,32,0.10); border-radius: 12px;
  }
  .first h2 { font-size: 12.5px; font-weight: 650; margin-bottom: 8px; }
  ol { padding-left: 18px; font-size: 12px; line-height: 1.55; color: rgba(28,28,32,0.78); }
  b { color: #1C1C20; font-weight: 600; }
</style></head><body>
  <h1>Install Promptly</h1>
  <p class="drag">Drag Promptly into Applications</p>
  <svg class="arrow" viewBox="0 0 136 24" fill="none">
    <path d="M4 12 H122" stroke="rgba(28,28,32,0.35)" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 7"/>
    <path d="M116 5 L127 12 L116 19" stroke="rgba(28,28,32,0.45)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
  <div class="first">
    <h2>Opening it the first time</h2>
    <ol>
      <li>Open Promptly from Applications. macOS says it can't check it for malware — click <b>Done</b>.</li>
      <li>Open <b>System Settings → Privacy &amp; Security</b>, scroll down and click <b>Open Anyway</b> next to Promptly.</li>
      <li>Click <b>Open</b> to confirm. You only do this once.</li>
    </ol>
  </div>
</body></html>`;

// Renders once at 2x (Retina) and derives the 1x image from it.
async function render() {
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    useContentSize: true,
    webPreferences: { offscreen: true },
  });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 300));
  const image = await win.webContents.capturePage();
  win.destroy();
  return {
    x2: image.resize({ width: WIDTH * 2, height: HEIGHT * 2, quality: 'best' }).toPNG(),
    x1: image.resize({ width: WIDTH, height: HEIGHT, quality: 'best' }).toPNG(),
  };
}

app.commandLine.appendSwitch('force-device-scale-factor', '2');
app.whenReady().then(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { x1, x2 } = await render();
  fs.writeFileSync(path.join(OUT_DIR, 'dmg-background@2x.png'), x2);
  fs.writeFileSync(path.join(OUT_DIR, 'dmg-background.png'), x1);
  console.log('Wrote build/dmg-background.png and build/dmg-background@2x.png');
  app.quit();
});
