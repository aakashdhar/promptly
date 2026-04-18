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

  transcribeAudio: (arrayBuffer) =>
    ipcRenderer.invoke('transcribe-audio', arrayBuffer),

  // main → renderer (on: event listener registration)
  onShortcutTriggered: (callback) =>
    ipcRenderer.on('shortcut-triggered', callback),

  onShortcutConflict: (callback) =>
    ipcRenderer.on('shortcut-conflict', callback),
});
