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

  onModeSelected: (callback) => {
    const cb = (_event, key) => callback(key)
    ipcRenderer.on('mode-selected', cb)
    return () => ipcRenderer.removeListener('mode-selected', cb)
  },

  showToneMenu: (currentTone) =>
    ipcRenderer.invoke('show-tone-menu', { currentTone }),

  onToneSelected: (callback) => {
    const cb = (_event, key) => callback(key)
    ipcRenderer.on('tone-selected', cb)
    return () => ipcRenderer.removeListener('tone-selected', cb)
  },

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

  onShowHistory: (callback) => {
    const cb = () => callback()
    ipcRenderer.on('show-history', cb)
    return () => ipcRenderer.removeListener('show-history', cb)
  },

  // splash → main
  splashDone: () =>
    ipcRenderer.invoke('splash-done'),

  splashCheckCLI: () =>
    ipcRenderer.invoke('splash-check-cli'),

  splashCheckWhisper: () =>
    ipcRenderer.invoke('splash-check-whisper'),

  splashOpenURL: (url) =>
    ipcRenderer.invoke('splash-open-url', url),

  checkSetupComplete: () =>
    ipcRenderer.invoke('check-setup-complete'),

  setSetupComplete: () =>
    ipcRenderer.invoke('set-setup-complete'),

  resetSetupComplete: () =>
    ipcRenderer.invoke('reset-setup-complete'),

  reopenWizard: () =>
    ipcRenderer.invoke('reopen-wizard'),

  checkClaude: () =>
    ipcRenderer.invoke('check-claude'),

  checkWhisper: () =>
    ipcRenderer.invoke('check-whisper'),

  checkFfmpeg: () =>
    ipcRenderer.invoke('check-ffmpeg'),

  checkWhisperModel: () =>
    ipcRenderer.invoke('check-whisper-model'),

  downloadWhisperModel: () =>
    ipcRenderer.invoke('download-whisper-model'),

  onWhisperDownloadProgress: (callback) => {
    ipcRenderer.on('whisper-download-progress', (_e, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('whisper-download-progress');
  },

  // main → renderer (on: event listener registration)
  onShortcutTriggered: (callback) => {
    ipcRenderer.on('shortcut-triggered', callback)
    return () => ipcRenderer.removeListener('shortcut-triggered', callback)
  },

  onShowShortcuts: (callback) => {
    const cb = () => callback()
    ipcRenderer.on('show-shortcuts', cb)
    return () => ipcRenderer.removeListener('show-shortcuts', cb)
  },

  onShortcutPause: (callback) => {
    const cb = () => callback()
    ipcRenderer.on('shortcut-pause', cb)
    return () => ipcRenderer.removeListener('shortcut-pause', cb)
  },

  onShortcutConflict: (callback) => {
    ipcRenderer.on('shortcut-conflict', callback)
    return () => ipcRenderer.removeListener('shortcut-conflict', callback)
  },

  getTheme: () =>
    ipcRenderer.invoke('get-theme'),

  onThemeChanged: (callback) => {
    const cb = (_event, data) => callback(data)
    ipcRenderer.on('theme-changed', cb)
    return () => ipcRenderer.removeListener('theme-changed', cb)
  },

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

  onOpenSettings: (callback) => {
    const cb = () => callback()
    ipcRenderer.on('open-settings', cb)
    return () => ipcRenderer.removeListener('open-settings', cb)
  },

  updateMenuBarState: (state) =>
    ipcRenderer.invoke('update-menubar-state', state),

  setLastPrompt: (prompt) =>
    ipcRenderer.invoke('set-last-prompt', prompt),
});
