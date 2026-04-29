# Backlog — Phase 2 review P2 findings
> Logged: 2026-04-18 (review: phase 2)

---

### P2-001 · Click-outside PROMPT_READY → IDLE not implemented
- **Source**: SPEC.md UI spec — PROMPT_READY: "click outside → IDLE"
- **Impact**: User has no way to dismiss PROMPT_READY without regenerating or re-triggering the shortcut
- **Not in**: F5/F6/F7 formal acceptance criteria — UX expectation only
- **Fix**: Add a `click` listener on `#state-prompt-ready` that calls `setState('IDLE')`, guarded so it doesn't fire on button clicks (use `e.target === e.currentTarget` or check `currentState`)
- **Target**: Phase 3 polish
- **✅ FIXED 2026-04-29**: `PromptReadyState.jsx` — moved `WebkitAppRegion: drag` off outer div onto the 36px traffic-light spacer; added `onClick={(e) => { if (e.target === e.currentTarget && !isEditing) onReset() }}` to outer `#panel-ready` div.

---

### P2-002 · Mode menu positions at click Y instead of above it
- **Source**: `index.html` — contextmenu handler reads `modeMenu.offsetHeight` while menu is `hidden` (display:none), so it always returns 0
- **Impact**: Menu appears at click position instead of above it — minor UX regression
- **Fix**: Use a fixed estimated height (e.g. `MODES.length * 28 + 8` ≈ `148px`) or toggle a CSS class instead of `hidden` so `offsetHeight` is readable
- **Target**: Phase 3 polish
- **✅ FIXED by React migration**: Mode menu is now a native Electron menu (`show-mode-menu` IPC). No DOM positioning — OS handles placement. CSS `offsetHeight` bug no longer exists.
