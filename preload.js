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

  // pill window lifecycle
  showPill: () =>
    ipcRenderer.invoke('show-pill'),

  switchToMain: () =>
    ipcRenderer.invoke('switch-to-main'),

  // pill.html → main (fire-and-forget from pill window)
  pillStop: () =>
    ipcRenderer.send('pill-stop'),

  pillDismiss: () =>
    ipcRenderer.send('pill-dismiss'),

  // main → index.html (forwarded pill actions)
  onPillAction: (callback) =>
    ipcRenderer.on('pill-action', (_event, payload) => callback(payload)),

  // main → renderer (on: event listener registration)
  onShortcutTriggered: (callback) =>
    ipcRenderer.on('shortcut-triggered', callback),

  onShortcutConflict: (callback) =>
    ipcRenderer.on('shortcut-conflict', callback),
});
