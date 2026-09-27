'use strict';

const fs = require('fs');
const path = require('path');

// Reads and writes config.json in userData. Writes go to a temp file and are renamed
// into place, so a crash mid-write can never leave a truncated config behind.
// A file that exists but won't parse (a hand edit with a stray comma) is moved aside before
// anything writes over it, so the user's paths, dictionary and notes can be recovered.
function createConfigStore(filePath, { onCorrupt } = {}) {
  function read() {
    let text;
    try { text = fs.readFileSync(filePath, 'utf8'); } catch { return {}; }
    try {
      const data = JSON.parse(text);
      if (data && typeof data === 'object' && !Array.isArray(data)) return data;
    } catch { /* handled below */ }
    const backup = `${filePath}.corrupt-${Date.now()}`;
    try { fs.renameSync(filePath, backup); onCorrupt?.(backup); } catch { /* keep going with defaults */ }
    return {};
  }

  function write(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, filePath);
  }

  function update(patch) {
    const next = { ...read(), ...patch };
    write(next);
    return next;
  }

  return { read, write, update };
}

module.exports = { createConfigStore };
