# FEATURE_SPEC.md — FEATURE-012: Iteration Mode
> Added: 2026-04-20 | Folder: vibe/features/2026-04-20-iteration-mode/
> Status: Approved design — implement exactly as specified.
> Unplanned addition (not in PLAN.md). See DECISIONS.md FEATURE-012 entry.

---

## 1. Feature overview

After a prompt is generated (PROMPT_READY state), the user can tap "↻ Iterate" to record a new voice input that refines the previous prompt. The original prompt and new voice input are sent to Claude together via a combined system prompt, producing an improved version that preserves the original structure while incorporating the new direction. No new mode is added — iteration works across all existing modes.

---

## 2. User stories

- As a user who got a good prompt but wants to refine it, I tap ↻ Iterate, speak my refinement, and receive an improved prompt that preserves what was already good.
- As a power user, I can iterate multiple times in sequence — each iteration builds on the previous result.
- As a user who changed my mind mid-iteration, I tap ✕ dismiss to return to the unchanged original PROMPT_READY with no side effects.

---

## 3. Acceptance criteria

- [ ] ↻ Iterate button appears in blue in PROMPT_READY top row (leftmost button)
- [ ] Tapping ↻ Iterate immediately starts recording and transitions to ITERATING state
- [ ] ITERATING state shows blue context banner with the transcript being iterated on
- [ ] Blue animated waveform plays immediately in ITERATING state (NOT red)
- [ ] Timer ticks correctly from 0:00 in ITERATING state
- [ ] Blue stop button glows with iterGlow animation
- [ ] Stopping sends audio through Whisper transcription then to Claude with combined iteration prompt
- [ ] If Whisper returns empty string → silently return to PROMPT_READY with original data unchanged
- [ ] Claude returns improved prompt that preserves original structure
- [ ] Improved prompt shows in PROMPT_READY with ↻ iterated badge in status line
- [ ] "You said" section shows the NEW iteration transcript (not original)
- [ ] ↻ Iterate button remains visible after iteration — user can iterate again
- [ ] After 3 sequential iterations: each ITERATING state shows the previous iteration's transcript in the banner; the ↻ iterated badge remains visible throughout; each final prompt reflects the most recent refinement
- [ ] Dismiss from ITERATING returns to original PROMPT_READY unchanged (no transcript/prompt change)
- [ ] Iteration entries saved to history with isIteration: true
- [ ] ↻ indicator shown on iteration entries in HistoryPanel list
- [ ] Traffic lights hidden during ITERATING state (same as RECORDING/PAUSED)
- [ ] Window height: 200px base for ITERATING state

---

## 4. Scope boundaries

**In scope:**
- New ITERATING state in App.jsx
- IteratingState.jsx component (blue banner + waveform + timer + stop)
- generate-raw IPC channel for custom system prompt passthrough
- isIteration field in history entries
- ↻ indicator in HistoryPanel list items
- ↻ Iterate button + isIterated badge in PromptReadyState
- iterGlow @keyframes in index.css

**Out of scope:**
- Live real-time transcript during ITERATING (Whisper is post-processing only)
- Pause/resume during ITERATING state
- Any new mode ("iteration mode" is not a mode — it works with all existing modes)
- Undo/redo iteration stack

---

## 5. Integration points

- `src/renderer/App.jsx` — STATES, STATE_HEIGHTS, iteration recording flow, refs
- `src/renderer/components/PromptReadyState.jsx` — onIterate prop, isIterated prop, badge
- `src/renderer/components/IteratingState.jsx` — new file
- `src/renderer/components/HistoryPanel.jsx` — ↻ indicator on iteration entries
- `src/renderer/utils/history.js` — saveToHistory with isIteration + basedOn fields
- `src/renderer/index.css` — @keyframes iterGlow
- `main.js` — generate-raw IPC handler
- `preload.js` — generateRaw contextBridge method

> **⚠️ Architecture deviation — originalTranscript immutability:**
> This feature deliberately overrides the `originalTranscript` immutability invariant
> for the iteration case only. After a successful iteration, `originalTranscript.current`
> is updated to the new iteration transcript so that "You said" shows the user's most
> recent input and Regenerate re-generates from the latest transcript.
> This deviation is logged in DECISIONS.md as D-ITER-003 and approved.
> The ARCHITECTURE.md Never list ("Mutating originalTranscript after recording stops")
> applies to the primary recording flow only — not to the iteration update path.

---

## 6. New data model changes

**history.js entry shape (extended):**
```js
{
  id: Date.now(),
  title: string,         // first 5 words of transcript
  transcript: string,    // iteration transcript (new voice input)
  prompt: string,        // improved combined prompt
  mode: string,
  timestamp: ISO string,
  isIteration: true,     // NEW — only present on iteration entries
  basedOn: string,       // NEW — first 100 chars of original prompt
}
```

---

## 7. New IPC channels

| Channel | Direction | Payload | Returns |
|---------|-----------|---------|---------|
| `generate-raw` | renderer → main | `{ systemPrompt: string }` | `{ success: bool, prompt: string, error?: string }` |

**Why generate-raw:** The iteration system prompt is fully constructed in the renderer (embedding both the original prompt and the new transcript). The existing `generate-prompt` channel constructs its system prompt from MODE_CONFIG in main.js — it cannot accept an arbitrary pre-built system prompt. `generate-raw` is the minimal new surface needed.

---

## 8. Edge cases and error states

| Case | Handling |
|------|----------|
| Whisper returns empty string | Return to PROMPT_READY silently — no state change, no error |
| Whisper transcription fails | → ERROR state with transcription error message |
| Claude returns error | → ERROR state with Claude error message |
| User dismisses mid-iteration | Stop MediaRecorder, return to PROMPT_READY with original data |
| Microphone access denied when starting iteration | → ERROR state "Microphone access denied" |
| isProcessing guard | Same pattern as stopRecording — iterIsProcessingRef prevents double-fire |

---

## 9. Non-functional requirements

- Iteration latency: same as standard generate (Whisper + Claude) — no added overhead
- No memory leak: iter MediaRecorder tracks cleaned up on stop + dismiss; RAF cleaned up on unmount
- Zero new runtime dependencies
- Traffic lights hidden during ITERATING (same as RECORDING/PAUSED)

---

## 10. Conformance checklist

- [ ] ↻ Iterate button blue, leftmost in top row, all acceptance criteria met
- [ ] ITERATING state: blue banner + blue waveform + timer + blue glow stop
- [ ] Dismiss returns to unchanged PROMPT_READY
- [ ] Combined system prompt builds correctly with original prompt + new transcript
- [ ] isIteration entries saved to history with correct shape
- [ ] ↻ indicator in HistoryPanel
- [ ] generate-raw IPC added to main.js + preload.js
- [ ] iterGlow keyframe in index.css
- [ ] Traffic lights hidden in ITERATING
- [ ] lint: 0 errors
- [ ] npm run build:renderer succeeds
- [ ] Manual smoke test: all checklist items pass
