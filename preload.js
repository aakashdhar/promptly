'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // renderer → main (invoke: async request/response)
  generatePrompt: (transcript, mode, options) =>
    ipcRenderer.invoke('generate-prompt', { transcript, mode, options }),

  copyToClipboard: (text) =>
    ipcRenderer.invoke('copy-to-clipboard', { text }),

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
  evaluatePrompt: (args) => ipcRenderer.invoke('evaluate-prompt', args),

  saveFile: (opts) =>
    ipcRenderer.invoke('save-file', opts),

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

  getTheme: () =>
    ipcRenderer.invoke('get-theme'),

  onThemeChanged: (callback) => {
    const cb = (_event, data) => callback(data)
    ipcRenderer.on('theme-changed', cb)
    return () => ipcRenderer.removeListener('theme-changed', cb)
  },

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

  onToggleExpand: (callback) => {
    const cb = () => callback()
    ipcRenderer.on('toggle-expand', cb)
    return () => ipcRenderer.removeListener('toggle-expand', cb)
  },

  updateMenuBarState: (state) =>
    ipcRenderer.invoke('update-menubar-state', state),

  setLastPrompt: (prompt) =>
    ipcRenderer.invoke('set-last-prompt', prompt),

  retryTranscription: () =>
    ipcRenderer.invoke('retry-transcription'),

  onTranscriptionSlowWarning: (callback) => {
    const cb = () => callback()
    ipcRenderer.on('transcription-slow-warning', cb)
    return () => ipcRenderer.removeListener('transcription-slow-warning', cb)
  },

  requestMicrophone: (options) =>
    ipcRenderer.invoke('request-microphone', options),

  openMicrophoneSettings: () =>
    ipcRenderer.invoke('open-microphone-settings'),

  claudeStatus: () =>
    ipcRenderer.invoke('claude-status'),

  claudeInstall: () =>
    ipcRenderer.invoke('claude-install'),

  claudeLogin: () =>
    ipcRenderer.invoke('claude-login'),

  getThemeSetting: () =>
    ipcRenderer.invoke('get-theme-setting'),

  setThemeSetting: (theme) =>
    ipcRenderer.invoke('set-theme-setting', { theme }),

  // Hold to talk, pill and preferences
  onHotkeyStart: (callback) => {
    const cb = () => callback()
    ipcRenderer.on('hotkey-start', cb)
    return () => ipcRenderer.removeListener('hotkey-start', cb)
  },

  onHotkeyStop: (callback) => {
    const cb = () => callback()
    ipcRenderer.on('hotkey-stop', cb)
    return () => ipcRenderer.removeListener('hotkey-stop', cb)
  },

  onHotkeyCancel: (callback) => {
    const cb = () => callback()
    ipcRenderer.on('hotkey-cancel', cb)
    return () => ipcRenderer.removeListener('hotkey-cancel', cb)
  },

  onRecordingContext: (callback) => {
    const cb = (_event, context) => callback(context)
    ipcRenderer.on('recording-context', cb)
    return () => ipcRenderer.removeListener('recording-context', cb)
  },

  onGenerationDelta: (callback) => {
    const cb = (_event, data) => callback(data)
    ipcRenderer.on('generation-delta', cb)
    return () => ipcRenderer.removeListener('generation-delta', cb)
  },

  onAccessibilityChanged: (callback) => {
    const cb = (_event, status) => callback(status)
    ipcRenderer.on('accessibility-changed', cb)
    return () => ipcRenderer.removeListener('accessibility-changed', cb)
  },

  onPillState: (callback) => {
    const cb = (_event, state) => callback(state)
    ipcRenderer.on('pill-state', cb)
    return () => ipcRenderer.removeListener('pill-state', cb)
  },

  onAudioLevel: (callback) => {
    const cb = (_event, level) => callback(level)
    ipcRenderer.on('audio-level', cb)
    return () => ipcRenderer.removeListener('audio-level', cb)
  },

  sendAudioLevel: (level) => ipcRenderer.send('audio-level', level),

  reportMode: (label) => ipcRenderer.send('mode-changed', label),

  getPreferences: () =>
    ipcRenderer.invoke('get-preferences'),

  setPreferences: (prefs) =>
    ipcRenderer.invoke('set-preferences', prefs),

  requestAccessibility: () =>
    ipcRenderer.invoke('request-accessibility'),

  accessibilityStatus: () =>
    ipcRenderer.invoke('accessibility-status'),

  openAccessibilitySettings: () =>
    ipcRenderer.invoke('open-accessibility-settings'),

  retryGeneration: () =>
    ipcRenderer.invoke('retry-generation'),

  cancelOperations: () =>
    ipcRenderer.invoke('cancel-operations'),

  onGenerationSlowWarning: (callback) => {
    const cb = () => callback()
    ipcRenderer.on('generation-slow-warning', cb)
    return () => ipcRenderer.removeListener('generation-slow-warning', cb)
  },
});
