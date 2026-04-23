# FEATURE_PLAN.md — FEATURE-015: Polish Mode
> Created: 2026-04-23

---

## 1. Impact map

### Files to modify

| File | Change |
|------|--------|
| `main.js` | Add `polish` to `MODE_CONFIG`; add `polish` to `show-mode-menu` array; update `generate-prompt` IPC handler to accept `{ transcript, mode, options }` and replace `{TONE}` for polish mode |
| `preload.js` | Update `generatePrompt` method to pass `options` argument |
| `src/renderer/hooks/useMode.js` | Add `polish: 'Polish'` to `MODE_LABELS` |
| `src/renderer/components/IdleState.jsx` | Add `isPolish` condition; green pulse ring; lines icon; subtitle; tone toggle replacing mode pill |
| `src/renderer/App.jsx` | Import `usePolishTone`; add `polishResult` state; add `parsePolishOutput()`; update 3 generate calls; add `handlePolishToneChange`; import + render `PolishReadyState` conditionally; update `onReuse` for polish |
| `src/renderer/utils/history.js` | Extend `saveToHistory` to accept and store `polishChanges` field |
| `src/renderer/components/HistoryPanel.jsx` | Green mode tag for polish entries |

### New files

| File | Purpose |
|------|---------|
| `src/renderer/hooks/useTone.js` | `TONE_KEY`, `getPolishTone()`, `setPolishTone()`, `usePolishTone()` hook |
| `src/renderer/components/PolishReadyState.jsx` | Dedicated output component — polished text + change notes + copy button + tone toggle |

---

## 2. Files explicitly out of scope

- `splash.html` — no first-run changes
- `entitlements.plist` — no permission changes
- `vite.config.js` — no build config changes
- `package.json` — no dep changes
- `src/renderer/components/PromptReadyState.jsx` — Polish has its own output component; do NOT modify this
- `src/renderer/components/RecordingState.jsx` — no recording state changes for Polish
- `src/renderer/components/ThinkingState.jsx` — thinking state unchanged for Polish
- `src/renderer/components/ShortcutsPanel.jsx` — no shortcut row needed for tone

---

## 3. Backend changes (main.js)

### MODE_CONFIG addition
Add after `refine` entry:

```js
polish: {
  name: 'Polish',
  standalone: true,
  instruction: `You are an expert editor and writing coach. [full system prompt with {TONE} and {TRANSCRIPT} placeholders]`
}
```

Note: for `polish`, the system prompt contains `{TRANSCRIPT}` just like `refine` and `design`. The `{TONE}` placeholder is replaced by the IPC handler before `{TRANSCRIPT}` replacement (or both replaced in the same statement — order doesn't matter since they're distinct strings).

### show-mode-menu update
Add `{ key: 'polish', label: 'Polish' }` after `{ key: 'refine', label: 'Refine' }`.

### generate-prompt IPC update
Change destructure from `{ transcript, mode }` to `{ transcript, mode, options = {} }`.
After `systemPrompt` is computed, add:
```js
if (mode === 'polish') {
  const tone = options.tone || 'formal'
  systemPrompt = systemPrompt.replace('{TONE}', tone.charAt(0).toUpperCase() + tone.slice(1))
}
```

---

## 4. Frontend changes

### useTone.js (new)
```
TONE_KEY = 'promptly_polish_tone'
getPolishTone() — reads localStorage, defaults 'formal'
setPolishTone(tone) — writes localStorage
usePolishTone() — useState initialized from getPolishTone(), returns { tone, setTone }
```

### useMode.js
Add `polish: 'Polish'` to `MODE_LABELS`.

### IdleState.jsx
Extend existing `isRefine` pattern with `isPolish = mode === 'polish'`.

**Pulse ring:**
- background: `isPolish ? 'rgba(48,209,88,0.12)' : isRefine ? 'rgba(168,85,247,0.12)' : 'rgba(10,132,255,0.12)'`
- border-color and boxShadow: same ternary pattern with green values

**Pulse ring animations:** border-colors follow same ternary

**Icon:**
- When `isPolish`: show lines/text SVG (3 horizontal lines + edit circle)
- Otherwise: existing mic SVG (already conditional on `isRefine`)

**Subtitle:**
- When `isPolish`: 'Speak it rough — get it polished'
- When `isRefine`: existing text
- Otherwise: '⌥ Space to speak · ⌘T to type'

**Mode pill area (right side):**
- When `isPolish`: replace `<span id="mode-pill">` with tone toggle `<div>` (Formal/Casual)
- Otherwise: existing mode pill unchanged

IdleState receives new props: `polishTone` and `onPolishToneChange`.

### PolishReadyState.jsx (new)
Full inline-styles component per FEATURE_SPEC.md Part 5.
Props: `{ polished, changes, transcript, tone, onReset, onCopy, copied, onEdit, onToneChange }`

### App.jsx
New imports: `usePolishTone`, `PolishReadyState`
New state: `const [polishResult, setPolishResult] = useState(null)`
New hook usage: `const { tone: polishTone, setTone: setPolishToneValue } = usePolishTone()`
New function: `parsePolishOutput(raw)` — regex-based split on `POLISHED:` and `CHANGES:` labels
Updated functions:
- `stopRecording onstop`: detect `mode === 'polish'`, parse, setPolishResult, setGeneratedPrompt(parsed.polished)
- `handleTypingSubmit`: same detection + parsing
- `handleRegenerate`: same detection + parsing
- `handlePolishToneChange(newTone)`: sets tone, re-runs generatePrompt, re-parses, saves to history
- `generatePrompt` calls: pass `mode === 'polish' ? { tone: polishTone } : undefined` as 3rd arg
Updated render: when `displayState === STATES.PROMPT_READY && mode === 'polish'`, render `PolishReadyState` instead of `PromptReadyState`
Updated `onReuse`: when `entry.mode === 'polish'`, also set `polishResult` from `entry`

### history.js
Extend `saveToHistory` signature to accept `polishChanges = null`.
If truthy, set `entry.polishChanges = polishChanges`.

### HistoryPanel.jsx
In entry list meta row, detect `entry.mode === 'polish'` and use green tag colours.
In right panel detail: polish entries still use `renderPromptSections(prompt)` — the polished text is plain text without section labels, so it renders as a single block. This is acceptable.

---

## 5. Conventions to follow

From CODEBASE.md + ARCHITECTURE.md:

- **Props down pattern**: `polishTone` and `onPolishToneChange` passed as props from App.jsx to IdleState — no direct hook usage inside IdleState
- **All styles inline** in new files (PolishReadyState, useTone) — no Tailwind classes (matches IteratingState and TypingState pattern)
- **`useRef` for stale-closure-safe values**: `polishTone` is read inside callbacks — pass the current value directly rather than relying on stale closure; use `polishToneRef` if needed in callbacks
- **Backwards-compatible IPC**: `options` is optional in both preload.js and main.js — existing callers unaffected
- **localStorage via hook**: all `promptly_polish_tone` access through `useTone.js` exports only
- **parsePolishOutput fallback**: always returns `{ polished, changes }` — never throws

---

## 6. Task breakdown

| ID | Title | Size | Touches |
|----|-------|------|---------|
| POL-001 | main.js + preload.js — polish mode + IPC options | S | `main.js`, `preload.js` |
| POL-002 | useTone.js + useMode.js MODE_LABELS | S | `src/renderer/hooks/useTone.js` (new), `src/renderer/hooks/useMode.js` |
| POL-003 | IdleState.jsx — polish visual identity + tone toggle | M | `src/renderer/components/IdleState.jsx` |
| POL-004 | App.jsx Part 1 — parsePolishOutput, polishResult, generate calls | M | `src/renderer/App.jsx` |
| POL-005 | PolishReadyState.jsx — new component | S | `src/renderer/components/PolishReadyState.jsx` (new) |
| POL-006 | App.jsx Part 2 — render + toneChange + history | M | `src/renderer/App.jsx`, `src/renderer/utils/history.js` |
| POL-007 | HistoryPanel.jsx — green tag + polish reuse + CODEBASE.md | S | `src/renderer/components/HistoryPanel.jsx`, `vibe/CODEBASE.md` |

---

## 7. Rollback plan

1. Remove `polish` from `MODE_CONFIG` and `show-mode-menu` in `main.js`
2. Revert `generate-prompt` IPC to `{ transcript, mode }` destructure
3. Revert `preload.js generatePrompt` to 2-arg form
4. Remove `polish: 'Polish'` from `useMode.js MODE_LABELS`
5. Delete `src/renderer/hooks/useTone.js`
6. Delete `src/renderer/components/PolishReadyState.jsx`
7. Revert `IdleState.jsx`, `App.jsx`, `history.js`, `HistoryPanel.jsx` to pre-feature state
8. Remove `promptly_polish_tone` localStorage key from user's browser: `localStorage.removeItem('promptly_polish_tone')`

---

## 8. Testing strategy

Manual smoke test per FEATURE_SPEC.md conformance checklist.
Run `npm run lint` and `npm run build:renderer` after every task from POL-003 onward.

No new automated tests — consistent with project testing philosophy (manual smoke for v1).

---

## 9. CODEBASE.md sections to update (POL-007)

- File map: add `useTone.js` and `PolishReadyState.jsx`
- localStorage keys: add `promptly_polish_tone`
- React state + refs: add `polishResult` useState
- IPC channels: note `generate-prompt` now accepts `options` field
- MODE_CONFIG: add `polish` to the 7-mode list (→ 8 modes)
