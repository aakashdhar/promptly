'use strict';

// Hotkey presets shown in Settings. `accelerator` is used with Electron's globalShortcut when
// the helper can't watch the keyboard (no Accessibility permission): tap-to-toggle only.
// `helper` is what promptly-helper watches for hold-to-talk. Modifier-only keys need the helper.
// `short` and `action` are how the app names the shortcut in hints ("Double-tap Control and talk").
const HOTKEY_PRESETS = {
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
const DEFAULT_HOTKEY = 'double-control';
// What works without Accessibility (Electron's globalShortcut, tap to start and stop).
const FALLBACK_HOTKEY = 'option-space';

function getPreset(key) {
  return HOTKEY_PRESETS[key] || HOTKEY_PRESETS[DEFAULT_HOTKEY];
}

// How hints name the talk shortcut: always the one you chose. A key that needs the helper
// (double-tap Control, Right Option, Fn) says so while Accessibility is off, and names the
// ⌥ Space stand-in that works meanwhile, instead of quietly swapping in the stand-in.
function hotkeyWords(key, { helperActive }) {
  const preset = getPreset(key);
  if (helperActive) return { short: preset.short, action: preset.action, needsAccess: false };
  if (preset.accelerator) return { short: preset.short, action: `Press ${preset.short}`, needsAccess: false };
  const fallback = HOTKEY_PRESETS[FALLBACK_HOTKEY];
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

module.exports = { HOTKEY_PRESETS, DEFAULT_HOTKEY, FALLBACK_HOTKEY, getPreset, hotkeyWords, createHoldToTalk };
