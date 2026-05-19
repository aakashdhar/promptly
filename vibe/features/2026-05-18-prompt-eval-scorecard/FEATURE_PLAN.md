# FEATURE_PLAN — Prompt Eval Scorecard
> Feature: FEATURE-EVAL-SCORECARD
> Folder: vibe/features/2026-05-18-prompt-eval-scorecard/

---

## 1. Impact map

**New files:**
- `src/renderer/components/EvalPanel.jsx`

**Modified files:**
- `main.js` — add `evaluate-prompt` IPC handler
- `preload.js` — expose `evaluatePrompt` via contextBridge
- `src/renderer/components/ExpandedPromptReadyContent.jsx` — add `transcript` prop + mount EvalPanel
- `src/renderer/components/EmailReadyState.jsx` — mount EvalPanel
- `src/renderer/components/WorkflowBuilderDoneState.jsx` — add `transcript` prop + mount EvalPanel
- `src/renderer/components/ExpandedDetailPanel.jsx` — pass `thinkTranscript` as `transcript` to affected components
- `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`, `CLAUDE.md`

---

## 2. Files explicitly out of scope

- `src/renderer/App.jsx` — no new state, no new transitions required
- `src/renderer/components/PromptReadyState.jsx` — collapsed bar only; excluded
- `src/renderer/components/PolishReadyState.jsx` — collapsed bar only; excluded
- `src/renderer/components/ImageBuilderDoneState.jsx` — image excluded by spec
- `src/renderer/components/VideoBuilderDoneState.jsx` — video excluded by spec
- `src/renderer/hooks/*.js` — no hook changes required
- `src/renderer/utils/*.js` — fence-strip utility already in promptUtils.js; no new utils needed
- All other components

---

## 3. Backend changes

**main.js — `evaluate-prompt` IPC handler:**

```js
ipcMain.handle('evaluate-prompt', async (event, { transcript, prompt }) => {
  if (!claudePath) return { success: false }
  if (!transcript || !prompt) return { success: false }

  const evalSystemPrompt = `You are a prompt quality scorer. You will evaluate two text inputs.

RAW: A raw spoken transcription (unpolished, as-spoken by the user).
STRUCTURED: A version refined by the Promptly AI assistant.

Score each from 0 to 100 on how clearly an AI assistant would understand the user's intent and produce a high-quality, accurate response. Consider: clarity of intent, specificity, completeness of context, actionability.

RAW:
"${transcript}"

STRUCTURED:
"${prompt}"

Respond ONLY with a JSON object, no markdown fences, no explanation:
{"rawScore":75,"promptlyScore":92,"rawReasons":["Reason one","Reason two","Reason three"],"promptlyReasons":["Reason one","Reason two","Reason three"]}

Each reason must be 5–9 words. rawReasons explain why the RAW score is what it is. promptlyReasons explain why the STRUCTURED score is what it is.`

  return new Promise((resolve) => {
    let stdout = ''
    let timedOut = false
    const child = spawn(claudePath, ['-p', evalSystemPrompt])

    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
      resolve({ success: false })
    }, 30000)

    child.stdout.on('data', (data) => { stdout += data.toString() })
    child.on('close', () => {
      if (timedOut) return
      clearTimeout(timer)
      try {
        // strip markdown fences (same pattern as parseEmailOutput)
        const raw = stdout.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '')
        const parsed = JSON.parse(raw)
        if (typeof parsed.rawScore === 'number' && typeof parsed.promptlyScore === 'number') {
          resolve({ success: true, data: parsed })
        } else {
          resolve({ success: false })
        }
      } catch {
        resolve({ success: false })
      }
    })
    child.on('error', () => {
      clearTimeout(timer)
      resolve({ success: false })
    })
  })
})
```

---

## 4. Frontend changes

### EvalPanel.jsx (NEW — ~130 lines)

Self-contained widget. Structure:

```
EvalPanel
├── useEffect on mount: fires evaluatePrompt IPC
├── evalData state: null (loading) | { rawScore, promptlyScore, rawReasons, promptlyReasons }
├── evalFailed state: bool
├── isOpen state: bool
│
├── if evalFailed → return null
│
├── Render:
│   ├── "↗ Eval" button (toggles isOpen)
│   └── isOpen panel:
│       ├── Loading: animated dot + "Evaluating..."
│       └── Ready: two columns + footer
│           ├── Left column: "Without Promptly" label + score bar + 3 reasons
│           ├── Right column: "With Promptly" label + score bar + 3 reasons
│           └── Footer: "Δ +N points" + verdict badge
```

Score bar colour logic:
```js
function scoreColor(score, isPromptly) {
  if (isPromptly) return 'rgba(48,209,88,0.85)'  // always green
  if (score >= 80) return 'rgba(48,209,88,0.85)'
  if (score >= 60) return 'rgba(48,209,88,0.55)'  // muted green
  if (score >= 40) return 'rgba(255,159,10,0.85)' // amber
  return 'rgba(255,69,58,0.85)'                   // red
}
```

Verdict logic (`delta = promptlyScore - rawScore`, signed):
```js
function verdict(delta) {
  if (delta >= 30) return '🚀 Big upgrade'
  if (delta >= 15) return '↑ Clear improvement'
  if (delta >= 5)  return '↗ Modest improvement'
  if (delta > -5)  return '→ Minimal difference'
  return '↓ Raw was clearer'
}
```

The panel slides down below the action row using `maxHeight` transition for functional layout animation.

### ExpandedPromptReadyContent.jsx

- Add `transcript` prop
- Import EvalPanel
- Compute `evalPrompt = isPolishMode ? (polishResult?.polished || generatedPrompt) : generatedPrompt`
- Mount `<EvalPanel transcript={transcript} prompt={evalPrompt} />` below the action row divider

### EmailReadyState.jsx

- Import EvalPanel
- `transcript` already available as a prop
- Compute `emailText = [emailOutput?.subject, emailOutput?.body].filter(Boolean).join('\n\n')`
- Mount `<EvalPanel transcript={transcript} prompt={emailText} />` below the action row

### WorkflowBuilderDoneState.jsx

- Add `transcript` prop
- Import EvalPanel
- Mount `<EvalPanel transcript={transcript} prompt={workflowJson || ''} />` below the action row

### ExpandedDetailPanel.jsx

Two wiring changes only (no structural changes):
1. Pass `thinkTranscript` as `transcript` when rendering `ExpandedPromptReadyContent`
2. Pass `thinkTranscript` as `transcript` when rendering `WorkflowBuilderDoneState` (via `workflowBuilderProps`)

---

## 5. Conventions to follow

From ARCHITECTURE.md:
- One component per file — `EvalPanel.jsx` is one file
- No `dangerouslySetInnerHTML` — all scores/reasons use JSX text nodes
- IPC via `window.electronAPI` only — never `ipcRenderer` directly
- CSS `transition: opacity 150ms ease` — no bounces
- `@keyframes` may use transform for functional animations (loading dot pulse)
- Inline styles for dynamic/stateful values; Tailwind only for static classes

From CODEBASE.md:
- `spawn(claudePath, ['-p', systemPrompt])` pattern for all Claude calls
- Fence-strip before `JSON.parse` (same as `parseEmailOutput` in promptUtils.js)
- `WebkitAppRegion: 'no-drag'` on ALL clickable elements

---

## 6. Task breakdown

| Order | Task ID | Description | Size | Files |
|-------|---------|-------------|------|-------|
| 1 | EVAL-001 | main.js: evaluate-prompt IPC handler | S | main.js |
| 2 | EVAL-002 | preload.js: expose evaluatePrompt | S | preload.js |
| 3 | EVAL-003 | EvalPanel.jsx: new self-contained component | M | EvalPanel.jsx (new) |
| 4 | EVAL-004 | ExpandedPromptReadyContent: transcript prop + EvalPanel | S | ExpandedPromptReadyContent.jsx, ExpandedDetailPanel.jsx |
| 5 | EVAL-005 | EmailReadyState: EvalPanel | S | EmailReadyState.jsx |
| 6 | EVAL-006 | WorkflowBuilderDoneState: transcript prop + EvalPanel | S | WorkflowBuilderDoneState.jsx, ExpandedDetailPanel.jsx |
| 7 | EVAL-007 | Docs: CODEBASE.md + DECISIONS.md + TASKS.md + CLAUDE.md | S | doc files |

---

## 7. Rollback plan

All changes are additive:
- Remove `evaluate-prompt` from main.js and preload.js
- Remove `<EvalPanel />` from the three done components
- Delete `EvalPanel.jsx`
- Remove `transcript` prop from ExpandedPromptReadyContent and WorkflowBuilderDoneState

No state machine changes, no new DB entries, no localStorage keys — fully reversible.

---

## 8. Testing strategy

Manual smoke test for each done screen:
1. Complete a recording in Balanced mode (expanded) → verify "↗ Eval" button appears
2. Click button before eval completes → verify loading state shows
3. Wait for eval to complete → verify two-column scorecard with bars + reasons + verdict
4. Test with each applicable mode: Detailed, Concise, Chain, Code, Design, Refine
5. Test Polish mode → verify it uses polished text (not raw generatedPrompt) as prompt
6. Test Email mode → verify it uses subject+body as prompt
7. Test Workflow mode → verify it uses JSON as prompt
8. Confirm Image/Video done screens have no Eval button
9. Simulate failure (disconnect) → verify button disappears

Existing tests: No changes to tested utilities — `tests/utils.test.js` unaffected.

---

## 9. CODEBASE.md sections to update

- File map: add EvalPanel.jsx row
- File map: update ExpandedPromptReadyContent.jsx (new prop)
- File map: update WorkflowBuilderDoneState.jsx (new prop)
- File map: update EmailReadyState.jsx (EvalPanel added)
- IPC channels table: add `evaluate-prompt` row
