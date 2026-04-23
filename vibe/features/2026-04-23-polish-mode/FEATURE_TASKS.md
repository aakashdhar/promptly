# FEATURE_TASKS.md — FEATURE-015: Polish Mode
> Created: 2026-04-23
> Folder: vibe/features/2026-04-23-polish-mode/

> **Estimated effort:** 7 tasks — S: 4 (<2hrs each), M: 3 (2-4hrs each) — approx. 14-18 hours total

---

### POL-001 · main.js + preload.js — polish mode entry + IPC options
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#mode-system
- **Dependencies**: None
- **Touches**: `main.js`, `preload.js`

**What to do**:

1. In `main.js` `MODE_CONFIG` add after `design`:
```js
polish: {
  name: 'Polish',
  standalone: true,
  instruction: `You are an expert editor and writing coach. The user has spoken something rough — with filler words, repetition, grammatical errors, or unclear phrasing. Your job is to return two things and nothing else:

1. The polished version of what they said — clean, grammatically correct, well-phrased prose that preserves their exact meaning and intent.
2. A brief list of what you changed — maximum 4 bullet points, each under 10 words.

Tone: {TONE}

Tone guidance:
- Formal: professional, precise, suitable for workplace communication, emails, reports
- Casual: warm, natural, conversational, suitable for messages, slack, informal notes

Output format — return EXACTLY this structure with these exact labels, nothing else:

POLISHED:
{the polished text here}

CHANGES:
· {change note 1}
· {change note 2}
· {change note 3}

Rules:
1. Preserve the user's meaning exactly — do not add information they did not say
2. Remove filler words (uh, um, so basically, you know, like)
3. Fix repeated words, run-on sentences, grammatical errors
4. Keep it concise — do not pad or elaborate beyond what was said
5. CHANGES must be brief observations, not explanations
6. If the input is already clean, say so in CHANGES: "· Text was already well-formed"
7. Output ONLY the two sections above — no preamble, no sign-off

The user said:
"{TRANSCRIPT}"`
},
```

2. In `show-mode-menu` modes array, add `{ key: 'polish', label: 'Polish' }` after `{ key: 'refine', label: 'Refine' }`.

3. In `generate-prompt` handler, change destructure from:
```js
ipcMain.handle('generate-prompt', (_event, { transcript, mode }) => {
```
to:
```js
ipcMain.handle('generate-prompt', (_event, { transcript, mode, options = {} }) => {
```
Then after `const systemPrompt = ...` computation (after the ternary that builds it), add:
```js
if (mode === 'polish') {
  const tone = options.tone || 'formal'
  systemPrompt = systemPrompt.replace('{TONE}', tone.charAt(0).toUpperCase() + tone.slice(1))
}
```
Note: `systemPrompt` must be declared with `let` not `const` for this mutation. Change `const systemPrompt =` to `let systemPrompt =`.

4. In `preload.js`, update `generatePrompt`:
```js
generatePrompt: (transcript, mode, options) =>
  ipcRenderer.invoke('generate-prompt', { transcript, mode, options }),
```

**Acceptance criteria**:
- [ ] `polish` key in `MODE_CONFIG` with `standalone: true` and system prompt containing `{TONE}` and `{TRANSCRIPT}`
- [ ] `{ key: 'polish', label: 'Polish' }` in `show-mode-menu` modes array
- [ ] `generate-prompt` handler destructures `options = {}` from payload
- [ ] `{TONE}` replaced with `Formal` or `Casual` when `mode === 'polish'`
- [ ] `preload.js generatePrompt` passes `options` as part of IPC payload
- [ ] All other modes call with `options = undefined` and still work (backwards compatible)

**Self-verify**: Run `npm run lint` — must be 0 errors.
**Test requirement**: Manual — right-click bar, verify Polish appears in context menu.
**⚠️ Boundaries**: Do NOT touch the `generate-raw` IPC handler. Do NOT change how `{TRANSCRIPT}` is replaced — it uses `standalone ? instruction.replace('{TRANSCRIPT}', transcript) : PROMPT_TEMPLATE...`. The `{TONE}` replacement happens after `systemPrompt` is assigned.
**CODEBASE.md update?**: No — deferred to POL-007.
**Architecture compliance**: IPC pattern from ARCHITECTURE.md; backwards-compatible options parameter.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### POL-002 · useTone.js + useMode.js MODE_LABELS
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#tone-persistence
- **Dependencies**: POL-001 (none strictly, but logically sequential)
- **Touches**: `src/renderer/hooks/useTone.js` (new), `src/renderer/hooks/useMode.js`

**What to do**:

1. Create `src/renderer/hooks/useTone.js`:
```js
import { useState } from 'react'

const TONE_KEY = 'promptly_polish_tone'

export function getPolishTone() {
  return localStorage.getItem(TONE_KEY) || 'formal'
}

export function setPolishTone(tone) {
  localStorage.setItem(TONE_KEY, tone)
}

export default function usePolishTone() {
  const [tone, setToneState] = useState(() => getPolishTone())

  function setTone(t) {
    setPolishTone(t)
    setToneState(t)
  }

  return { tone, setTone }
}
```

2. In `src/renderer/hooks/useMode.js`, add `polish: 'Polish'` to `MODE_LABELS`:
```js
const MODE_LABELS = {
  balanced: 'Balanced',
  detailed: 'Detailed',
  concise: 'Concise',
  chain: 'Chain',
  code: 'Code',
  design: 'Design',
  refine: 'Refine',
  polish: 'Polish',
}
```

**Acceptance criteria**:
- [ ] `src/renderer/hooks/useTone.js` created with `getPolishTone`, `setPolishTone`, `usePolishTone` exports
- [ ] `getPolishTone()` returns `'formal'` by default when no localStorage value
- [ ] `setPolishTone('casual')` writes `'casual'` to `promptly_polish_tone` key
- [ ] `polish: 'Polish'` in `MODE_LABELS` — mode pill shows 'Polish' when mode is polish
- [ ] `npm run build:renderer` succeeds

**Self-verify**: Re-read FEATURE_SPEC.md#tone-persistence. Confirm `TONE_KEY = 'promptly_polish_tone'`.
**Test requirement**: None — unit-testable but project uses manual smoke.
**⚠️ Boundaries**: Never access `localStorage.promptly_polish_tone` directly outside `useTone.js`. No other localStorage keys added.
**CODEBASE.md update?**: No — deferred to POL-007.
**Architecture compliance**: localStorage wrapper pattern from ARCHITECTURE.md (all localStorage via wrapper functions only).

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### POL-003 · IdleState.jsx — polish visual identity + tone toggle
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#idlestate-visual-identity
- **Dependencies**: POL-002
- **Touches**: `src/renderer/components/IdleState.jsx`

**What to do**:

1. Update IdleState props signature to include `polishTone` and `onPolishToneChange`:
```jsx
export default function IdleState({ mode, modeLabel, onStart, onTypePrompt, polishTone, onPolishToneChange })
```

2. Add `const isPolish = mode === 'polish'` alongside existing `const isRefine = mode === 'refine'`.

3. Update pulse ring colours — extend existing refine ternary to include polish (green):
```js
const ringColor = isPolish ? 'rgba(48,209,88,' : isRefine ? 'rgba(168,85,247,' : 'rgba(10,132,255,'
```

4. Update pulse ring `boxShadow`:
```js
boxShadow: isPolish
  ? '0 0 12px rgba(48,209,88,0.2)'
  : isRefine
    ? '0 0 12px rgba(168,85,247,0.2)'
    : '0 0 12px rgba(10,132,255,0.3), 0 0 24px rgba(10,132,255,0.12)',
```

5. Update pulse ring animation border-colors:
- First ring: `border: \`1.5px solid ${ringColor}0.35)\`` — uses `ringColor` already, no change needed
- Second ring: `border: \`1px solid ${ringColor}0.18)\`` — same

6. Replace the mic SVG block with conditional rendering:
```jsx
{isPolish ? (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M2 4h12M2 8h8M2 12h10" stroke="rgba(100,220,130,0.9)" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="13" cy="12" r="2.5" fill="rgba(48,209,88,0.3)" stroke="rgba(100,220,130,0.8)" strokeWidth="1"/>
    <path d="M12 12l1 1 1.5-1.5" stroke="rgba(100,220,130,0.9)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
) : (
  <svg width="13" height="15" viewBox="0 0 12 16" fill="none" style={{ animation: 'mic-breathe 3s ease-in-out infinite' }}>
    <rect x="3.5" y="0.5" width="5" height="9" rx="2.5" stroke={micStroke} strokeWidth="1" />
    <path d="M1 8.5C1 11.26 3.24 13.5 6 13.5C8.76 13.5 11 11.26 11 8.5" stroke={micStrokeFaded} strokeWidth="1" strokeLinecap="round" />
    <line x1="6" y1="13.5" x2="6" y2="15.5" stroke={micStrokeFaded} strokeWidth="1" strokeLinecap="round" />
  </svg>
)}
```

Keep `micStroke` and `micStrokeFaded` variables — they're only used in the non-polish branch now.

7. Update subtitle:
```jsx
{isPolish ? "Speak it rough — get it polished" : isRefine ? "Describe what exists, what's wrong, and what you want" : '⌥ Space to speak · ⌘T to type'}
```

8. Replace the mode pill with tone toggle when polish mode. Find the `<span id="mode-pill" ...>` block and replace with:
```jsx
{isPolish ? (
  <div style={{
    position:'absolute', right:'20px',
    display:'flex', background:'rgba(255,255,255,0.05)',
    border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:'20px',
    padding:'2px', gap:'2px', flexShrink:0, WebkitAppRegion:'no-drag'
  }}>
    {['Formal','Casual'].map(t => (
      <div
        key={t}
        onClick={(e) => { e.stopPropagation(); onPolishToneChange(t.toLowerCase()) }}
        style={{
          padding:'3px 10px', borderRadius:'16px', fontSize:'10px',
          fontWeight: polishTone === t.toLowerCase() ? 500 : 400,
          cursor:'pointer',
          background: polishTone === t.toLowerCase() ? 'rgba(48,209,88,0.15)' : 'transparent',
          border: polishTone === t.toLowerCase() ? '0.5px solid rgba(48,209,88,0.25)' : '0.5px solid transparent',
          color: polishTone === t.toLowerCase() ? 'rgba(100,220,130,0.9)' : 'rgba(255,255,255,0.3)'
        }}
      >
        {t}
      </div>
    ))}
  </div>
) : (
  <span className="absolute right-[20px] rounded-full text-[10px] font-medium tracking-[0.03em]"
    id="mode-pill"
    style={{
      WebkitAppRegion: 'no-drag',
      padding: '7px 16px',
      minWidth: '80px',
      textAlign: 'center',
      background: isRefine ? 'rgba(168,85,247,0.12)' : 'rgba(10,132,255,0.12)',
      border: isRefine ? '0.5px solid rgba(168,85,247,0.3)' : '0.5px solid rgba(10,132,255,0.25)',
      color: isRefine ? 'rgba(200,160,255,1.0)' : 'rgba(100,180,255,0.85)',
    }}
    onClick={handleModePillClick}
  >
    {modeLabel}
  </span>
)}
```

**Acceptance criteria**:
- [ ] Pulse ring uses rgba(48,209,88,*) when mode === 'polish'
- [ ] Lines/text icon shown instead of mic when mode === 'polish'
- [ ] Subtitle 'Speak it rough — get it polished' when mode === 'polish'
- [ ] Tone toggle (Formal/Casual) shown instead of mode pill when mode === 'polish'
- [ ] Tone toggle reflects current `polishTone` value
- [ ] Clicking a tone option calls `onPolishToneChange(tone)` and does NOT call `showModeMenu`
- [ ] Other modes (balanced, refine, etc.) unaffected
- [ ] `npm run lint` 0 errors; `npm run build:renderer` succeeds

**Self-verify**: Re-read FEATURE_SPEC.md#idlestate-visual-identity. Check every visual item is covered.
**Test requirement**: Manual — switch to Polish mode via right-click → verify green ring, lines icon, subtitle, Formal/Casual toggle appear.
**⚠️ Boundaries**: Do NOT modify the pulse animation `@keyframes` in index.css — the existing pulse-inner and pulse-expand animations already use the `border` color set via inline style, so ring colors update automatically. Do NOT move `onPolishToneChange` calls inside `handleModePillClick` — the tone toggle and mode pill are separate click targets.
**CODEBASE.md update?**: No — deferred to POL-007.
**Architecture compliance**: Props down from App.jsx; no direct localStorage access; inline styles for dynamic values.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### POL-004 · App.jsx Part 1 — parsePolishOutput, polishResult, generate call updates
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#output-parsing, FEATURE_SPEC.md#appjsx-wiring
- **Dependencies**: POL-002 (useTone.js needed)
- **Touches**: `src/renderer/App.jsx`

**What to do**:

1. Add import for `usePolishTone` at top:
```js
import usePolishTone from './hooks/useTone.js'
```

2. Inside `App()`, add hook usage after `useWindowResize`:
```js
const { tone: polishTone, setTone: setPolishToneValue } = usePolishTone()
```

3. Add `polishResult` state:
```js
const [polishResult, setPolishResult] = useState(null)
```

4. Add `parsePolishOutput` function (outside App component, before the export):
```js
function parsePolishOutput(raw) {
  const polishedMatch = raw.match(/POLISHED:\n([\s\S]*?)(?:\n\nCHANGES:|$)/)
  const changesMatch = raw.match(/CHANGES:\n([\s\S]*)$/)
  return {
    polished: polishedMatch ? polishedMatch[1].trim() : raw.trim(),
    changes: changesMatch
      ? changesMatch[1].trim().split('\n').filter(l => l.trim())
      : []
  }
}
```

5. In `stopRecording onstop`, after `setGeneratedPrompt(genResult.prompt)`, add polish parse:
```js
if (mode === 'polish') {
  const parsed = parsePolishOutput(genResult.prompt)
  setPolishResult(parsed)
  setGeneratedPrompt(parsed.polished)
} else {
  setPolishResult(null)
  setGeneratedPrompt(genResult.prompt)
}
```
Replace the existing `setGeneratedPrompt(genResult.prompt)` line.

Also update the `generatePrompt` call to pass tone:
```js
const genResult = await window.electronAPI.generatePrompt(text, mode, mode === 'polish' ? { tone: polishTone } : undefined)
```

6. In `handleTypingSubmit`, same pattern for `generatePrompt` call and `setGeneratedPrompt`:
```js
const genResult = await window.electronAPI.generatePrompt(typedText, mode, mode === 'polish' ? { tone: polishTone } : undefined)
// then:
if (mode === 'polish') {
  const parsed = parsePolishOutput(genResult.prompt)
  setPolishResult(parsed)
  setGeneratedPrompt(parsed.polished)
} else {
  setPolishResult(null)
  setGeneratedPrompt(genResult.prompt)
}
```

7. In `handleRegenerate`, same pattern:
```js
const genResult = await window.electronAPI.generatePrompt(originalTranscript.current, mode, mode === 'polish' ? { tone: polishTone } : undefined)
// then the same if/else parse block
```

8. Pass `polishTone` and `onPolishToneChange` props to `IdleState`:
```jsx
<IdleState
  mode={mode}
  modeLabel={modeLabel}
  onStart={startRecording}
  onTypePrompt={() => transition(STATES.TYPING)}
  polishTone={polishTone}
  onPolishToneChange={setPolishToneValue}
/>
```

Note: `setPolishToneValue` only updates localStorage + React state; the tone-change-and-regenerate logic is `handlePolishToneChange` which is added in POL-006.

**Acceptance criteria**:
- [ ] `usePolishTone` imported and used in App.jsx
- [ ] `polishResult` state added
- [ ] `parsePolishOutput` function defined (pure function, no side effects)
- [ ] `stopRecording` passes `{ tone: polishTone }` for polish mode, `undefined` otherwise
- [ ] `handleTypingSubmit` same
- [ ] `handleRegenerate` same
- [ ] polish parse applied after generation in all 3 functions
- [ ] `IdleState` receives `polishTone` and `onPolishToneChange={setPolishToneValue}` props
- [ ] `npm run lint` 0 errors; `npm run build:renderer` succeeds

**Self-verify**: Re-read FEATURE_SPEC.md#output-parsing. Verify `parsePolishOutput` handles missing POLISHED/CHANGES labels gracefully.
**Test requirement**: Manual — after POL-005 and POL-006 are done, speak in Polish mode and verify output is parsed.
**⚠️ Boundaries**: Do NOT modify `handleIterate`. **Stale closure fix (mandatory):** Add `const polishToneRef = useRef(polishTone)` and `useEffect(() => { polishToneRef.current = polishTone }, [polishTone])` in App.jsx. Use `polishToneRef.current` inside the three generate calls instead of `polishTone` directly — otherwise the tone will silently always be `'formal'` after the initial render.
**CODEBASE.md update?**: No — deferred to POL-007.
**Architecture compliance**: `usePolishTone` hook wraps localStorage; `polishResult` is regular useState; `parsePolishOutput` is a pure function.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### POL-005 · PolishReadyState.jsx — new component
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#polishreadystate-component
- **Dependencies**: POL-002
- **Touches**: `src/renderer/components/PolishReadyState.jsx` (new)

**What to do**:

Create `src/renderer/components/PolishReadyState.jsx` with all inline styles. Use the exact component structure from FEATURE_SPEC.md Part 5 as the reference.

Props: `{ polished, changes, transcript, tone, onReset, onCopy, copied, onToneChange }`
Note: `onEdit` prop removed — Edit button is hidden in v1 (spec review P1-002 fix).

Key sections:
1. Top row — ✓ "Polished & ready" + tone toggle (Formal/Casual) + Reset button
2. Divider
3. "You said" label + transcript (clamped 2 lines with `-webkit-line-clamp: 2`)
4. Divider
5. "Polished text" label (green) + polished text body
6. "What changed" card (conditional on `changes.length > 0`) — green-tinted border box
7. Action row — Copy text button only (full width, primary green); no Edit button

The tone toggle calls `onToneChange(t.toLowerCase())` — this triggers regeneration from App.jsx.
The Copy button shows '✓ Copied' when `copied === true`.

All text uses JSX text nodes — no `dangerouslySetInnerHTML`.

**Acceptance criteria**:
- [ ] File created at correct path
- [ ] All styles inline — no Tailwind classes
- [ ] Top row shows ✓ + "Polished & ready" + tone toggle + Reset
- [ ] Tone toggle uses green active colours and calls `onToneChange`
- [ ] "You said" section shows `transcript` (plain text, 2-line clamp)
- [ ] "Polished text" section shows `polished` in white
- [ ] "What changed" card renders when `changes.length > 0`
- [ ] Change notes rendered as individual lines (not innerHTML — map over array)
- [ ] Copy button copies polished text only; shows '✓ Copied' for flash state
- [ ] `npm run build:renderer` succeeds (no import errors)

**Self-verify**: Re-read FEATURE_SPEC.md Part 5 and compare every prop and section.
**Test requirement**: Manual smoke after POL-006 wires it in.
**⚠️ Boundaries**: Do NOT use `dangerouslySetInnerHTML`. Render `changes` with `.map()`. Do NOT import any CSS modules or Tailwind utilities.
**CODEBASE.md update?**: No — deferred to POL-007.
**Architecture compliance**: All inline styles; JSX text nodes only; props down.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### POL-006 · App.jsx Part 2 — render PolishReadyState, toneChange handler, history
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#appjsx-wiring, FEATURE_SPEC.md#history-integration
- **Dependencies**: POL-004, POL-005
- **Touches**: `src/renderer/App.jsx`, `src/renderer/utils/history.js`

**What to do**:

**history.js — extend saveToHistory:**
Add `polishChanges = null` to the signature and store it:
```js
export function saveToHistory({ transcript, prompt, mode, isIteration = false, basedOn = null, polishChanges = null }) {
  const history = getHistory()
  const words = transcript.split(' ')
  const title = words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '')
  const entry = { id: Date.now(), title, transcript, prompt, mode, timestamp: new Date().toISOString() }
  if (isIteration) entry.isIteration = true
  if (basedOn) entry.basedOn = basedOn
  if (polishChanges) entry.polishChanges = polishChanges
  history.unshift(entry)
  if (history.length > MAX_ENTRIES) history.splice(MAX_ENTRIES)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}
```

**App.jsx — import PolishReadyState:**
```js
import PolishReadyState from './components/PolishReadyState.jsx'
```

**App.jsx — add [copied, setCopied] state:**
```js
const [copied, setCopied] = useState(false)
```

**App.jsx — add handlePolishToneChange:**
```js
const handlePolishToneChange = useCallback(async (newTone) => {
  setPolishToneValue(newTone)
  transition(STATES.THINKING)
  setThinkTranscript(originalTranscript.current)
  resizeWindow(320)
  if (!window.electronAPI) {
    transition(STATES.ERROR, { message: 'Electron API not available' })
    return
  }
  const genResult = await window.electronAPI.generatePrompt(originalTranscript.current, 'polish', { tone: newTone })
  if (!genResult.success) {
    transition(STATES.ERROR, { message: genResult.error || 'Claude error' })
    return
  }
  const parsed = parsePolishOutput(genResult.prompt)
  setPolishResult(parsed)
  setGeneratedPrompt(parsed.polished)
  saveToHistory({ transcript: originalTranscript.current, prompt: parsed.polished, mode: 'polish', polishChanges: parsed.changes })
  transition(STATES.PROMPT_READY)
}, [])
```

**App.jsx — update saveToHistory calls for polish mode:**
In `stopRecording onstop`:
```js
saveToHistory({ transcript: text, prompt: parsed.polished, mode, polishChanges: parsed.changes })
// (replaces the existing saveToHistory call, only for polish branch)
```
For non-polish branch (or add polishChanges: undefined — same as null, ignored):
```js
saveToHistory({ transcript: text, prompt: genResult.prompt, mode })
```

Same update in `handleTypingSubmit` and `handleRegenerate` polish branches.

**App.jsx — update PROMPT_READY render block:**
Replace:
```jsx
{displayState === STATES.PROMPT_READY && (
  <PromptReadyState ... />
)}
```
With:
```jsx
{displayState === STATES.PROMPT_READY && mode !== 'polish' && (
  <PromptReadyState ... />
)}
{displayState === STATES.PROMPT_READY && mode === 'polish' && (
  <PolishReadyState
    polished={polishResult?.polished || generatedPrompt}
    changes={polishResult?.changes || []}
    transcript={originalTranscript.current}
    tone={polishTone}
    onReset={() => transition(STATES.IDLE)}
    onCopy={() => {
      navigator.clipboard.writeText(polishResult?.polished || generatedPrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }}
    copied={copied}
    onToneChange={handlePolishToneChange}
  />
)}
```

**App.jsx — update onReuse in HistoryPanel render:**
```jsx
onReuse={(entry) => {
  originalTranscript.current = entry.transcript
  setGeneratedPrompt(entry.prompt)
  if (entry.mode === 'polish') {
    setPolishResult({ polished: entry.prompt, changes: entry.polishChanges || [] })
  } else {
    setPolishResult(null)
  }
  if (window.electronAPI) window.electronAPI.setWindowSize(520, STATE_HEIGHTS.PROMPT_READY)
  transition(STATES.PROMPT_READY)
}}
```

**Acceptance criteria**:
- [ ] `history.js saveToHistory` accepts and stores `polishChanges` field
- [ ] `PolishReadyState` imported and rendered when `mode === 'polish'` + `PROMPT_READY`
- [ ] `PromptReadyState` only rendered when `mode !== 'polish'` + `PROMPT_READY`
- [ ] `handlePolishToneChange` re-runs generation and parses fresh output
- [ ] `onCopy` copies `polishResult?.polished` (not full raw Claude output)
- [ ] `copied` state flashes for 1.8s then resets
- [ ] `onReuse` sets `polishResult` for polish history entries
- [ ] `npm run lint` 0 errors; `npm run build:renderer` succeeds

**Self-verify**: Re-read FEATURE_SPEC.md#appjsx-wiring. Verify ALL 3 generate flows (stopRecording, handleTypingSubmit, handleRegenerate) have polish parsing.
**Test requirement**: Manual smoke — full flow from speak → polish output → copy, and tone toggle regeneration.
**⚠️ Boundaries**: Do NOT add an `onEdit` prop or Edit button to PolishReadyState — edit mode is out of scope and a non-functional button is worse than no button (spec review P1-002). Do NOT pass `isIterated` to PolishReadyState — not applicable.
**CODEBASE.md update?**: No — deferred to POL-007.
**Architecture compliance**: `useCallback` for async handlers; `saveToHistory` through `utils/history.js`; no direct localStorage access.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### POL-007 · HistoryPanel.jsx — green mode tag + polish reuse + CODEBASE.md
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#history-integration
- **Dependencies**: POL-006
- **Touches**: `src/renderer/components/HistoryPanel.jsx`, `vibe/CODEBASE.md`

**What to do**:

**HistoryPanel.jsx — green mode tag for polish entries:**
Find the mode tag `<span>` in the entry meta row. Add `isPolish` detection:
```jsx
const isPolish = entry.mode === 'polish'
// update background and color:
background: isSelected
  ? isPolish ? 'rgba(48,209,88,0.15)' : 'rgba(10,132,255,0.15)'
  : 'rgba(255,255,255,0.07)',
color: isSelected
  ? isPolish ? 'rgba(100,220,130,0.85)' : 'rgba(100,180,255,0.85)'
  : 'rgba(255,255,255,0.70)'
```

**HistoryPanel.jsx — right panel detail (selected entry):**
For polish entries, the right panel renders `renderPromptSections(selected.prompt)`. Since `selected.prompt` is plain polished prose (no section labels like `ROLE:`, `TASK:`), it renders as regular text lines — which is acceptable. No special changes needed.

Optionally (if desired), add a "What changed" note display for polish entries in the detail panel. This is a nice touch — add after the copy/reuse buttons:
```jsx
{selected.polishChanges && selected.polishChanges.length > 0 && (
  <div style={{margin:'12px 20px 0', padding:'10px 12px', background:'rgba(48,209,88,0.04)', border:'0.5px solid rgba(48,209,88,0.12)', borderRadius:'10px'}}>
    <div style={{fontSize:'9px', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(48,209,88,0.5)', marginBottom:'6px'}}>Changes made</div>
    {selected.polishChanges.map((note, i) => (
      <div key={i} style={{fontSize:'11.5px', color:'rgba(255,255,255,0.45)', lineHeight:1.5}}>{note}</div>
    ))}
  </div>
)}
```

**CODEBASE.md updates:**
1. File map: add `useTone.js` row and `PolishReadyState.jsx` row
2. localStorage keys: add `promptly_polish_tone` row
3. React state + refs: add `polishResult` useState row and `polishTone` hook
4. IPC channels: note `generate-prompt` now accepts optional `options: {}` with `options.tone` for polish
5. `MODE_CONFIG` in module-scope variables: update to show 8 modes (add `polish`)
6. Update "Last updated" date to 2026-04-23

**Acceptance criteria**:
- [ ] Polish entries in history list show green mode tag (rgba(100,220,130,0.85) when selected)
- [ ] CODEBASE.md updated: useTone.js, PolishReadyState.jsx, polishResult state, promptly_polish_tone key, 8 modes
- [ ] `npm run lint` 0 errors; `npm run build:renderer` succeeds
- [ ] Full smoke checklist passes (see below)

**Self-verify**: Run through full SMOKE CHECKLIST from FEATURE_SPEC.md conformance checklist.
**Test requirement**: Manual — full smoke test per conformance checklist.
**⚠️ Boundaries**: Do NOT change `renderPromptSections` — it handles polish plain text fine as-is.
**CODEBASE.md update?**: Yes — update all sections listed above.
**Architecture compliance**: Inline styles; no new IPC; CODEBASE.md maintained per project rule.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: FEATURE-015 Polish Mode
> Tick after every task. All items ✅ before feature is shippable.
- [ ] `polish` in MODE_CONFIG with standalone + system prompt with `{TONE}` placeholder
- [ ] `generate-prompt` IPC accepts and uses `options.tone` for polish
- [ ] `promptly_polish_tone` localStorage key + `useTone.js` hook
- [ ] `polish: 'Polish'` in MODE_LABELS
- [ ] IdleState: green ring, lines icon, subtitle, tone toggle when polish
- [ ] `parsePolishOutput` correctly extracts polished text and changes array
- [ ] `PolishReadyState.jsx` renders polished text + change notes + copy button
- [ ] `PolishReadyState` shown in App.jsx when `mode === 'polish'` + `PROMPT_READY`
- [ ] Tone change in output reruns generation
- [ ] Copy text copies polished text only, 1.8s green flash
- [ ] Polish entries save to history with `polishChanges` field
- [ ] HistoryPanel shows green mode tag for polish entries
- [ ] Reuse from history loads `PolishReadyState` correctly
- [ ] All existing modes unaffected
- [ ] `npm run lint` passes (0 errors)
- [ ] `npm run build:renderer` succeeds
- [ ] CODEBASE.md updated
- [ ] DECISIONS.md updated (D-POL-001)
---
