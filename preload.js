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

  transcribeAudio: (arrayBuffer, language) =>
    ipcRenderer.invoke('transcribe-audio', arrayBuffer, language),

  showLanguageMenu: (currentLanguage, languages) =>
    ipcRenderer.invoke('show-language-menu', { currentLanguage, languages }),

  onLanguageSelected: (callback) =>
    ipcRenderer.on('language-selected', (_event, code) => callback(code)),

  // splash → main
  splashDone: () =>
    ipcRenderer.invoke('splash-done'),

  splashCheckCLI: () =>
    ipcRenderer.invoke('splash-check-cli'),

  splashCheckWhisper: () =>
    ipcRenderer.invoke('splash-check-whisper'),

  splashOpenURL: (url) =>
    ipcRenderer.invoke('splash-open-url', url),

  requestMic: () =>
    ipcRenderer.invoke('request-mic'),

  // main → renderer (on: event listener registration)
  onShortcutTriggered: (callback) =>
    ipcRenderer.on('shortcut-triggered', callback),

  onShortcutConflict: (callback) =>
    ipcRenderer.on('shortcut-conflict', callback),

  getTheme: () =>
    ipcRenderer.invoke('get-theme'),

  onThemeChanged: (callback) =>
    ipcRenderer.on('theme-changed', (_event, data) => callback(data)),
});
