# FEATURE_PLAN.md — FEATURE-010: Refine Mode
> Created: 2026-04-20

---

## 1. Impact map

**Files to modify:**
| File | Change |
|------|--------|
| `main.js` | Add `refine` to MODE_CONFIG + add `{ key: 'refine', label: 'Refine' }` to show-mode-menu modes array |
| `src/renderer/hooks/useMode.js` | Add `refine: 'Refine'` to MODE_LABELS |
| `src/renderer/components/IdleState.jsx` | Purple pill + pulse ring + mic stroke + subtitle when mode === 'refine' |
| `src/renderer/components/PromptReadyState.jsx` | Purple status line + label color + copy button when mode === 'refine' |

**New files:**
None.

## 2. Files explicitly out of scope

- `preload.js` — no new IPC channels needed
- `src/renderer/App.jsx` — mode wiring complete (useMode hook + onModeSelected IPC already handles all modes)
- `src/renderer/components/ShortcutsPanel.jsx` — confirmed no mode list
- `src/renderer/components/RecordingState.jsx` — no refine-specific changes
- `src/renderer/components/ThinkingState.jsx` — no refine-specific changes
- `vite.config.js`, `splash.html`, `entitlements.plist`

---

## 3. Backend changes

**main.js — MODE_CONFIG:**
Add after `design` entry:
```js
refine: { name: 'Refine', standalone: true, instruction: `[exact system prompt from spec]` }
```

**main.js — show-mode-menu handler:**
Add after `{ key: 'design', label: 'Design' }`:
```js
{ key: 'refine', label: 'Refine' },
```

---

## 4. Frontend changes

**useMode.js:**
Add `refine: 'Refine'` to MODE_LABELS object.

**IdleState.jsx:**
Derive `const isRefine = mode === 'refine'` at top of component.
Apply conditional inline styles:
- Mode pill: background/border/color swap to purple
- Pulse ring container: background/border/boxShadow swap to purple
- Pulse ring border divs: border-color class swap to purple (Tailwind arbitrary value)
- Mic SVG: stroke rgba changes to rgba(200,160,255,0.8)
- Subtitle text: conditional string

**PromptReadyState.jsx:**
- `renderPromptOutput(text, labelColor)` — add `labelColor` param with default blue value
- Status line: conditional 'Refinement prompt ready' when mode === 'refine'
- renderPromptOutput call: pass `mode === 'refine' ? 'rgba(168,85,247,0.7)' : 'rgba(100,170,255,0.42)'`
- Copy button background/boxShadow/hover class: conditional purple when `!isCopied && mode === 'refine'`

---

## 5. Conventions to follow

- `standalone: true` in MODE_CONFIG causes generate-prompt IPC to use instruction directly (bypasses PROMPT_TEMPLATE) — same as `design` mode
- `{TRANSCRIPT}` placeholder at end of standalone instruction — replaced in main.js generate-prompt handler
- JSX text nodes only — no dangerouslySetInnerHTML
- Tailwind for static classes, inline styles for dynamic/stateful values (per ARCHITECTURE.md)
- No new localStorage keys — `mode` key accepts any string

---

## 6. Task breakdown

RFNE-001 (S) — main.js: MODE_CONFIG + show-mode-menu
RFNE-002 (S) — useMode.js: MODE_LABELS
RFNE-003 (M) — IdleState.jsx: purple pill + ring + stroke + subtitle
RFNE-004 (M) — PromptReadyState.jsx: status + label color + copy button
RFNE-005 (S) — CODEBASE.md + DECISIONS.md + TASKS.md

---

## 7. CODEBASE.md sections to update

- Module-scope variables in main.js — MODE_CONFIG entry count (6 → 7)
- localStorage keys — note `refine` is a valid mode value
- Prompt modes section in ARCHITECTURE.md — add Refine row
