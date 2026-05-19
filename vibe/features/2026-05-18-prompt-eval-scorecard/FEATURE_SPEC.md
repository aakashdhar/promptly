# FEATURE_SPEC — Prompt Eval Scorecard
> Feature: FEATURE-EVAL-SCORECARD
> Folder: vibe/features/2026-05-18-prompt-eval-scorecard/
> Added: 2026-05-18

---

## 1. Feature overview

Every result/done screen gains an "Eval prompt" button. On click, a panel expands showing two side-by-side scores (0–100): how well Claude would understand the raw spoken transcript vs. how well it would understand Promptly's structured output. The delta makes the value of Promptly immediately visible to the user.

The eval fires as a parallel Claude CLI call the moment the done component mounts — non-blocking. The button is hidden silently if the eval fails or times out.

---

## 2. User stories

- As a user on a result screen, I can click "↗ Eval" to see a side-by-side score comparing my raw speech vs. Promptly's output — so I understand what Promptly actually improved.
- As a user, I see a loading indicator while the eval runs and a clear two-column scorecard when it completes.
- As a user, if the eval fails silently, I don't see a broken button — the feature disappears cleanly.

---

## 3. Acceptance criteria

- [ ] "↗ Eval" button appears in the action area of all applicable done screens (see scope)
- [ ] Clicking the button toggles the EvalPanel open/closed
- [ ] EvalPanel fires `evaluate-prompt` IPC on mount (not on button click)
- [ ] Loading state shows animated dot + "Evaluating..." text
- [ ] Ready state shows two columns: "Without Promptly" (left) and "With Promptly" (right)
- [ ] Each column has a score bar (0–100) and a reasons list (3 items)
- [ ] Score bar colours: 0–39 red · 40–59 amber · 60–79 muted green · 80+ green; promptly score always green
- [ ] Footer shows Δ delta and a verdict badge (see verdict table below)
- [ ] Button hidden (component returns null) when eval fails or errors
- [ ] IPC handler has 30s timeout; returns `{ success: false }` on any error
- [ ] Eval does NOT block the done state — it fires async and never prevents display of the result
- [ ] Eval applies to: Balanced, Detailed, Concise, Chain, Code, Design, Refine, Polish, Email, Workflow
- [ ] Eval does NOT apply to: Image, Video (excluded)

**Delta formula:** `delta = promptlyScore - rawScore` (signed — negative values are possible when raw speech scored higher). Display as `Δ +N points` or `Δ -N points`.

**Verdict table:**
| Delta | Badge |
|-------|-------|
| ≥ 30  | 🚀 Big upgrade |
| ≥ 15  | ↑ Clear improvement |
| ≥ 5   | ↗ Modest improvement |
| −4 to 4 | → Minimal difference |
| < −4  | ↓ Raw was clearer |

---

## 4. Scope boundaries

**Included:**
- New `EvalPanel.jsx` component (fully self-contained: fires IPC, owns state, renders button + panel)
- New `evaluate-prompt` IPC handler in `main.js`
- New `evaluatePrompt` preload exposure in `preload.js`
- EvalPanel added to: `ExpandedPromptReadyContent.jsx`, `EmailReadyState.jsx`, `WorkflowBuilderDoneState.jsx`
- `transcript` prop added to `ExpandedPromptReadyContent` and `WorkflowBuilderDoneState` (passed from ExpandedDetailPanel which has `thinkTranscript`)

**Deferred:**
- Eval in collapsed bar (PromptReadyState/PolishReadyState) — expanded view only
- Storing eval scores in history entries
- Export/share of eval results
- Configuring eval model or prompt

---

## 5. Integration points

| File | Change |
|------|--------|
| `main.js` | Add `ipcMain.handle('evaluate-prompt', ...)` using `claudePath` spawn pattern; 30s timeout |
| `preload.js` | Add `evaluatePrompt: (args) => ipcRenderer.invoke('evaluate-prompt', args)` to contextBridge |
| `src/renderer/components/EvalPanel.jsx` | NEW — self-contained eval widget |
| `src/renderer/components/ExpandedPromptReadyContent.jsx` | Import EvalPanel; add `transcript` prop; mount EvalPanel below action row |
| `src/renderer/components/EmailReadyState.jsx` | Import EvalPanel; mount EvalPanel below action row using `transcript` + combined email text |
| `src/renderer/components/WorkflowBuilderDoneState.jsx` | Import EvalPanel; add `transcript` prop; mount EvalPanel using `transcript` + `workflowJson` |
| `src/renderer/components/ExpandedDetailPanel.jsx` | Pass `thinkTranscript` to ExpandedPromptReadyContent as `transcript`; pass to WorkflowBuilderDoneState as `transcript` |

---

## 6. New data model changes

None. No new localStorage keys. No new history fields.

---

## 7. New IPC channel

**`evaluate-prompt`** (renderer → main)
- Request: `{ transcript: string, prompt: string }`
- Response: `{ success: true, data: { rawScore: number, promptlyScore: number, rawReasons: string[3], promptlyReasons: string[3] } }` or `{ success: false }`
- Implementation: spawn `claudePath -p <evalSystemPrompt>` with 30s timeout; parse JSON from stdout (strip fences using existing fenceStrip pattern from `parseEmailOutput`)
- Eval system prompt (embedded in handler): single Claude call returns both scores + reasons as JSON object

---

## 8. Edge cases and error states

| Scenario | Behaviour |
|----------|-----------|
| Claude not found | `{ success: false }` → button hidden |
| Eval timeout (>30s) | Kill child, `{ success: false }` → button hidden |
| Invalid JSON response | `{ success: false }` → button hidden |
| User clicks button before eval completes | Panel shows loading state |
| User closes and reopens done screen | Eval re-fires (new component mount) |
| Empty transcript | `{ success: false }` (no point evaluating empty string) |
| Polish mode | `prompt` = `polishResult.polished` (not raw generatedPrompt) |
| Email mode | `prompt` = `subject + "\n\n" + body` combined text |
| Workflow mode | `prompt` = full workflow JSON string |

---

## 9. Non-functional requirements

- Eval is fully non-blocking — zero impact on done state render time
- 30s timeout matches generation-slow-warning threshold; consistent UX expectation
- Silent failure: no error messages, no console output, no broken UI
- EvalPanel is self-contained — no new state in App.jsx required

---

## 10. Conformance checklist

- [ ] "↗ Eval" button visible on all 10 applicable done screens
- [ ] Loading → ready transition works without regression
- [ ] Score bars correct colour for their value ranges
- [ ] Promptly score always uses green, regardless of value
- [ ] Verdict badge shows correct label for each delta range
- [ ] Button disappears cleanly on eval failure (no visual glitch)
- [ ] EvalPanel fires on mount, not on button click
- [ ] Panel opens/closes on button click (toggle)
- [ ] Image and Video done screens have NO eval button
- [ ] `evaluate-prompt` IPC not accessible in Image/Video paths (never called)
- [ ] Lint clean, no TypeScript, no dangerouslySetInnerHTML
- [ ] CODEBASE.md updated
