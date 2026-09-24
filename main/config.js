'use strict';

const fs = require('fs');
const path = require('path');

// Reads and writes config.json in userData. Writes go to a temp file and are renamed
// into place, so a crash mid-write can never leave a truncated config behind.
function createConfigStore(filePath) {
  function read() {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return {}; }
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
