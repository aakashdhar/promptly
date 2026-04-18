'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // renderer → main (invoke: async request/response)
  generatePrompt: (transcript, mode) =>
    ipcRenderer.invoke('generate-prompt', { transcript, mode }),

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

  transcribeAudio: (arrayBuffer) =>
    ipcRenderer.invoke('transcribe-audio', arrayBuffer),

  // splash → main
  splashDone: () =>
    ipcRenderer.invoke('splash-done'),

  splashCheckCLI: () =>
    ipcRenderer.invoke('splash-check-cli'),

  splashOpenURL: (url) =>
    ipcRenderer.invoke('splash-open-url', url),

  requestMic: () =>
    ipcRenderer.invoke('request-mic'),

  // main → renderer (on: event listener registration)
  onShortcutTriggered: (callback) =>
    ipcRenderer.on('shortcut-triggered', callback),

  onShortcutConflict: (callback) =>
    ipcRenderer.on('shortcut-conflict', callback),
});
