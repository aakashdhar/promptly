'use strict';

// Key names as people see them on each system: the Mac's symbols, Windows' words.
// The renderer gets these through get-platform (src/renderer/utils/keys.js).

const MAC = { os: 'darwin', mod: '⌘', alt: '⌥', ctrl: '⌃', shift: '⇧', enter: '↵' };
const WINDOWS = { os: 'win32', mod: 'Ctrl', alt: 'Alt', ctrl: 'Ctrl', shift: 'Shift', enter: 'Enter' };

// Anything that isn't Windows gets the Mac set, as today.
function keysFor(platform) {
  return { ...(platform === 'win32' ? WINDOWS : MAC) };
}

// ['⌘', 'T'] → '⌘T' on a Mac, ['Ctrl', 'T'] → 'Ctrl+T' on Windows.
function formatCombo(parts, platform) {
  return parts.join(platform === 'win32' ? '+' : '');
}

module.exports = { keysFor, formatCombo };
