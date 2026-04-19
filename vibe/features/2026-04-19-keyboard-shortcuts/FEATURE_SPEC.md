# FEATURE_SPEC — FEATURE-006: Keyboard Shortcuts Panel + Global Shortcuts
> Added: 2026-04-19 | Status: COMPLETE

## Feature overview
Add a SHORTCUTS state that renders a ShortcutsPanel listing 8 keyboard shortcuts with
styled key chips. Triggered via the mode context menu ("Keyboard shortcuts ⌘?") or the
global ⌘? shortcut. Wires Escape, ⌘C, and ⌘E as window-focused keyboard shortcuts.
Adds a ⌘? hint to the IDLE state footer.

## User stories
- As a user, I can press ⌘? (or right-click → "Keyboard shortcuts ⌘?") to see a list of all shortcuts, then press Done to return to my previous state.
- As a user, I can press Escape to cancel recording or return to idle from any overlay.
- As a user in PROMPT_READY, I can press ⌘C to copy the prompt without clicking the button.

## Acceptance criteria
- [x] ⌘? opens shortcuts panel (context menu item)
- [x] Global CommandOrControl+Shift+/ sends show-shortcuts to renderer
- [x] Shortcuts panel shows all 8 shortcuts with correct key chips and separator dividers
- [x] Done button closes panel and returns to previous state (IDLE or PROMPT_READY)
- [x] Window resizes to 380px when shortcuts panel opens
- [x] Traffic lights spacer (h-[28px]) rendered above ShortcutsPanel
- [x] Escape stops recording if RECORDING, otherwise transitions to IDLE
- [x] ⌘C copies prompt when in PROMPT_READY state (preventDefault to avoid browser copy)
- [x] ⌘E dispatches 'export-prompt' CustomEvent when in PROMPT_READY state
- [x] ⌘? hint visible in idle state below subtitle text
- [x] Alt+P global shortcut registered → sends shortcut-pause to renderer
- [x] npm run build:renderer passes
- [x] npm run lint passes

## Scope boundaries
**Included:**
- ShortcutsPanel.jsx component
- SHORTCUTS state in App.jsx
- Keyboard listener (Escape, ⌘C, ⌘E)
- Global shortcuts (⌘?, Alt+P)
- onShowShortcuts IPC in preload.js
- Context menu item in main.js

**Deferred:**
- ⌘H (open history) — HISTORY state not yet in React renderer
- ⌘I (iteration mode) — ITERATION state not yet built

## Integration points
- `src/renderer/App.jsx` — STATES, STATE_HEIGHTS, IPC listeners, keydown listener, render
- `src/renderer/components/ShortcutsPanel.jsx` — new component
- `src/renderer/components/IdleState.jsx` — hint text
- `main.js` — show-mode-menu, registerShortcut()
- `preload.js` — onShowShortcuts
