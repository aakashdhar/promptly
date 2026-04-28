# FEATURE-VIDEO-BUILDER Tasks

- [ ] VID-000 — useVideoBuilder.js hook (all state + handlers)
      Touches: src/renderer/hooks/useVideoBuilder.js (new)
      Dependencies: none

- [ ] VID-001 — useMode.js video mode + orange accent
      Touches: src/renderer/hooks/useMode.js
      Dependencies: none

- [ ] VID-002 — main.js MODE_CONFIG + show-mode-menu passthrough
      Touches: main.js
      Dependencies: none

- [ ] VID-003 — VideoBuilderState.jsx review screen (13 rows)
      Touches: src/renderer/components/VideoBuilderState.jsx (new)
      Dependencies: VID-001 (accent colour used in chip styles)

- [ ] VID-004 — VideoBuilderDoneState.jsx final output
      Touches: src/renderer/components/VideoBuilderDoneState.jsx (new)
      Dependencies: VID-001

- [ ] VID-005 — App.jsx states + ThinkingState props + auto-expand
      Touches: src/renderer/App.jsx,
               src/renderer/components/ThinkingState.jsx
      Dependencies: VID-000, VID-003, VID-004

- [ ] VID-006 — App.jsx STATE_HEIGHTS VIDEO_BUILDER + VIDEO_BUILDER_DONE = 860
      Touches: src/renderer/App.jsx
      Dependencies: VID-005

- [ ] VID-007 — Reiterate flow for video (merge logic in useVideoBuilder.js)
      Touches: src/renderer/hooks/useVideoBuilder.js
      Dependencies: VID-000, VID-005

- [ ] VID-008 — History saving for video mode
      Touches: src/renderer/hooks/useVideoBuilder.js,
               src/renderer/App.jsx
      Dependencies: VID-000, VID-005

- [ ] VID-009 — ExpandedTransportBar.jsx collapse button disabled in video mode
      Touches: src/renderer/components/ExpandedTransportBar.jsx
      Dependencies: VID-001

- [ ] VID-010 — ExpandedView.jsx + ExpandedDetailPanel.jsx videoBuilderProps wiring
      Touches: src/renderer/components/ExpandedView.jsx,
               src/renderer/components/ExpandedDetailPanel.jsx
      Dependencies: VID-003, VID-004, VID-005

- [ ] VID-011 — Docs update (CODEBASE.md, DECISIONS.md, TASKS.md)
      Touches: vibe/CODEBASE.md, vibe/DECISIONS.md, vibe/TASKS.md,
               vibe/features/2026-04-27-video-builder/FEATURE_TASKS.md
      Dependencies: all above complete

---

## Smoke test checklist (run before every commit)

### Happy path
- [ ] Switch to Video mode via right-click menu — orange accent visible
- [ ] Idle bar shows orange dot + "Speak your video idea"
- [ ] Press ⌥ Space while minimized — window expands to 1100×860 automatically
- [ ] Recording starts in expanded view — red waveform visible
- [ ] Stop recording — THINKING shows "Analysing your idea..." in orange
- [ ] VIDEO_BUILDER appears — all 13 rows rendered, Claude chips pre-filled
- [ ] Orange dot visible on AI pre-selected chips
- [ ] Tap a chip to remove it — chip disappears
- [ ] Tap "+ add" — option picker opens
- [ ] Select option from picker — appears as user-added chip (no dot)
- [ ] Toggle "Show advanced parameters" — Rows 9–13 appear/hide
- [ ] Row 11 "Add spoken lines" → dialogue text input appears
- [ ] Select 4K resolution — cost warning appears below row
- [ ] Click "Confirm & generate →" — THINKING shows "Assembling prompt..."
- [ ] VIDEO_BUILDER_DONE appears — assembled prompt visible
- [ ] Click "Copy prompt" — clipboard populated, flash visible
- [ ] Click "← Edit" — returns to VIDEO_BUILDER with answers intact
- [ ] Click "Start over" — IDLE state, all video state cleared
- [ ] Click Save — 'Saved ✓' flash on button
- [ ] Open history — video entry present with mode: 'video' orange tag

### Reiterate path
- [ ] In VIDEO_BUILDER, click "↺ Reiterate" — recording starts
- [ ] Stop — THINKING shows "Updating idea..."
- [ ] VIDEO_BUILDER returns — "You said" updated, user chips preserved

### Copy now path
- [ ] In VIDEO_BUILDER, click "Copy now →" — raw transcript copied
- [ ] In VIDEO_BUILDER_DONE, "Copy now →" copies assembled prompt

### Collapse button
- [ ] In expanded view with video mode — collapse button is opacity 0.4
- [ ] Hover collapse button — tooltip "Video mode uses full view" appears
- [ ] Collapse button click does nothing in video mode
- [ ] Switch to different mode — collapse button re-enables

### Error path
- [ ] Disconnect network (or force claudePath null) → record → stop
- [ ] Pre-selection error → ERROR state appears with
      "Couldn't analyse your idea — tap to try again"
- [ ] Tap to dismiss → IDLE
