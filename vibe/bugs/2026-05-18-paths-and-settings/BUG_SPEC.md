# BUG_SPEC — paths-and-settings

## 1. Bug summary
Two P0 bugs sharing the same root cause: ffmpeg path is not configurable anywhere, and there is no visible settings button in the main app UI.

## 2. Files involved
- `main.js` — `resolveFfmpegPath()` (line 581), `save-paths` (1501), `get-stored-paths` (1493), `recheck-paths` (1519), module globals (208–210), startup init (737–738)
- `src/renderer/components/ExpandedTransportBar.jsx` — gear button missing
- `src/renderer/components/SettingsPanel.jsx` — ffmpeg path field missing
- `splash.html` — `s2-both-notfound` (808–819), `pathPanel` (972–1010), `saveRecheckBtn` handler (1101–1125), `runChecks()` failure hints (1134–1155)

## 3. Root cause hypothesis

**BUG 1 (splash path inputs):**
- `s2-both-notfound` wizard state renders install commands but no whisper path input — user is stuck if Whisper+ffmpeg are missing and already installed at non-standard paths
- `resolveFfmpegPath()` never reads `config.ffmpegPath` — even if we store it, it's ignored on next resolve
- `save-paths` IPC handler only destructures `{ claudePath, whisperPath }` — `ffmpegPath` is silently dropped
- `get-stored-paths` returns only `{ claudePath, whisperPath }` — frontend can't load a saved ffmpeg path
- `recheck-paths` doesn't re-resolve or return ffmpeg status

**BUG 2 (settings not opening):**
- `ExpandedTransportBar.jsx` receives `onOpenSettings` prop (line 16) but renders zero buttons that call it — no visible gear icon in the main app UI
- `SettingsPanel.jsx` has no ffmpeg path field; even with the backend fixed, settings would still not expose ffmpeg path management

## 4. Confidence: HIGH
All root causes verified by reading actual source files. The prop chain (App→ExpandedView→ExpandedTransportBar) is complete — the only missing piece is a rendered button in ExpandedTransportBar.

## 5. Blast radius
- Fixing `save-paths` / `get-stored-paths` / `recheck-paths` in main.js is additive and doesn't affect existing claude/whisper path saving
- Adding gear button to ExpandedTransportBar is purely additive
- Adding ffmpeg to SettingsPanel is additive
- splash.html changes are additive to existing states

## 6. Fix approach
See BUG_PLAN.md.

## 7. What NOT to change
- `preload.js` — all IPC bridges already exist
- `App.jsx` — `openSettings()` already correct
- `ExpandedView.jsx` — already passes `onOpenSettings` to ExpandedTransportBar
- Any mode-specific components
- Existing `s1-notfound` / `s2-whisper-notfound` path inputs — working correctly

## 8. Verification plan
1. `npm run lint` — clean
2. `npm start` — smoke test:
   - Gear icon visible in expanded transport bar → click → settings panel opens
   - Settings panel shows Claude + Whisper + ffmpeg path fields with Browse + Save & Recheck
   - Enter bad path → red status; correct path → green status
   - splash wizard `s2-both-notfound`: whisper path input visible
   - splash OLD flow: "Set path →" affordance visible below failure message
3. Verify `config.json` in userData contains `ffmpegPath` after saving

## 9. Regression test
`tests/utils.test.js` — no direct test for path management (it's IPC + Electron). Verification is manual smoke test.
