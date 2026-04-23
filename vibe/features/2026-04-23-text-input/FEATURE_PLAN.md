# FEATURE_PLAN.md — FEATURE-014: Text Input
> Added: 2026-04-23

---

## 1. Impact map

### New files
| File | Purpose |
|------|---------|
| `src/renderer/components/TypingState.jsx` | New TYPING state panel — textarea, submit, dismiss, switch-to-voice |

### Modified files
| File | Change |
|------|--------|
| `src/renderer/App.jsx` | Add TYPING to STATES + STATE_HEIGHTS; add handleTypingSubmit(); add ⌘T keydown; render TypingState; pass onTypePrompt to IdleState |
| `src/renderer/components/IdleState.jsx` | Add keyboard icon button with onTypePrompt prop; update subtitle text |
| `src/renderer/components/ShortcutsPanel.jsx` | Add ⌘T row to shortcuts array |

---

## 2. Files explicitly out of scope

- `main.js` — no new IPC handlers needed
- `preload.js` — no new contextBridge methods
- `src/renderer/components/ThinkingState.jsx` — unchanged (receives thinkTranscript already)
- `src/renderer/components/PromptReadyState.jsx` — unchanged (receives generatedPrompt already)
- `src/renderer/utils/history.js` — unchanged (saveToHistory is generic)
- `src/renderer/hooks/useMode.js` — unchanged
- `src/renderer/index.css` — no new keyframes needed
- `package.json`, `entitlements.plist`, `vite.config.js`, `splash.html`

---

## 3. DB migration plan

None.

---

## 4. Backend changes

None. The existing `generate-prompt` IPC handler in `main.js` accepts any transcript string — no changes required.

---

## 5. Frontend changes

### App.jsx additions
```js
// In STATES:
TYPING: 'TYPING'

// In STATE_HEIGHTS:
TYPING: 220

// New handler (same pipeline as voice, skips Whisper):
async function handleTypingSubmit(typedText) {
  isIterated.current = false
  originalTranscript.current = typedText
  setThinkTranscript(typedText)
  transition(STATES.THINKING)
  resizeWindow(320)
  const genResult = await window.electronAPI.generatePrompt(typedText, mode)
  if (!genResult.success) {
    transition(STATES.ERROR, { message: genResult.error || 'Claude error' })
    return
  }
  setGeneratedPrompt(genResult.prompt)
  saveToHistory({ transcript: typedText, prompt: genResult.prompt, mode })
  transition(STATES.PROMPT_READY)
}

// In keydown handler:
if (meta && e.key === 't' && stateRef.current === STATES.IDLE) {
  e.preventDefault()
  transition(STATES.TYPING)
}

// In render:
{displayState === STATES.TYPING && (
  <>
    <div className="h-[28px] w-full" style={{WebkitAppRegion:'drag'}} />
    <TypingState
      onDismiss={(target) => {
        if (target === 'voice') startRecording()
        else transition(STATES.IDLE)
      }}
      onSubmit={handleTypingSubmit}
      resizeWindow={resizeWindow}
    />
  </>
)}
```

### IdleState.jsx additions
```jsx
// New prop: onTypePrompt
// New icon button between text block and mode pill
// Subtitle update (non-refine only):
'⌥ Space to speak · ⌘T to type'
```

### TypingState.jsx (new)
- All inline styles (no Tailwind — dynamic state-dependent border color)
- Props: `{ onDismiss, onSubmit, resizeWindow }` (mode removed — handleTypingSubmit reads mode from App.jsx closure)
- `useEffect`: `setTimeout(() => textareaRef.current?.focus(), 50)`
- `onChange`: compute line count → resizeWindow(Math.min(220 + Math.floor(lines / 4) * 40, 320))
- `onKeyDown`: Esc → onDismiss(), ⌘↵ → onSubmit(text.trim())
- No `dangerouslySetInnerHTML` — controlled `<textarea value={text} onChange={...} />`

### ShortcutsPanel.jsx addition
```js
{ desc: 'Type prompt', keys: ['⌘', 'T'] }
```
Add after the existing 'Open history' row.

---

## 6. Conventions to follow

From ARCHITECTURE.md:
- `transition(newState, payload)` for all state changes — never setCurrentState directly
- `textContent` equivalent in React = JSX text nodes and `value` prop on textarea
- `window.electronAPI.generatePrompt(transcript, mode)` — text is passed as transcript, unchanged
- `saveToHistory({ transcript, prompt, mode })` — typed text becomes the transcript field
- `originalTranscript.current` set ONCE at submit time, same as `stopRecording` onstop
- `isIterated.current = false` reset at submit — same as `stopRecording` onstop

**Pattern deviation (logged):** `resizeWindow` is passed as a prop to TypingState rather than imported via `useWindowResize()` inside the component. This avoids a second hook instantiation for a component that only needs resize on text change. The hook is a thin IPC wrapper — both approaches produce identical behaviour. Deviation noted in DECISIONS.md at commit time.
- IPC listeners: no new ones needed

From React patterns:
- RAF loops require useEffect cleanup — not needed here (no canvas)
- `useRef` for textarea ref + direct DOM focus (not state)
- All styles inline in TypingState.jsx (matches IteratingState.jsx pattern)

---

## 7. Task breakdown

| ID | Title | Size | Dependencies |
|----|-------|------|-------------|
| TXT-001 | Add TYPING state + STATE_HEIGHTS to App.jsx | S | None |
| TXT-002 | Create TypingState.jsx component | M | TXT-001 |
| TXT-003 | Update IdleState.jsx — keyboard button + subtitle | S | TXT-001 |
| TXT-004 | Wire handleTypingSubmit + ⌘T + render TypingState in App.jsx + ShortcutsPanel | S | TXT-002, TXT-003 |
| TXT-005 | CODEBASE.md update | S | TXT-004 |

**Estimated total:** ~4–5 hours (S: 4, M: 1)

---

## 8. Rollback plan

All changes are additive:
- Remove `TYPING` from STATES and STATE_HEIGHTS
- Remove `handleTypingSubmit`, ⌘T handler, TypingState render from App.jsx
- Remove keyboard icon button and onTypePrompt prop from IdleState.jsx
- Delete `TypingState.jsx`
- Remove ⌘T row from ShortcutsPanel.jsx

No IPC contracts changed. No history schema changed.

---

## 9. Testing strategy

Manual smoke checklist (13 items — in FEATURE_TASKS.md conformance section):
- Keyboard icon visible in IDLE
- ⌘T opens TYPING from IDLE
- Textarea auto-focuses
- Empty: button disabled; with text: button enabled
- ⌘↵ submits
- Esc → IDLE
- Switch to voice → RECORDING
- Full THINKING → PROMPT_READY flow
- YOU SAID shows typed text
- History entry created
- Mode affects output
- Dynamic height expansion
- ShortcutsPanel ⌘T visible

---

## 10. CODEBASE.md sections to update (TXT-005)

- **File map**: add TypingState.jsx row
- **React state + refs**: no new refs (handleTypingSubmit uses existing originalTranscript.current)
- **State machine**: add TYPING row (220px, h-[28px] traffic light spacer)
