# FEATURE-013 — Path Configuration Panel

## Problem
Team members with non-standard binary install paths (nvm, pyenv, conda, volta)
hit "Claude CLI not found" or "Whisper not found" on the splash screen with
zero recourse — they cannot fix it without a new app build from the developer.
This creates a support burden and blocks onboarding for non-standard setups.

## Solution
A gear icon (⚙) always visible in the splash screen top-right corner opens
a path configuration panel. Users can paste or browse to the correct binary
paths, see a live green/red connected status, and hit Save & Recheck to
rerun the checks without restarting the app. Paths persist via electron-store.

## Acceptance criteria
- [ ] Gear icon always visible in splash top-right at all times
- [ ] Clicking gear opens path config panel (slides in over splash content)
- [ ] Claude CLI path field shows green dot + "Connected: /path" when valid
- [ ] Claude CLI path field shows red dot + "Not found — paste path manually" when missing
- [ ] Whisper path field same green/red treatment
- [ ] Browse button opens macOS native file picker and fills the input
- [ ] Save & Recheck saves both paths to electron-store and reruns live checks
- [ ] If both pass after recheck: shows "All checks passed" then auto-launches
- [ ] If a path is wrong after recheck: shows specific error message inline
- [ ] Failed check label in main splash shows "tap ⚙ to set path" hint text — inline after the label text, font-size 10px, opacity 0.5, margin-left 4px
- [ ] Back button closes panel without saving
- [ ] Tray menu has "Path configuration..." option — sends open-settings to main renderer (full in-app panel deferred to future SETTINGS state feature; console stub acceptable for this feature)
- [ ] ⌘, keyboard shortcut opens settings from main app after launch
- [ ] Paths saved via electron-store persist across full app restarts
- [ ] On next launch, stored paths are tried first before auto-resolution

## Files in scope
- splash.html — gear icon, path config panel HTML + JavaScript
- main.js — 4 new IPC handlers, electron-store integration, tray menu update, ⌘, shortcut
- preload.js — 4 new contextBridge exposures
- App.jsx — listen for open-settings event
- ShortcutsPanel.jsx — add ⌘, to Navigation group

## Files out of scope
All other React components, all vibe docs except DECISIONS.md CODEBASE.md TASKS.md

## IPC channels added
- get-stored-paths → returns { claudePath, whisperPath } from electron-store
- save-paths → saves { claudePath, whisperPath } to electron-store + updates runtime vars
- browse-for-binary → opens file picker dialog, returns { path }
- recheck-paths → reruns resolveClaudePath + resolveWhisperPath, returns results

## Dependencies
- None — paths stored via `readConfig()` / `writeConfig()` using Node.js built-in `fs`
  and `app.getPath('userData')`. Zero new runtime npm dependencies.
