'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const platform = require('./platform');

const MAX_EDGE = 1600;
const KEEP_MS = 10 * 60 * 1000;

// Screenshots of the window the user was looking at when they started talking. Each one is
// kept on disk under an id, so the renderer only passes the id around, and is deleted after
// ten minutes (long enough for a retry) or when Promptly quits.
function createScreenshots({
  dir,
  getCapturePath = () => platform.SCREENCAPTURE_PATH,
  sipsPath = platform.SIPS_PATH,
  execFileImpl = execFile,
  now = Date.now,
}) {
  const shots = new Map();

  function run(cmd, args) {
    return new Promise((resolve) => execFileImpl(cmd, args, { timeout: 5000 }, (err) => resolve(!err)));
  }

  function remove(id) {
    const shot = shots.get(id);
    shots.delete(id);
    if (shot) fs.rm(shot.file, { force: true }, () => {});
  }

  function prune() {
    for (const [id, shot] of shots) if (now() - shot.at > KEEP_MS) remove(id);
  }

  async function capture(windowId) {
    if (!Number.isInteger(windowId) || windowId <= 0) return null;
    prune();
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const id = crypto.randomUUID();
    const file = path.join(dir, `${id}.jpg`);
    const ok = await run(getCapturePath(), platform.screenCaptureArgs(windowId, file));
    if (!ok || !fs.existsSync(file) || fs.statSync(file).size === 0) {
      fs.rm(file, { force: true }, () => {});
      return null;
    }
    await run(sipsPath, platform.shrinkImageArgs(file, MAX_EDGE)); // best effort: a full-size image still works
    shots.set(id, { file, at: now() });
    return id;
  }

  // The image as Claude's input format wants it, or null if it's gone.
  function read(id) {
    const shot = shots.get(id);
    if (!shot) return null;
    try {
      return { mediaType: 'image/jpeg', data: fs.readFileSync(shot.file).toString('base64') };
    } catch {
      shots.delete(id);
      return null;
    }
  }

  function clear() {
    for (const id of [...shots.keys()]) remove(id);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  return { capture, read, clear, has: (id) => shots.has(id) };
}

module.exports = { createScreenshots, MAX_EDGE };
