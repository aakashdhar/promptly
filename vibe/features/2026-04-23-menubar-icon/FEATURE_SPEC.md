# FEATURE-017 — Persistent Menu Bar Icon

## Problem
Promptly's floating bar disappears when hidden and users have no visual
indicator that the app is running. They must remember the ⌥ Space shortcut
or find the tray icon to bring it back. New team members frequently think
the app has crashed when the bar is hidden.

## Solution
A permanent mic icon in the macOS menu bar (top-right, alongside battery
and wifi) that:
- Is always visible whether the bar is shown or hidden
- Shows a colour dot indicating current app state
- Single click shows/hides the floating bar
- Right click opens the context menu
- Automatically adapts to light/dark menu bar via template image

## State indicators
- No dot — idle, app ready (template image, auto-adapts light/dark)
- Red pulsing dot (#FF3B30) — recording in progress (also PAUSED)
- Blue pulsing dot (#0A84FF) — generating prompt (thinking / iterating)
- Green steady dot (#30D158) — prompt ready to copy (including polish mode)
- Dimmed icon — bar is hidden (same mic shape, 45% alpha, template image)

> Colour strategy:
> - IDLE: `setTemplateImage(true)` — macOS auto-adapts, no dot.
> - HIDDEN: template image at 45% alpha — same mic silhouette, visibly dimmed.
>   No slash or distinct shape; dimming alone signals the hidden state.
> - Dot states (recording/thinking/ready): NOT template images.
>   Mic body drawn in white (dark menu bar) or black (light menu bar) based on
>   `nativeTheme.shouldUseDarkColors` at creation time.
>   Dot drawn in full RGB — real red/blue/green, clearly visible.
>   `nativeTheme.on('updated')` regenerates the current dot-state icon on theme change.
> - Pulsing (recording/thinking): `setInterval` at 600 ms alternates between
>   icon-with-dot and icon-without-dot. Stored in `pulseInterval`; cleared on
>   any state change. Green (ready) is steady — no pulse.
>
> PROMPT_READY covers polish mode — polish renders within PROMPT_READY state;
> no separate POLISH_READY state exists. Green dot applies to both.

## Acceptance criteria
- [ ] Mic icon permanently visible in macOS menu bar
- [ ] IDLE icon uses template image — adapts to light/dark menu bar automatically
- [ ] Single click on icon shows bar if hidden, hides bar if visible
- [ ] Right click on icon opens existing tray context menu
- [ ] No dot shown in IDLE state (clean mic silhouette only)
- [ ] Red dot (#FF3B30) pulses (600 ms on/off) during RECORDING and PAUSED states
- [ ] Blue dot (#0A84FF) pulses (600 ms on/off) during THINKING and ITERATING states
- [ ] Green dot (#30D158) shown steady (no pulse) during PROMPT_READY state (inc. polish mode)
- [ ] Dot states show mic body in white on dark menu bars, black on light menu bars
- [ ] HIDDEN state shows dimmed mic icon (45% alpha, template image — same shape as IDLE)
- [ ] State dot updates happen via IPC from renderer when state changes
- [ ] Theme change (light↔dark) regenerates the current dot-state icon correctly
- [ ] Existing ⌥ Space shortcut still works
- [ ] Existing tray icon behaviour unchanged

## Files in scope
- main.js — menu bar icon creation, state update IPC handler
- preload.js — updateMenuBarState IPC exposure
- src/renderer/App.jsx — call updateMenuBarState on every state transition

## Files out of scope
All React components except App.jsx, all vibe docs except DECISIONS.md CODEBASE.md TASKS.md

## IPC channels added
- update-menubar-state → receives state name string, updates icon dot

## Implementation notes
- Zero runtime npm deps — `canvas` package NOT used. PNG icons are generated
  at runtime using Node.js built-in `zlib` (deflateSync) + inline CRC-32.
- Template images for all states (macOS renders in menu-bar colour).
  Dots appear as coloured shapes in the RGBA data; macOS renders them as
  dark/light via template — acceptable for MVP, state communicated by dot
  presence/absence shape.
- 22×22 @2x (44×44 pixel) icons drawn via pixel-level painting functions
  (paintDisk + strokeArc + strokeLine) directly into a Uint8Array.
