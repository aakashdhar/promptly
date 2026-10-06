'use strict';

const fs = require('fs');

// Watches one project folder and asks for a rescan after a quiet spell. When the OS can't
// watch the folder (a network drive, a platform without recursive watching) the watcher gives
// up and the caller's focus/Refresh pokes still go through the same debounce, so rescans
// never overlap whichever way they were triggered.

const IGNORED_DIRS = new Set(['.git', 'node_modules']);

// filename is relative to the watched folder. Some platforms don't say which file changed
// (null), which still counts as a change.
function isIgnored(filename) {
  if (filename == null) return false;
  return String(filename).split(/[\\/]/).some((part) => IGNORED_DIRS.has(part));
}

function createFolderWatcher({ dir, onChange, debounceMs = 2000, watchImpl = fs.watch, timers = { setTimeout, clearTimeout } }) {
  let watcher = null;
  let timer = null;
  let running = false;
  let pending = false;
  let stopped = false;
  let failed = false;

  function schedule() {
    if (stopped) return;
    // Changes during a rescan may have been missed by it: remember them and run once more after.
    if (running) {
      pending = true;
      return;
    }
    if (timer !== null) timers.clearTimeout(timer);
    timer = timers.setTimeout(fire, debounceMs);
  }

  function fire() {
    timer = null;
    if (stopped) return;
    running = true;
    let result;
    try {
      result = onChange();
    } catch {
      // The rescan reports its own failures; one failing must not stop later ones.
      result = null;
    }
    if (result && typeof result.then === 'function') Promise.resolve(result).then(settle, settle);
    else settle();
  }

  function settle() {
    running = false;
    if (pending) {
      pending = false;
      schedule();
    }
  }

  function closeWatcher() {
    const w = watcher;
    watcher = null;
    if (!w) return;
    try {
      w.close();
    } catch {
      // already closed
    }
  }

  function start() {
    if (stopped || watcher) return;
    let w;
    try {
      w = watchImpl(dir, { recursive: true });
    } catch {
      failed = true;
      return;
    }
    watcher = w;
    failed = false;
    w.on('change', (_eventType, filename) => {
      if (w === watcher && !isIgnored(filename)) schedule();
    });
    // Stays attached after close so a late 'error' from a dead watcher is never unhandled.
    w.on('error', () => {
      if (w !== watcher) return;
      closeWatcher();
      failed = true;
    });
  }

  function stop() {
    stopped = true;
    pending = false;
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
    closeWatcher();
  }

  return {
    start,
    stop,
    poke: schedule,
    get failed() {
      return failed;
    },
  };
}

module.exports = { createFolderWatcher, isIgnored };
