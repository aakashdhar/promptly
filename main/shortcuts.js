'use strict';

// Registers the recording hotkey, falling back to a second key when another app owns the
// first, and tells the user which one is active. Electron objects are passed in so this can
// be tested without Electron.
function registerRecordingShortcut({ globalShortcut, primary, fallback, onTrigger, notify, log }) {
  if (globalShortcut.register(primary, onTrigger)) return primary;
  if (globalShortcut.register(fallback, onTrigger)) {
    log?.warn(`${primary} unavailable, using ${fallback}`);
    notify(`${describe(primary)} is used by another app, so Promptly is listening on ${describe(fallback)} instead.`);
    return fallback;
  }
  log?.warn('No recording shortcut could be registered');
  notify('Promptly could not register a recording shortcut. Open it from the menu bar icon.');
  return null;
}

// "Alt+Space" -> "Option+Space", "Control+`" -> "Control+`"
function describe(accelerator) {
  return accelerator.replace(/\bAlt\b/g, 'Option').replace(/\bCommandOrControl\b/g, 'Command');
}

module.exports = { registerRecordingShortcut, describe };
