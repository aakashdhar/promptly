'use strict';

const fs = require('fs');
const path = require('path');

const MAX_BYTES = 1024 * 1024;

// Appends timestamped lines to <dir>/main.log, keeping one rotated main.old.log.
// No dependency on Electron, so it can be unit-tested and used before app is ready.
function createLogger(dir) {
  const file = path.join(dir, 'main.log');

  function rotateIfNeeded() {
    try {
      if (fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, path.join(dir, 'main.old.log'));
    } catch { /* no file yet */ }
  }

  function write(level, args) {
    const text = args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    const line = `${new Date().toISOString()} [${level}] ${text}\n`;
    try {
      fs.mkdirSync(dir, { recursive: true });
      rotateIfNeeded();
      fs.appendFileSync(file, line);
    } catch { /* logging must never throw */ }
  }

  return {
    file,
    info: (...args) => write('info', args),
    warn: (...args) => write('warn', args),
    error: (...args) => write('error', args),
  };
}

module.exports = { createLogger };
