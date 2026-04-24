'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // renderer → main (invoke: async request/response)
  generatePrompt: (transcript, mode, options) =>
    ipcRenderer.invoke('generate-prompt', { transcript, mode, options }),

  copyToClipboard: (text) =>
    ipcRenderer.invoke('copy-to-clipboard', { text }),

  checkClaudePath: () =>
    ipcRenderer.invoke('check-claude-path'),

  resizeWindow: (height) =>
    ipcRenderer.invoke('resize-window', { height }),

  setWindowButtonsVisible: (visible) =>
    ipcRenderer.invoke('set-window-buttons-visible', { visible }),

  showModeMenu: (currentMode) =>
    ipcRenderer.invoke('show-mode-menu', { currentMode }),

  onModeSelected: (callback) =>
    ipcRenderer.on('mode-selected', (_event, key) => callback(key)),

  showToneMenu: (currentTone) =>
    ipcRenderer.invoke('show-tone-menu', { currentTone }),

  onToneSelected: (callback) =>
    ipcRenderer.on('tone-selected', (_event, key) => callback(key)),

  transcribeAudio: (arrayBuffer) =>
    ipcRenderer.invoke('transcribe-audio', arrayBuffer),

  generateRaw: (systemPrompt) =>
    ipcRenderer.invoke('generate-raw', { systemPrompt }),

  saveFile: (opts) =>
    ipcRenderer.invoke('save-file', opts),

  resizeWindowWidth: (width) =>
    ipcRenderer.invoke('resize-window-width', { width }),

  setWindowSize: (width, height) =>
    ipcRenderer.invoke('set-window-size', { width, height }),

  onShowHistory: (callback) =>
    ipcRenderer.on('show-history', () => callback()),

  // splash → main
  splashDone: () =>
    ipcRenderer.invoke('splash-done'),

  splashCheckCLI: () =>
    ipcRenderer.invoke('splash-check-cli'),

  splashCheckWhisper: () =>
    ipcRenderer.invoke('splash-check-whisper'),

  splashOpenURL: (url) =>
    ipcRenderer.invoke('splash-open-url', url),

  // main → renderer (on: event listener registration)
  onShortcutTriggered: (callback) =>
    ipcRenderer.on('shortcut-triggered', callback),

  onShowShortcuts: (callback) =>
    ipcRenderer.on('show-shortcuts', () => callback()),

  onShortcutPause: (callback) =>
    ipcRenderer.on('shortcut-pause', () => callback()),

  onShortcutConflict: (callback) =>
    ipcRenderer.on('shortcut-conflict', callback),

  getTheme: () =>
    ipcRenderer.invoke('get-theme'),

  onThemeChanged: (callback) =>
    ipcRenderer.on('theme-changed', (_event, data) => callback(data)),

  triggerUninstall: () =>
    ipcRenderer.invoke('uninstall-promptly'),

  getStoredPaths: () =>
    ipcRenderer.invoke('get-stored-paths'),

  savePaths: (paths) =>
    ipcRenderer.invoke('save-paths', paths),

  browseForBinary: () =>
    ipcRenderer.invoke('browse-for-binary'),

  recheckPaths: () =>
    ipcRenderer.invoke('recheck-paths'),

  onOpenSettings: (cb) =>
    ipcRenderer.on('open-settings', () => cb()),

  updateMenuBarState: (state) =>
    ipcRenderer.invoke('update-menubar-state', state),
});
