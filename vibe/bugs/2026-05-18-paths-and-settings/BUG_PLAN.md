# BUG_PLAN — paths-and-settings

## 1. Exact files to modify
- `main.js`
- `src/renderer/components/ExpandedTransportBar.jsx`
- `src/renderer/components/SettingsPanel.jsx`
- `splash.html`

## 2. Exact files NOT to touch
- `preload.js`
- `App.jsx`
- `ExpandedView.jsx`
- Any component in `src/renderer/components/` not listed above
- Any hook in `src/renderer/hooks/`
- `index.css`, `package.json`, `entitlements.plist`

## 3. Change description

### main.js
- Line ~209: add `let ffmpegPath = null;` after `let whisperPath = null;`
- `resolveFfmpegPath()` (line 581): before the `commonPaths` array, add:
  ```js
  const stored = readConfig().ffmpegPath;
  if (stored && stored.trim()) {
    try { if (fs.existsSync(stored.trim())) return stored.trim(); } catch { /* ignore */ }
  }
  ```
- Line ~738: add `ffmpegPath = await resolveFfmpegPath();` after the whisperPath init
- `get-stored-paths` (line 1493): add `ffmpegPath: ffmpegPath || config.ffmpegPath || ''` to return object
- `save-paths` (line 1501): change destructure to `{ claudePath: cp, whisperPath: wp, ffmpegPath: fp }` and add `if (fp && fp.trim()) { config.ffmpegPath = fp.trim(); ffmpegPath = fp.trim(); }`
- `recheck-paths` (line 1519): add `ffmpegPath = await resolveFfmpegPath();` before the return, add `ffmpeg: { ok: !!ffmpegPath, path: ffmpegPath }` to return

### ExpandedTransportBar.jsx
- In the 36px drag header row (lines 103–131), add a gear button to the left of the existing collapse button. Same `28×28px` / `borderRadius: 7px` style. Calls `onOpenSettings` on click. Only renders when `onOpenSettings` is truthy. Gear SVG: circle cx=12 r=3 + the standard settings path (same as `splash.html` line 530–533).

### SettingsPanel.jsx
- Add state: `const [ffmpegVal, setFfmpegVal] = useState('')` and `const [ffmpegStatus, setFfmpegStatus] = useState(null)`
- In `useEffect`: destructure `ffmpegPath` from `getStoredPaths()`, set `ffmpegVal` and `ffmpegStatus`
- Add `handleBrowseFfmpeg` function (same pattern as handleBrowseClaude)
- In `handleSaveRecheck`: include `ffmpegPath: ffmpegVal.trim()` in `savePaths()` call; set `ffmpegStatus(result.ffmpeg)`; update failure message to check all three
- Add ffmpeg path section in JSX between Whisper and the divider — same layout (label, input + dot + Browse, hint)

### splash.html
- `s2-both-notfound` (line ~808): after the brew/pip install block, add the same whisper path override section as in `s2-whisper-notfound` (lines 778–788) — separator div + "Already installed? Find the path:" label + `which whisper` code row + "Paste the path here:" label + input#s2-manual-path + "Use path →" button
- `pathPanel` (line ~972): add a third path row for ffmpeg (input#ffmpegPathInput, Browse button `id="ffmpegBrowseBtn"`, status dot `id="ffmpeg-dot"`) between the Whisper row and the save button; load it in `openPathPanel()` using `recheckPaths` result
- `saveRecheckBtn` handler (line ~1101): read `ffmpegPathInput.value.trim()`, include in `savePaths()` call; update `recheckPaths` result check to include `result.ffmpeg.ok`
- `runChecks()` failure states (lines 1139, 1154): after each `showReady(...)` call, set a small inline affordance text visible below the ready-text: a styled `<a>` inside a container `id="manual-path-hint"` that calls `openPathPanel()` — "↳ Already installed at a custom path? Set it here →"

## 4. Conventions
- Inline styles for all dynamic/stateful values (no Tailwind in main.js or splash.html)
- `WebkitAppRegion: 'no-drag'` on all clickable elements in React components
- No `innerHTML` with user-provided text — path values via `value` attribute or `textContent`
- IPC only via `window.electronAPI`

## 5. Side effects check
- `ffmpegPath` module variable in main.js is isolated — only affects ffmpeg resolution, not claude/whisper
- Gear button in ExpandedTransportBar is purely additive
- SettingsPanel state additions don't touch existing claude/whisper logic

## 6. Test plan
Manual smoke test — no automated tests exist for IPC path management.

## 7. Rollback plan
`git revert` the two commits (code commit + doc commit).

## 8. CODEBASE.md update needed?
Yes — update IPC channel list: `save-paths` now accepts ffmpegPath; `get-stored-paths` now returns ffmpegPath; `recheck-paths` now returns ffmpeg status. Update ExpandedTransportBar entry to note gear button.

## 9. ARCHITECTURE.md update needed?
No — this is an extension of the existing path management pattern, not a new pattern.
