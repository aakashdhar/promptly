# FEATURE_SPEC.md — FEATURE-015: Polish Mode
> Created: 2026-04-23 | Status: Planned
> Folder: vibe/features/2026-04-23-polish-mode/
> ⚠️ UNPLANNED ADDITION — not in original PLAN.md Section 6. Added per user request 2026-04-23.

---

## 1. Feature overview

Add an 8th prompt mode called `polish` that takes rough spoken input and returns clean, grammatically correct, well-phrased prose — not a Claude prompt. The output is the finished content itself (polished text + brief change notes). A Formal/Casual tone toggle persists in localStorage. Green accent throughout distinguishes Polish from other modes.

Unlike all existing modes which produce structured Claude *prompts*, Polish mode produces *finished content* directly. The system prompt outputs two sections: `POLISHED:` (the cleaned text) and `CHANGES:` (up to 4 change notes). App.jsx parses these and displays them in a dedicated `PolishReadyState.jsx` component.

---

## 2. User stories

- As a user, I want to speak rough notes and receive clean, grammatically correct prose I can paste directly into an email, Slack message, or report — without any further editing.
- As a user, I want to toggle between Formal and Casual tone from the idle bar before speaking, so I don't have to edit the output for register.
- As a user, I want to see exactly what was changed so I can learn from the polishing without reading side-by-side diffs.
- As a user, I want the Formal/Casual preference to persist across app restarts.

---

## 3. Acceptance criteria

### Mode system
- [ ] `polish` key present in `MODE_CONFIG` in `main.js` with `standalone: true` and the exact system prompt containing `{TONE}` placeholder
- [ ] `{TONE}` replaced at IPC call time with `Formal` or `Casual` based on `options.tone`
- [ ] `polish` present in `show-mode-menu` modes array in `main.js` — appears in right-click context menu
- [ ] `polish: 'Polish'` in `MODE_LABELS` in `useMode.js` — mode pill shows 'Polish'
- [ ] `generate-prompt` IPC handler accepts `options = {}` as part of `{ transcript, mode, options }` destructure
- [ ] `preload.js generatePrompt` passes `options` argument through to IPC

### Tone persistence
- [ ] New `src/renderer/hooks/useTone.js` exports `getPolishTone()`, `setPolishTone()`, and `usePolishTone()` hook
- [ ] Tone stored under key `promptly_polish_tone` in localStorage — default `'formal'`
- [ ] Tone persists across app restarts

### IdleState visual identity
- [ ] Pulse ring uses green colours (rgba(48,209,88,*)) when mode === 'polish'
- [ ] Pulse ring animation rings use green border-colours when mode === 'polish'
- [ ] Mic SVG replaced with lines/text icon (3 horizontal lines + edit circle) when mode === 'polish'
- [ ] Idle subtitle reads 'Speak it rough — get it polished' when mode === 'polish'
- [ ] Mode pill replaced with Formal/Casual tone toggle when mode === 'polish'
- [ ] Tone toggle active selection uses green background/border/colour
- [ ] Tone toggle persists across mode switches (reads from localStorage each render)

### Output parsing
- [ ] `parsePolishOutput(raw)` function in `App.jsx` extracts `polished` text and `changes` array
- [ ] `polishResult` state (`{ polished, changes }`) stored in App.jsx
- [ ] After successful generation in polish mode: `setPolishResult(parsed)` and `setGeneratedPrompt(parsed.polished)`
- [ ] Parsing applies in `stopRecording`, `handleTypingSubmit`, and `handleRegenerate`

### PolishReadyState component
- [ ] New file `src/renderer/components/PolishReadyState.jsx` — all styles inline
- [ ] Top row shows green ✓ checkmark + "Polished & ready" label and tone toggle + Reset button
- [ ] "You said" section shows original transcript (clamped to 2 lines)
- [ ] "Polished text" section label in green (rgba(48,209,88,0.65))
- [ ] Polished text body in white (rgba(255,255,255,0.88))
- [ ] "What changed" notes section renders when `changes.length > 0` — green-tinted card
- [ ] Edit button is HIDDEN in PolishReadyState v1 — polish edit mode is out of scope; do not render a non-functional button
- [ ] Copy text button copies only `polished` text, not change notes
- [ ] Copy button flashes green ✓ Copied for 1.8s then resets
- [ ] Tone toggle in output calls `onToneChange(tone)` → re-runs generation → updates result

### App.jsx wiring
- [ ] `displayState === STATES.PROMPT_READY && mode === 'polish'` renders `PolishReadyState` instead of `PromptReadyState`
- [ ] `onReset` transitions to IDLE
- [ ] `onToneChange` updates localStorage tone, re-runs `generatePrompt` with new tone, parses fresh output, updates `polishResult` + `generatedPrompt`
- [ ] `polishResult` reset to `null` when entering a non-polish PROMPT_READY (other modes unaffected)

### History integration
- [ ] `saveToHistory` called with `polishChanges: parsed.changes` for polish mode entries
- [ ] `history.js` `saveToHistory` accepts and stores `polishChanges` field
- [ ] HistoryPanel shows green mode tag for polish entries (instead of blue)
- [ ] HistoryPanel Reuse for polish entries sets `polishResult` in App.jsx before transitioning to PROMPT_READY

---

## 4. Scope boundaries

**Included:**
- `polish` in MODE_CONFIG (main.js) + system prompt with `{TONE}` placeholder
- `generate-prompt` IPC `options` passthrough (main.js + preload.js)
- `useTone.js` hook + `promptly_polish_tone` localStorage key
- `polish: 'Polish'` in MODE_LABELS (useMode.js)
- IdleState green visual identity + tone toggle (IdleState.jsx)
- `parsePolishOutput()` + `polishResult` state + generate-prompt calls updated (App.jsx)
- `PolishReadyState.jsx` component (new file, all inline styles)
- App.jsx conditional render + `onToneChange` re-run handler
- `saveToHistory` polishChanges field (history.js)
- HistoryPanel green mode tag + polish reuse (HistoryPanel.jsx)

**Explicitly deferred:**
- Keyboard shortcut to switch to Polish mode directly
- Polish-specific recording or thinking state visual changes
- Export of polish result (uses existing .md export path which copies `generatedPrompt`)
- Iteration mode in polish (not applicable — polish output is final content, not a prompt to iterate)
- ShortcutsPanel polish tone shortcut

---

## 5. Integration points

- `main.js` `MODE_CONFIG` constant — add `polish` after `refine` (line ~63)
- `main.js` `show-mode-menu` IPC — modes array, add `{ key: 'polish', label: 'Polish' }` after `{ key: 'refine', label: 'Refine' }` (line ~544)
- `main.js` `generate-prompt` handler — destructure `options = {}` from payload; `{TONE}` replacement for polish (line ~413)
- `preload.js` `generatePrompt` method — add `options` arg, pass in IPC object (line ~7)
- `src/renderer/hooks/useMode.js` `MODE_LABELS` — add `polish: 'Polish'`
- `src/renderer/hooks/useTone.js` — new file
- `src/renderer/components/IdleState.jsx` — extend refine pattern with polish
- `src/renderer/App.jsx` — usePolishTone(), parsePolishOutput(), polishResult state, generate calls, conditional render
- `src/renderer/components/PolishReadyState.jsx` — new file
- `src/renderer/utils/history.js` `saveToHistory` — add `polishChanges` field
- `src/renderer/components/HistoryPanel.jsx` — green tag for polish entries

No new IPC channels. New localStorage key: `promptly_polish_tone`.

---

## 6. New data model changes

**New localStorage key:**
- `promptly_polish_tone` — string, `'formal'` | `'casual'`, default `'formal'`; managed exclusively by `useTone.js`

**History entry extension:**
- `polishChanges?: string[]` — optional array, present only for `mode === 'polish'` entries

**New App.jsx state:**
- `polishResult: { polished: string, changes: string[] } | null` — set after every polish generation, reset when switching to non-polish mode

---

## 7. New API / IPC changes

**`generate-prompt` IPC — extended, backwards-compatible:**

Before:
```js
// renderer calls:
window.electronAPI.generatePrompt(transcript, mode)
// IPC receives:
{ transcript, mode }
```

After:
```js
// renderer calls:
window.electronAPI.generatePrompt(transcript, mode, options)  // options optional
// IPC receives:
{ transcript, mode, options = {} }
```

`options.tone` is only read when `mode === 'polish'`. All other modes receive `options = {}` and are unaffected.

---

## 8. Edge cases and error states

- If Claude returns output without `POLISHED:` label → `parsePolishOutput` returns `{ polished: raw.trim(), changes: [] }` — degrades gracefully
- If Claude returns output without `CHANGES:` label → `changes: []` — "What changed" section hidden
- Empty transcript after Whisper → same IDLE fallback as all modes
- Claude error → same ERROR state transition as all modes
- Tone change while another generation is in-flight → `onToneChange` is not debounced; user must wait for current generation to complete before changing (acceptable for v1)
- Mode pill (tone toggle) click in IDLE does NOT open context menu when in polish mode — it toggles tone only (no `showModeMenu` IPC call); context menu remains available via right-click on bar

---

## 9. Non-functional requirements

- No runtime npm dependencies added
- No new IPC channels
- `promptly_polish_tone` is the only new localStorage key
- Green palette: rgba(48,209,88,*) and rgba(100,220,130,*) — consistent throughout all polish UI touches
- All styles in new components inline — no Tailwind classes (matches IteratingState and TypingState pattern)
- `generate-prompt` IPC change is backwards-compatible — existing callers omitting `options` continue to work

---

## 10. Conformance checklist

- [ ] All acceptance criteria above ticked
- [ ] `npm run lint` passes (0 errors)
- [ ] `npm run build:renderer` succeeds
- [ ] Manual smoke: Polish selected → green UI + tone toggle → speak → polished text + change notes → copy → green flash
- [ ] Tone toggle persists after app restart
- [ ] Tone change in output reruns generation with new tone
- [ ] Other modes unaffected (blue/purple accent, normal subtitles, no tone toggle)
- [ ] Polish entries save to history with green tag
- [ ] Reuse from history loads PolishReadyState correctly
- [ ] CODEBASE.md updated
- [ ] DECISIONS.md updated

---

## Missing dependencies note

This feature was NOT in the original PLAN.md. All existing modes and React migration are complete, so there are no missing build prerequisites. The feature is an independent vertical slice. See DECISIONS.md D-POL-001 for rationale.
