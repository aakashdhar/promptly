'use strict';

// Runs native/helper (promptly-helper) and talks to it in JSON lines. The helper watches the
// hold-to-talk key, reports the app you're in and the text you've selected.

const fs = require('fs');
const { spawn } = require('child_process');

const REQUEST_TIMEOUT_MS = 1500;
const MAX_RESTARTS = 3;

function createHelper({ binaryPath, onHotkey = () => {}, onStatus = () => {}, log, spawnImpl = spawn }) {
  let child = null;
  let buffer = '';
  let nextId = 1;
  let restarts = 0;
  let stopped = false;
  let lastStatus = { trusted: false, tap: false };
  const pending = new Map();

  function handleMessage(msg) {
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, timer } = pending.get(msg.id);
      clearTimeout(timer);
      pending.delete(msg.id);
      resolve(msg);
    }
    if (msg.type === 'hotkey') onHotkey(msg.phase);
    if (msg.type === 'status' || msg.type === 'ready') {
      const next = { trusted: !!msg.trusted, tap: !!msg.tap };
      const changed = next.trusted !== lastStatus.trusted || next.tap !== lastStatus.tap;
      lastStatus = next;
      if (changed || msg.type === 'ready') onStatus(next);
    }
  }

  function start() {
    if (!binaryPath || stopped) return false;
    // A build without the helper just runs without hold-to-talk.
    if (!fs.existsSync(binaryPath)) return false;
    try {
      child = spawnImpl(binaryPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      log?.warn('Helper failed to start', err.message);
      child = null;
      return false;
    }
    child.stdout.on('data', (d) => {
      buffer += d.toString();
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        try { handleMessage(JSON.parse(line)); } catch { /* ignore malformed line */ }
      }
    });
    child.stderr.on('data', (d) => log?.warn('Helper:', d.toString().trim()));
    child.on('error', (err) => {
      // A failed spawn emits 'error' without always emitting 'exit'.
      log?.warn('Helper error', err.message);
      child = null;
    });
    child.on('exit', (code, signal) => {
      child = null;
      for (const { resolve, timer } of pending.values()) { clearTimeout(timer); resolve(null); }
      pending.clear();
      if (stopped) return;
      log?.warn(`Helper exited (${signal || code})`);
      if (restarts < MAX_RESTARTS) {
        restarts++;
        setTimeout(start, 500 * restarts);
      }
    });
    return true;
  }

  // Sends a command and resolves with the reply, or null if the helper isn't running or slow.
  function request(cmd, payload = {}) {
    if (!child) return Promise.resolve(null);
    const id = nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => { pending.delete(id); resolve(null); }, REQUEST_TIMEOUT_MS);
      pending.set(id, { resolve, timer });
      try {
        child.stdin.write(JSON.stringify({ cmd, id, ...payload }) + '\n');
      } catch {
        clearTimeout(timer);
        pending.delete(id);
        resolve(null);
      }
    });
  }

  function stop() {
    stopped = true;
    if (child) {
      try { child.stdin.end(); } catch { /* ignore */ }
      try { child.kill(); } catch { /* ignore */ }
    }
  }

  return {
    start,
    stop,
    isRunning: () => !!child,
    status: () => lastStatus,
    configure: (hotkey) => request('configure', { hotkey }),
    context: () => request('context'),
    requestAccess: () => request('requestAccess'),
    refreshStatus: () => request('status'),
  };
}

module.exports = { createHelper };
