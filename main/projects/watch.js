'use strict';

const fs = require('fs');

// Watches one project folder and asks for a rescan after a quiet spell. When the OS can't
// watch the folder (a network drive, a platform without recursive watching) the watcher gives
// up and the caller's focus/Refresh pokes still go through the same debounce, so rescans
// never overlap whichever way they were triggered.

// The same names as BUILTIN_DIRS in scan.js (which doesn't export it): the scan never reads
// inside these, so builds, dev servers and git writing there can't change what a rescan finds.
// Matched exactly, like the scan: a person's "Build" folder still counts.
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'vendor', 'venv', '.venv', '__pycache__', '.next', '.cache', 'target', 'coverage']);

// filename is relative to the watched folder. Some platforms don't say which file changed
// (null), which still counts as a change.
function isIgnored(filename) {
  if (filename == null) return false;
  return String(filename).split(/[\\/]/).some((part) => IGNORED_DIRS.has(part));
}

// onChange must always settle: while it runs, later changes only mark one more rescan as due.
function createFolderWatcher({
  dir,
  onChange,
  onError,
  debounceMs = 2000,
  maxWaitMs = 30000,
  watchImpl = fs.watch,
  timers = { setTimeout, clearTimeout },
  now = () => performance.now(),
}) {
  let watcher = null;
  let timer = null;
  let burstStart = null;
  let running = false;
  let pending = false;
  let stopped = false;
  let failed = false;
  let error = null;

  function schedule() {
    if (stopped) return;
    // Changes during a rescan may have been missed by it: remember them and run once more after.
    if (running) {
      pending = true;
      return;
    }
    if (timer !== null) timers.clearTimeout(timer);
    // Each change restarts the quiet period, but never past maxWaitMs from the burst's first
    // change, so a file written every second (a log, a sync client) can't hold rescans off.
    const t = now();
    if (burstStart === null) burstStart = t;
    timer = timers.setTimeout(fire, Math.max(0, Math.min(debounceMs, burstStart + maxWaitMs - t)));
  }

  function fire() {
    timer = null;
    burstStart = null;
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

  function fail(err) {
    failed = true;
    error = Object.freeze({ code: (err && err.code) || null, message: (err && err.message) || String(err) });
    if (!onError) return;
    try {
      onError(error);
    } catch {
      // Reporting the failure must not break the watcher's own state.
    }
  }

  function start() {
    if (stopped || watcher) return;
    let w;
    try {
      w = watchImpl(dir, { recursive: true });
    } catch (err) {
      fail(err);
      return;
    }
    watcher = w;
    failed = false;
    error = null;
    w.on('change', (_eventType, filename) => {
      if (w === watcher && !isIgnored(filename)) schedule();
    });
    // Stays attached after close so a late 'error' from a dead watcher is never unhandled.
    w.on('error', (err) => {
      if (w !== watcher) return;
      closeWatcher();
      fail(err);
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
    // { code, message } of the failure behind `failed`; null while watching.
    get error() {
      return error;
    },
  };
}

module.exports = { createFolderWatcher, isIgnored, IGNORED_DIRS };
