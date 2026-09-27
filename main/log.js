'use strict';

const fs = require('fs');
const path = require('path');

const MAX_BYTES = 1024 * 1024;

// Appends timestamped lines to <dir>/main.log, keeping one rotated main.old.log.
// No dependency on Electron, so it can be unit-tested and used before app is ready.
// Circular objects and BigInts make JSON.stringify throw; a log line must never do that.
function format(a) {
  if (a instanceof Error) return `${a.message}\n${a.stack}`;
  if (typeof a === 'string') return a;
  try { return JSON.stringify(a) ?? String(a); } catch { return String(a); }
}

function createLogger(dir) {
  const file = path.join(dir, 'main.log');

  function rotateIfNeeded() {
    try {
      if (fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, path.join(dir, 'main.old.log'));
    } catch { /* no file yet */ }
  }

  function write(level, args) {
    const text = args.map(format).join(' ');
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
