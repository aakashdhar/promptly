# FEATURE_TASKS.md — FEATURE-014: Text Input
> Added: 2026-04-23 | Folder: vibe/features/2026-04-23-text-input/
> **Estimated effort:** 5 tasks — S: 4 (<2hrs each), M: 1 (2-4hrs) — approx. 5–6 hours total

---

### TXT-001 · Add TYPING state + STATE_HEIGHTS to App.jsx
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria
- **Dependencies**: None
- **Touches**: `src/renderer/App.jsx`

**What to do**:
1. Add `TYPING: 'TYPING'` to the `STATES` object (after `ITERATING`).
2. Add `TYPING: 220` to `STATE_HEIGHTS` (after `ITERATING: 200`).
3. Import `TypingState` at the top (it won't exist yet — add the import anyway, build will warn but won't fail; the file gets created in TXT-002).
4. In `transition()`: `setWindowButtonsVisible` already hides traffic lights for RECORDING/PAUSED/ITERATING. TYPING does NOT hide traffic lights — the spacer handles layout. No changes to setWindowButtonsVisible logic.
5. Do NOT wire the keydown handler or render yet — those come in TXT-004.

**Acceptance criteria**:
- [ ] `STATES.TYPING` exists in the STATES object
- [ ] `STATE_HEIGHTS.TYPING === 220`
- [ ] `import TypingState` line present at top of App.jsx
- [ ] `npm run build:renderer` succeeds (missing TypingState.jsx will warn, not fail, in Vite)

**Self-verify**: Open App.jsx. Confirm STATES and STATE_HEIGHTS both have TYPING.
**Test requirement**: Build succeeds — `npm run build:renderer` exits 0.
**⚠️ Boundaries**: Do not render TypingState yet. Do not add keydown handler yet.
**CODEBASE.md update?**: No — deferred to TXT-005.
**Architecture compliance**: STATES/STATE_HEIGHTS pattern from FEATURE-004 + all subsequent features.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### TXT-002 · Create TypingState.jsx component
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria, FEATURE_PLAN.md#5-frontend-changes
- **Dependencies**: TXT-001
- **Touches**: `src/renderer/components/TypingState.jsx` (new file)

**What to do**:
Create `src/renderer/components/TypingState.jsx` with the following exact implementation:

```jsx
import { useState, useEffect, useRef } from 'react'

export default function TypingState({ onDismiss, onSubmit, resizeWindow }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setText(val)
    const lines = val.split('\n').length
    const newH = Math.min(220 + Math.floor(lines / 4) * 40, 320)
    resizeWindow(newH)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { onDismiss(); return }
    if (e.key === 'Enter' && e.metaKey && text.trim()) {
      onSubmit(text.trim())
    }
  }

  return (
    <div style={{position:'relative', zIndex:1}}>
      {/* Top row */}
      <div style={{height:'54px', display:'flex', alignItems:'center', padding:'0 18px', gap:'10px', WebkitAppRegion:'drag'}}>
        <div
          onClick={onDismiss}
          style={{width:'28px', height:'28px', borderRadius:'50%', background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, WebkitAppRegion:'no-drag'}}
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span style={{flex:1, fontSize:'12px', color:'rgba(255,255,255,0.5)', fontWeight:500, WebkitAppRegion:'no-drag'}}>
          Type your prompt
        </span>
        <div
          onClick={() => onDismiss('voice')}
          style={{display:'flex', alignItems:'center', gap:'5px', padding:'4px 10px', background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:'20px', cursor:'pointer', WebkitAppRegion:'no-drag'}}
        >
          <svg width="10" height="12" viewBox="0 0 12 16" fill="none">
            <rect x="3.5" y="0.5" width="5" height="9" rx="2.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
            <path d="M1 8.5C1 11.26 3.24 13.5 6 13.5C8.76 13.5 11 11.26 11 8.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          <span style={{fontSize:'10px', color:'rgba(255,255,255,0.4)'}}>Switch to voice</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{height:'0.5px', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)', margin:'0 18px'}}/>

      {/* Text area */}
      <div style={{padding:'14px 18px'}}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you want Claude to build, design, or write..."
          rows={4}
          style={{
            width:'100%', background:'rgba(255,255,255,0.04)',
            border: text ? '0.5px solid rgba(10,132,255,0.25)' : '0.5px solid rgba(255,255,255,0.08)',
            borderRadius:'10px', padding:'10px 12px',
            fontSize:'13px', color:'rgba(255,255,255,0.78)',
            lineHeight:1.65, fontFamily:'inherit',
            outline:'none', resize:'none', boxSizing:'border-box',
            WebkitAppRegion:'no-drag',
            transition:'border-color 150ms'
          }}
        />
        <div style={{fontSize:'10px', color:'rgba(255,255,255,0.2)', marginTop:'5px', textAlign:'right'}}>
          ⌘↵ to submit · Esc to cancel
        </div>
      </div>

      {/* Divider */}
      <div style={{height:'0.5px', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)', margin:'0 18px'}}/>

      {/* Submit row */}
      <div style={{padding:'12px 18px 16px'}}>
        <button
          onClick={() => text.trim() && onSubmit(text.trim())}
          disabled={!text.trim()}
          style={{
            width:'100%', height:'38px',
            background: text.trim()
              ? 'linear-gradient(135deg,rgba(10,132,255,0.92),rgba(10,100,220,0.92))'
              : 'rgba(255,255,255,0.06)',
            color: text.trim() ? 'white' : 'rgba(255,255,255,0.25)',
            border:'none', borderRadius:'10px',
            fontSize:'13px', fontWeight:600, fontFamily:'inherit',
            cursor: text.trim() ? 'pointer' : 'default',
            boxShadow: text.trim() ? '0 2px 16px rgba(10,132,255,0.35)' : 'none',
            transition:'all 200ms'
          }}
        >
          Generate prompt
        </button>
      </div>
    </div>
  )
}
```

Notes:
- `mode` prop removed — handleTypingSubmit in App.jsx reads mode from its own closure. TypingState has no need for it.
- `resizeWindow` is passed as prop (not imported from hook) to avoid double-hook instantiation.
- `handleChange` extracts to a named function to keep onKeyDown and onChange readable.
- No `useCallback` needed — this component re-renders on every keystroke already.

**Acceptance criteria**:
- [ ] File exists at `src/renderer/components/TypingState.jsx`
- [ ] Textarea auto-focuses via setTimeout 50ms
- [ ] Textarea value is controlled (value + onChange)
- [ ] Border is blue when text present, faint when empty
- [ ] Submit button disabled and grey when empty
- [ ] Submit button blue gradient when text present
- [ ] ⌘↵ calls onSubmit(text.trim())
- [ ] Esc calls onDismiss()
- [ ] "Switch to voice" calls onDismiss('voice')
- [ ] resizeWindow called on every text change with clamped height

**Self-verify**: Read TypingState.jsx. Confirm no dangerouslySetInnerHTML. Confirm controlled textarea. Confirm handleChange updates height.
**Test requirement**: `npm run build:renderer` exits 0. No lint errors.
**⚠️ Boundaries**: No dangerouslySetInnerHTML. No direct localStorage access. No new IPC channels. All styles inline.
**CODEBASE.md update?**: No — deferred to TXT-005.
**Architecture compliance**: Inline styles only (matches IteratingState). Controlled textarea value. textContent-equivalent via JSX text nodes.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### TXT-003 · Update IdleState.jsx — keyboard icon button + subtitle
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (first two criteria)
- **Dependencies**: TXT-001
- **Touches**: `src/renderer/components/IdleState.jsx`

**What to do**:
1. Add `onTypePrompt` to the function signature: `export default function IdleState({ mode, modeLabel, onStart, onTypePrompt })`
2. Update the non-refine subtitle from:
   `'Press ⌥ Space or click to speak your prompt'`
   to: `'⌥ Space to speak · ⌘T to type'`
   (Keep the refine subtitle unchanged.)
3. Add the keyboard icon button between the text block and the mode pill. The idle-area `<div>` uses `position: relative` and absolute positioning for the mic ring (left) and mode pill (right). Insert the keyboard icon button as an absolutely positioned element at `right: 140px`.

   **Position calculation:** mode pill is `right:20px`, `padding:7px 16px` (32px total H-padding), `minWidth:80px` → total pill width ~112px → pill left edge is ~132px from right. Keyboard button (32px wide) at `right:140px` places its right edge at 140px from container-right — 8px clear of the pill's left edge. No overlap.

   ```jsx
   {/* Keyboard icon button — type prompt */}
   <div
     onClick={onTypePrompt}
     title="Type prompt (⌘T)"
     style={{
       position:'absolute', right:'140px',
       width:'32px', height:'32px', borderRadius:'9px',
       background:'rgba(255,255,255,0.05)',
       border:'0.5px solid rgba(255,255,255,0.1)',
       display:'flex', alignItems:'center', justifyContent:'center',
       cursor:'pointer', flexShrink:0,
       WebkitAppRegion:'no-drag',
       transition:'background 150ms'
     }}
     onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
     onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
   >
     <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
       <rect x="1" y="1" width="12" height="8" rx="2" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2"/>
       <line x1="3.5" y1="4" x2="10.5" y2="4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round"/>
       <line x1="3.5" y1="6.5" x2="7.5" y2="6.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round"/>
     </svg>
   </div>
   ```

**Acceptance criteria**:
- [ ] Keyboard icon button visible in IDLE bar
- [ ] Button positioned to the left of the mode pill without overlap
- [ ] Clicking button calls `onTypePrompt`
- [ ] Hover changes background from 0.05 → 0.10 opacity
- [ ] Non-refine subtitle reads `'⌥ Space to speak · ⌘T to type'`
- [ ] Refine subtitle unchanged

**Self-verify**: Read IdleState.jsx. Confirm onTypePrompt prop used. Confirm subtitle change. Confirm no Tailwind on the new button.
**Test requirement**: `npm run lint` 0 errors.
**⚠️ Boundaries**: Do not change any other IdleState behaviour. Refine mode subtitle must remain unchanged.
**CODEBASE.md update?**: No — deferred to TXT-005.
**Architecture compliance**: `WebkitAppRegion: 'no-drag'` on interactive element. Inline styles.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### TXT-004 · Wire TYPING render + handleTypingSubmit + ⌘T in App.jsx + ShortcutsPanel
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#5-integration-points
- **Dependencies**: TXT-002, TXT-003
- **Touches**: `src/renderer/App.jsx`, `src/renderer/components/ShortcutsPanel.jsx`

**What to do**:

**App.jsx — 4 changes:**

1. **Add `handleTypingSubmit` function** (place near `handleRegenerate`):
```js
async function handleTypingSubmit(typedText) {
  isIterated.current = false
  originalTranscript.current = typedText
  setThinkTranscript(typedText)
  transition(STATES.THINKING)
  resizeWindow(320)

  if (!window.electronAPI) {
    transition(STATES.ERROR, { message: 'Electron API not available' })
    return
  }

  const genResult = await window.electronAPI.generatePrompt(typedText, mode)
  if (!genResult.success) {
    transition(STATES.ERROR, { message: genResult.error || 'Claude error' })
    return
  }

  setGeneratedPrompt(genResult.prompt)
  saveToHistory({ transcript: typedText, prompt: genResult.prompt, mode })
  transition(STATES.PROMPT_READY)
}
```

2. **Add ⌘T to the keydown handler** (in the `handleKeyDown` function, after the ⌘h block):
```js
if (meta && e.key === 't' && stateRef.current === STATES.IDLE) {
  e.preventDefault()
  transition(STATES.TYPING)
  return
}
```

3. **Pass `onTypePrompt` to IdleState**:
```jsx
<IdleState
  mode={mode}
  modeLabel={modeLabel}
  onStart={startRecording}
  onTypePrompt={() => transition(STATES.TYPING)}
/>
```

4. **Add TYPING render block** (after the ITERATING block, before THINKING):
```jsx
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

**ShortcutsPanel.jsx — 1 change:**

Add `{ desc: 'Type prompt', keys: ['⌘', 'T'] }` to the `shortcuts` array after `{ desc: 'Open history', keys: ['⌘', 'H'] }`.

**Acceptance criteria**:
- [ ] `handleTypingSubmit` calls `generatePrompt` with typed text and current mode
- [ ] `handleTypingSubmit` sets `originalTranscript.current` and `thinkTranscript`
- [ ] `handleTypingSubmit` resets `isIterated.current = false`
- [ ] ⌘T keydown fires only when `stateRef.current === STATES.IDLE`
- [ ] IdleState receives `onTypePrompt` prop
- [ ] TYPING render block has h-[28px] traffic light spacer
- [ ] TypingState receives `mode`, `onDismiss`, `onSubmit`, `resizeWindow`
- [ ] onDismiss('voice') calls `startRecording()`
- [ ] onDismiss() (no arg) calls `transition(STATES.IDLE)`
- [ ] ShortcutsPanel has ⌘T row
- [ ] `npm run build:renderer` exits 0
- [ ] `npm run lint` exits 0

**Self-verify**: Full flow test: open app → ⌘T → type → ⌘↵ → THINKING → PROMPT_READY.
**Test requirement**: Manual smoke checklist (13 items) must pass.
**⚠️ Boundaries**: `handleTypingSubmit` must reset `isIterated.current = false` (prevents iterate badge appearing on typed prompts). Do not call `startRecording` from the keydown handler directly — call `transition(STATES.TYPING)` only; let TypingState handle the voice switch.
**CODEBASE.md update?**: No — deferred to TXT-005.
**Architecture compliance**: `transition()` for all state changes. `originalTranscript.current` set once at submit. `saveToHistory` with typed transcript.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### TXT-005 · CODEBASE.md update
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_PLAN.md#10-codebase-md-sections-to-update
- **Dependencies**: TXT-004
- **Touches**: `vibe/CODEBASE.md`

**What to do**:
1. **File map** — add row after IteratingState.jsx:
   ```
   | `src/renderer/components/TypingState.jsx` | TYPING state panel — textarea, ⌘↵ submit, dismiss, switch-to-voice, dynamic height 220–320px. All styles inline. | props: mode, onDismiss, onSubmit, resizeWindow |
   ```

2. **State machine table** — add row:
   ```
   | `TYPING` | TypingState | 220–320px | h-[28px] traffic light spacer; textarea + submit button; dynamic height based on line count (220 base + 40/4 lines, max 320) |
   ```

3. **React state + refs** — no new refs or state needed (handleTypingSubmit uses existing `originalTranscript.current`, `isIterated.current`, and `thinkTranscript`/`generatedPrompt` state). No entry needed.

**Acceptance criteria**:
- [ ] TypingState.jsx row in File map table
- [ ] TYPING row in State machine table with correct height range

**Self-verify**: Read CODEBASE.md. Confirm both rows present and accurate.
**Test requirement**: None.
**⚠️ Boundaries**: Only update CODEBASE.md sections listed above. Do not rewrite unrelated sections.
**CODEBASE.md update?**: Yes — this IS the CODEBASE.md update task.
**Architecture compliance**: CODEBASE.md kept current per CLAUDE.md rule.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: FEATURE-014 Text Input
> Tick after every task. All items ✅ before feature is shippable.
- [ ] TYPING state added to STATES and STATE_HEIGHTS
- [ ] ⌘T shortcut fires only from IDLE
- [ ] Textarea auto-focuses within 50ms of TYPING state entering
- [ ] Submit disabled when empty; enabled with text
- [ ] ⌘↵ submits text
- [ ] Esc dismisses to IDLE
- [ ] Switch to voice triggers startRecording()
- [ ] Typed text flows through generate-prompt IPC unchanged
- [ ] originalTranscript.current set to typed text before THINKING
- [ ] isIterated.current reset to false on typing submit
- [ ] History saved with typed transcript
- [ ] Dynamic height 220–320px based on line count
- [ ] ⌘T listed in ShortcutsPanel
- [ ] Lint clean (0 errors)
- [ ] Manual smoke checklist passes (all 13 items below)
- [ ] CODEBASE.md updated

**Manual smoke checklist:**
- [ ] Keyboard icon appears in idle bar between text and mode pill
- [ ] Clicking icon opens typing state at 220px
- [ ] ⌘T shortcut opens typing state from idle
- [ ] Textarea auto-focuses on open
- [ ] Typing shows blue border on textarea
- [ ] Generate prompt button activates when text is not empty
- [ ] ⌘↵ submits text
- [ ] Esc dismisses back to idle
- [ ] Switch to voice button starts recording
- [ ] Submitted text goes through THINKING → PROMPT_READY
- [ ] YOU SAID shows the typed text
- [ ] History saves typed prompts correctly
- [ ] Mode selection applies to typed prompts same as voice
