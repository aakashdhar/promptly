'use strict';

// Hotkey presets shown in Settings. `accelerator` is used with Electron's globalShortcut when
// the helper can't watch the keyboard (no Accessibility permission): tap-to-toggle only.
// `helper` is what promptly-helper watches for hold-to-talk. Modifier-only keys need the helper.
// `short` and `action` are how the app names the shortcut in hints ("Double-tap Control and talk").
// Each system has its own list; the Mac's is below, Windows' after it.
const MAC_PRESETS = {
  'double-control': {
    label: 'Double-tap Control',
    short: 'double-tap ⌃',
    action: 'Double-tap Control',
    accelerator: null,
    // Either Control key. Double-tap starts, one tap stops; double-tap and hold is hold to talk.
    helper: { keyCode: 59, modifiers: [], modifierOnly: true, doubleTap: true },
  },
  'option-space': {
    label: 'Option + Space',
    short: '⌥ Space',
    action: 'Hold ⌥ Space',
    accelerator: 'Alt+Space',
    helper: { keyCode: 49, modifiers: ['option'], modifierOnly: false },
  },
  'right-option': {
    label: 'Right Option (hold)',
    short: 'right ⌥',
    action: 'Hold right ⌥',
    accelerator: null,
    helper: { keyCode: 61, modifiers: [], modifierOnly: true },
  },
  fn: {
    label: 'Fn / Globe (hold)',
    short: 'Fn',
    action: 'Hold Fn',
    accelerator: null,
    helper: { keyCode: 63, modifiers: [], modifierOnly: true },
  },
  'control-option-space': {
    label: 'Control + Option + Space',
    short: '⌃⌥ Space',
    action: 'Hold ⌃⌥ Space',
    accelerator: 'Control+Alt+Space',
    helper: { keyCode: 49, modifiers: ['control', 'option'], modifierOnly: false },
  },
  'command-shift-space': {
    label: 'Command + Shift + Space',
    short: '⌘⇧ Space',
    action: 'Hold ⌘⇧ Space',
    accelerator: 'Command+Shift+Space',
    helper: { keyCode: 49, modifiers: ['command', 'shift'], modifierOnly: false },
  },
};

// Windows: the helper (native/helper-win) watches Windows virtual-key codes, and modifiers are
// named control / alt / shift. There's no Fn key Windows can see.
const WINDOWS_PRESETS = {
  'double-control': {
    label: 'Double-tap Ctrl',
    short: 'double-tap Ctrl',
    action: 'Double-tap Ctrl',
    accelerator: null,
    // VK_CONTROL: either Ctrl key.
    helper: { keyCode: 0x11, modifiers: [], modifierOnly: true, doubleTap: true },
  },
  'alt-space': {
    label: 'Alt + Space',
    short: 'Alt+Space',
    action: 'Hold Alt+Space',
    accelerator: 'Alt+Space',
    helper: { keyCode: 0x20, modifiers: ['alt'], modifierOnly: false },
  },
  'right-alt': {
    // On layouts with AltGr (German, French, …) right Alt is AltGr, which Windows reports as
    // Ctrl + Alt; the helper treats that as right Alt too.
    label: 'Right Alt (hold)',
    short: 'right Alt',
    action: 'Hold right Alt',
    accelerator: null,
    helper: { keyCode: 0xA5, modifiers: [], modifierOnly: true },
  },
  'ctrl-alt-space': {
    label: 'Ctrl + Alt + Space',
    short: 'Ctrl+Alt+Space',
    action: 'Hold Ctrl+Alt+Space',
    accelerator: 'Control+Alt+Space',
    helper: { keyCode: 0x20, modifiers: ['control', 'alt'], modifierOnly: false },
  },
  'ctrl-shift-space': {
    label: 'Ctrl + Shift + Space',
    short: 'Ctrl+Shift+Space',
    action: 'Hold Ctrl+Shift+Space',
    accelerator: 'Control+Shift+Space',
    helper: { keyCode: 0x20, modifiers: ['control', 'shift'], modifierOnly: false },
  },
};

const DEFAULT_HOTKEY = 'double-control';

// The presets for a system (anything that isn't Windows gets the Mac list).
function presetsFor(platform = process.platform) {
  return platform === 'win32' ? WINDOWS_PRESETS : MAC_PRESETS;
}

// What works without the helper (Electron's globalShortcut, tap to start and stop).
function fallbackHotkeyFor(platform = process.platform) {
  return platform === 'win32' ? 'alt-space' : 'option-space';
}

// The presets for the system Promptly is running on.
const HOTKEY_PRESETS = presetsFor();
const FALLBACK_HOTKEY = fallbackHotkeyFor();

// A key from the other system's list (a config copied from a Mac) falls back to the default.
function getPreset(key, platform = process.platform) {
  const presets = presetsFor(platform);
  return presets[key] || presets[DEFAULT_HOTKEY];
}

// How hints name the talk shortcut: always the one you chose. A key that needs the helper
// (double-tap Control, Right Option, Fn) says so while Accessibility is off, and names the
// Option-Space (Windows: Alt+Space) stand-in that works meanwhile, instead of quietly swapping in the stand-in.
function hotkeyWords(key, { helperActive, platform = process.platform }) {
  const preset = getPreset(key, platform);
  if (helperActive) return { short: preset.short, action: preset.action, needsAccess: false };
  if (preset.accelerator) return { short: preset.short, action: `Press ${preset.short}`, needsAccess: false };
  const fallback = presetsFor(platform)[fallbackHotkeyFor(platform)];
  return { short: preset.short, action: preset.action, needsAccess: true, fallback: `Press ${fallback.short}` };
}

// Turns raw key down/up events into start/stop/cancel:
//   • a quick tap (< holdMs) starts recording, and the next press stops it
//   • holding the key records until it's released
//   • double-tap keys: a single tap while recording stops it (see tap())
function createHoldToTalk({ isRecording, onStart, onStop, onCancel, holdMs = 350, now = Date.now }) {
  let pressedAt = null;
  let startedThisPress = false;
  let tapStoppedAt = -Infinity;

  function down() {
    // Double-tapping to stop: the first tap stopped it, so the second press must not restart it.
    if (now() - tapStoppedAt < 700) return;
    pressedAt = now();
    if (isRecording()) {
      startedThisPress = false;
      onStop();
    } else {
      startedThisPress = true;
      onStart();
    }
  }

  function up() {
    if (startedThisPress && pressedAt != null && now() - pressedAt >= holdMs) onStop();
    startedThisPress = false;
    pressedAt = null;
  }

  // A modifier-only hotkey turned out to be part of another shortcut: drop that recording.
  function cancel() {
    if (startedThisPress) onCancel();
    startedThisPress = false;
    pressedAt = null;
  }

  // One clean tap of a double-tap key: stops a recording, and does nothing otherwise (the
  // helper reports the second tap of a double as down/up, which starts one).
  function tap() {
    if (!isRecording()) return;
    tapStoppedAt = now();
    onStop();
  }

  return { down, up, cancel, tap };
}

module.exports = { HOTKEY_PRESETS, DEFAULT_HOTKEY, FALLBACK_HOTKEY, presetsFor, fallbackHotkeyFor, getPreset, hotkeyWords, createHoldToTalk };
