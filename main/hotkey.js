'use strict';

// Hotkey presets shown in Settings. `accelerator` is used with Electron's globalShortcut when
// the helper can't watch the keyboard (no Accessibility permission): tap-to-toggle only.
// `helper` is what promptly-helper watches for hold-to-talk. Modifier-only keys need the helper.
const HOTKEY_PRESETS = {
  'option-space': {
    label: 'Option + Space',
    accelerator: 'Alt+Space',
    helper: { keyCode: 49, modifiers: ['option'], modifierOnly: false },
  },
  'right-option': {
    label: 'Right Option (hold)',
    accelerator: null,
    helper: { keyCode: 61, modifiers: [], modifierOnly: true },
  },
  fn: {
    label: 'Fn / Globe (hold)',
    accelerator: null,
    helper: { keyCode: 63, modifiers: [], modifierOnly: true },
  },
  'control-option-space': {
    label: 'Control + Option + Space',
    accelerator: 'Control+Alt+Space',
    helper: { keyCode: 49, modifiers: ['control', 'option'], modifierOnly: false },
  },
  'command-shift-space': {
    label: 'Command + Shift + Space',
    accelerator: 'Command+Shift+Space',
    helper: { keyCode: 49, modifiers: ['command', 'shift'], modifierOnly: false },
  },
};
const DEFAULT_HOTKEY = 'option-space';

function getPreset(key) {
  return HOTKEY_PRESETS[key] || HOTKEY_PRESETS[DEFAULT_HOTKEY];
}

// Turns raw key down/up events into start/stop/cancel:
//   • a quick tap (< holdMs) starts recording, and the next press stops it
//   • holding the key records until it's released
function createHoldToTalk({ isRecording, onStart, onStop, onCancel, holdMs = 350, now = Date.now }) {
  let pressedAt = null;
  let startedThisPress = false;

  function down() {
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

  return { down, up, cancel };
}

module.exports = { HOTKEY_PRESETS, DEFAULT_HOTKEY, getPreset, createHoldToTalk };
