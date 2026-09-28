'use strict';

const fs = require('fs');
const path = require('path');

// Reads and writes config.json in userData. Writes go to a temp file and are renamed
// into place, so a crash mid-write can never leave a truncated config behind.
// A file that exists but won't parse (a hand edit with a stray comma) is moved aside before
// anything writes over it, so the user's paths, dictionary and notes can be recovered.
// read() is called several times per request, so the parsed file is kept and only read again
// when its modification time or size changes (an edit by hand is still picked up). Callers get
// their own copy, so changing it can't change what the next caller sees.
// A file changed in the last RACY_MS isn't cached: some file systems (NTFS, FAT, network
// drives) keep coarse timestamps, so an edit in the same tick with the same size would look
// unchanged — the same guard git uses for its index.
const RACY_MS = 2000;
function createConfigStore(filePath, { onCorrupt } = {}) {
  let cache = null; // { mtimeMs, size, data }

  function read() {
    let stat;
    try { stat = fs.statSync(filePath); } catch { cache = null; return {}; }
    if (cache && cache.mtimeMs === stat.mtimeMs && cache.size === stat.size) return structuredClone(cache.data);
    let text;
    try { text = fs.readFileSync(filePath, 'utf8'); } catch { return {}; }
    try {
      const data = JSON.parse(text);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        cache = Date.now() - stat.mtimeMs >= RACY_MS ? { mtimeMs: stat.mtimeMs, size: stat.size, data } : null;
        return structuredClone(data);
      }
    } catch { /* handled below */ }
    cache = null;
    const backup = `${filePath}.corrupt-${Date.now()}`;
    try { fs.renameSync(filePath, backup); onCorrupt?.(backup); } catch { /* keep going with defaults */ }
    return {};
  }

  function write(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, filePath);
    cache = null;
  }

  function update(patch) {
    const next = { ...read(), ...patch };
    write(next);
    return next;
  }

  return { read, write, update };
}

module.exports = { createConfigStore };
