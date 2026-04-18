# BUG_SPEC — BUG-003 (4 visual bugs)

## Bug summary
Four visual regressions: ghost window behind recording pill, traffic lights positioned incorrectly, blank flash before THINKING, ghost panel below PROMPT_READY.

## Files involved
- `main.js` — BrowserWindow config, IPC handlers
- `preload.js` — contextBridge
- `index.html` — setState(), CSS, pill markup
- `pill.html` — new file (pill BrowserWindow content)

## Root cause hypotheses

**BUG-003-A (ghost behind pill):** `vibrancy:'sidebar'` is a window-level macOS effect applied to the full BrowserWindow frame. Hiding `#bar` via `display:none` removes the content but the vibrancy material still covers the full window area. Confidence: HIGH.

**BUG-003-B (traffic lights at bottom):** `.traf` has `display:flex` but is missing `align-items:center`, so the 12px dots hang at the flex default (align-items:stretch / baseline). Confidence: HIGH.

**BUG-003-C (blank flash before THINKING):** `resizeWindow()` is an async IPC call dispatched immediately in setState — before the next paint. The window resizes while the old DOM is still clearing, causing a blank frame. Wrapping in `requestAnimationFrame` ensures the DOM paints first. Confidence: HIGH.

**BUG-003-D (ghost below prompt ready):** Same root cause as A — vibrancy fills the full BrowserWindow frame even when content is shorter than the window height. Also: pill window (when created for fix A) must be destroyed before win is reshown. Confidence: HIGH.

## Fix approach
- BUG-003-A/D: Create `pillWin` as a separate `BrowserWindow` (transparent, frame:false, alwaysOnTop). On recording start: hide `win`, show `pillWin`. On stop/dismiss: show `win` (in THINKING/IDLE state) then destroy `pillWin`. Only one window visible at any time.
- BUG-003-B: Add `align-items: center` to `.traf` CSS.
- BUG-003-C: Wrap all `resizeWindow` calls in `requestAnimationFrame`.
- BUG-003-D: Add `#bar { min-height: 100vh }` so bar fills window, preventing vibrancy ghost at bottom.

## What NOT to change
- System prompt text in main.js
- State machine logic beyond recording/pill flow
- CSS design tokens

## Verification plan
1. IDLE → ⌥Space → pill appears, no ghost behind it
2. Press stop → THINKING shows cleanly (no blank flash), no ghost below
3. PROMPT_READY → no ghost panel below buttons
4. Traffic lights vertically centred in traf row

## Regression test
Manual smoke test across all 6 states — per ARCHITECTURE.md checklist.
