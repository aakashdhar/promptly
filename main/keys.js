'use strict';

// Key names as people see them on each system: the Mac's symbols, Windows' words.
// The renderer gets these through get-platform (src/renderer/utils/keys.js).

const MAC = { os: 'darwin', mod: '⌘', alt: '⌥', ctrl: '⌃', shift: '⇧', enter: '↵' };
const WINDOWS = { os: 'win32', mod: 'Ctrl', alt: 'Alt', ctrl: 'Ctrl', shift: 'Shift', enter: 'Enter' };

// Anything that isn't Windows gets the Mac set, as today.
function keysFor(platform) {
  return { ...(platform === 'win32' ? WINDOWS : MAC) };
}

// ['⌘', 'T'] → '⌘T' and ['⌥', 'Space'] → '⌥ Space' on a Mac; 'Ctrl+T' and 'Alt+Space' on
// Windows, where ⌃ and ⌘ are both Ctrl and a repeated key is named once.
function formatCombo(parts, platform) {
  if (platform === 'win32') return parts.filter((p, i) => parts.indexOf(p) === i).join('+');
  return parts.map((p, i) => (i > 0 && p.length > 1 ? ` ${p}` : p)).join('');
}

module.exports = { keysFor, formatCombo };
