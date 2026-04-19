# FEATURE_TASKS — FEATURE-006: Keyboard Shortcuts Panel + Global Shortcuts
> **Estimated effort:** 5 tasks — S: 5 (<2hrs each) — approx. 3 hours total

---

### FSC-001 · ShortcutsPanel.jsx component
- **Status**: `[x]`
- **Size**: S
- **Touches**: `src/renderer/components/ShortcutsPanel.jsx` (new)

**What was done**: Created ShortcutsPanel.jsx with 8 shortcut rows, key chip styling
(bg/border/shadow), separator dividers, Done button, header label.

**Acceptance criteria**:
- [x] 8 shortcut rows rendered with correct desc + keys
- [x] Key chips styled per spec
- [x] Done button calls onClose prop
- [x] Separator dividers between rows (except last)

---

### FSC-002 · App.jsx: SHORTCUTS state + render
- **Status**: `[x]`
- **Size**: S
- **Touches**: `src/renderer/App.jsx`

**What was done**: Added SHORTCUTS to STATES + STATE_HEIGHTS (380px). Added prevStateRef.
Imported ShortcutsPanel. Rendered ShortcutsPanel with h-[28px] traffic lights spacer
when currentState === SHORTCUTS.

---

### FSC-003 · App.jsx: keyboard listener + IPC wiring
- **Status**: `[x]`
- **Size**: S
- **Touches**: `src/renderer/App.jsx`

**What was done**: Added generatedPromptRef mirroring generatedPrompt state.
Added window keydown useEffect: Escape (stop recording / back to IDLE), ⌘C (copy),
⌘E (dispatch export-prompt event). Added onShowShortcuts handler to IPC useEffect.

---

### FSC-004 · main.js + preload.js IPC
- **Status**: `[x]`
- **Size**: S
- **Touches**: `main.js`, `preload.js`

**What was done**: Added separator + "Keyboard shortcuts ⌘?" to show-mode-menu template.
Added CommandOrControl+Shift+/ and Alt+P global shortcuts in registerShortcut().
Added onShowShortcuts to preload.js contextBridge.

---

### FSC-005 · IdleState hint + feature docs
- **Status**: `[x]`
- **Size**: S
- **Touches**: `src/renderer/components/IdleState.jsx`, vibe docs

**What was done**: Added ⌘? hint span below subtitle in IdleState. Created feature folder
with FEATURE_SPEC.md, FEATURE_PLAN.md, FEATURE_TASKS.md. Updated TASKS.md, DECISIONS.md,
CODEBASE.md, CLAUDE.md.

---

#### Conformance: FEATURE-006 Keyboard Shortcuts
- [x] ShortcutsPanel renders 8 shortcuts with key chips
- [x] SHORTCUTS state resizes window to 380px
- [x] Done closes panel, returns to previous state
- [x] Escape stops recording or returns to IDLE
- [x] ⌘C copies prompt from PROMPT_READY
- [x] ⌘E dispatches export-prompt event from PROMPT_READY
- [x] ⌘? hint visible in IDLE state
- [x] npm run build:renderer passes (27 modules, ✓)
- [x] npm run lint passes (0 errors)
- [x] CODEBASE.md updated
- [x] DECISIONS.md updated
