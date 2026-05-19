# FEATURE_TASKS — Prompt Eval Scorecard
> Feature: FEATURE-EVAL-SCORECARD
> Folder: vibe/features/2026-05-18-prompt-eval-scorecard/

> **Estimated effort:** 7 tasks — S: 6 (<2hrs ea), M: 1 (2-4hrs) — approx. 6–8 hours total

---

### EVAL-001 · main.js: evaluate-prompt IPC handler
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#7-new-ipc-channel
- **Dependencies**: None
- **Touches**: `main.js`

**What to do**:

Add a new `ipcMain.handle('evaluate-prompt', ...)` handler to `main.js`. Place it after the existing `generate-raw` handler (search for `ipcMain.handle('generate-raw'`).

The handler must:
1. Return `{ success: false }` early if `!claudePath` or `!transcript` or `!prompt`
2. Build an eval system prompt string that embeds `transcript` and `prompt` (see FEATURE_PLAN.md section 3 for the exact template)
3. `spawn(claudePath, ['-p', evalSystemPrompt])` — same pattern as `generate-raw`
4. Set a 30s timeout via `setTimeout` — on fire: `child.kill()`, `resolve({ success: false })`
5. Collect stdout, parse JSON on close (strip fences first), validate `rawScore` and `promptlyScore` are numbers
6. Return `{ success: true, data: { rawScore, promptlyScore, rawReasons, promptlyReasons } }` on success
7. Return `{ success: false }` on any error, invalid JSON, or failed validation
8. `child.on('error', ...)` handler must clear the timeout and resolve `{ success: false }`

Do NOT add `console.log` or `console.error` — silent failure is required.

**Acceptance criteria**:
- [ ] Handler registered as `'evaluate-prompt'` in main.js
- [ ] Returns `{ success: false }` when claudePath is null
- [ ] Returns `{ success: false }` when transcript or prompt is empty/falsy
- [ ] Spawns claude with eval system prompt (transcript + prompt interpolated)
- [ ] 30s timeout kills child and resolves `{ success: false }` without throwing
- [ ] JSON fence-stripping applied before parse (handles `\`\`\`json\n...\n\`\`\`` wrapper)
- [ ] Returns `{ success: true, data }` only when both rawScore and promptlyScore are numbers
- [ ] Returns `{ success: false }` on JSON parse error
- [ ] No console.log or console.error added

**Self-verify**: Re-read FEATURE_SPEC.md#7 and FEATURE_PLAN.md section 3. Check all early-return guards.
**Test requirement**: Manual — run app, trigger eval, verify IPC returns structured data (check via DevTools Network if needed). Lint must pass.
**⚠️ Boundaries**: Do NOT touch any existing IPC handler. Do NOT add `standalone: true` to MODE_CONFIG. Do NOT import new modules.
**CODEBASE.md update?**: Yes — add `evaluate-prompt` to IPC channels table after EVAL-007.
**Architecture compliance**: `spawn(claudePath, ...)` pattern (never bare `exec('claude ...')`); no runtime deps; fence-strip before JSON.parse.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EVAL-002 · preload.js: expose evaluatePrompt via contextBridge
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#5-integration-points
- **Dependencies**: EVAL-001
- **Touches**: `preload.js`

**What to do**:

Add `evaluatePrompt` to the `contextBridge.exposeInMainWorld('electronAPI', { ... })` object in `preload.js`.

```js
evaluatePrompt: (args) => ipcRenderer.invoke('evaluate-prompt', args),
```

Add it near the other generation-related methods (e.g. after `generateRaw`).

**Acceptance criteria**:
- [ ] `evaluatePrompt` added to contextBridge electronAPI object
- [ ] Uses `ipcRenderer.invoke('evaluate-prompt', args)` — matches handler channel name exactly
- [ ] No other changes to preload.js

**Self-verify**: Channel name matches `'evaluate-prompt'` in main.js exactly. One line added.
**Test requirement**: Lint pass. Runtime test in EVAL-003 smoke test.
**⚠️ Boundaries**: Do NOT change any existing preload method. One line addition only.
**CODEBASE.md update?**: Yes — add `evaluatePrompt` to preload.js row in file map after EVAL-007.
**Architecture compliance**: contextBridge pattern; `ipcRenderer.invoke` (not `send`).

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EVAL-003 · EvalPanel.jsx: new self-contained eval component
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria, FEATURE_PLAN.md#4-frontend-changes
- **Dependencies**: EVAL-002
- **Touches**: `src/renderer/components/EvalPanel.jsx` (NEW)

**What to do**:

Create `src/renderer/components/EvalPanel.jsx`. This component is fully self-contained — it fires the IPC call, manages its own state, and renders both the toggle button and the panel.

**Props**: `{ transcript, prompt }` — both strings.

**Internal state**:
- `isOpen` (bool, default false) — controls panel visibility
- `evalData` (null or object `{ rawScore, promptlyScore, rawReasons, promptlyReasons }`)
- `evalFailed` (bool, default false)

**Lifecycle**:
- `useEffect([], [])` on mount: call `window.electronAPI.evaluatePrompt({ transcript, prompt })`
  - On `.then(result)`: if `result?.success` → `setEvalData(result.data)`, else `setEvalFailed(true)`
  - On `.catch(...)`: `setEvalFailed(true)`
- If `evalFailed` → `return null` (component disappears entirely)

**Button**:
- Label: `↗ Eval`
- Style: small ghost button matching existing action row style (see `ExpandedPromptReadyContent.jsx` secondary buttons for reference)
- `WebkitAppRegion: 'no-drag'`
- onClick: `setIsOpen(v => !v)`

**Panel** (shown when `isOpen`):
- Full-width, sits below the button row
- Semi-transparent dark background, rounded corners, subtle border
- **Loading state** (when `evalData === null`): animated dot (CSS pulse keyframe) + "Evaluating..." text
- **Ready state** (when `evalData` is set): two-column layout

**Ready state layout**:
```
┌─────────────────────────────────────────────────────────┐
│ WITHOUT PROMPTLY (9px uppercase label)                   │
│ [===========···] 68    [score bar, amber]               │
│ • Reason one                                             │
│ • Reason two                                             │
│ • Reason three                                           │
│                                                         │
│ WITH PROMPTLY (9px uppercase label)                      │
│ [========================] 91    [score bar, green]      │
│ • Reason one                                             │
│ • Reason two                                             │
│ • Reason three                                           │
│                                                         │
│ Δ +23 points     ↑ Clear improvement  [verdict badge]   │
└─────────────────────────────────────────────────────────┘
```

Use a two-column CSS grid for left/right score sections.

**Score bar implementation**:
- Outer: full-width div, height 4px, `background: rgba(255,255,255,0.08)`, borderRadius 2px
- Inner: `width: ${score}%`, height 4px, `background: scoreColor(score, isPromptly)`, borderRadius 2px
- Score number shown after bar: `fontSize: 13px, fontWeight: 600`

**Score colour function** (inline in component):
```js
function scoreColor(score, isPromptly) {
  if (isPromptly) return 'rgba(48,209,88,0.85)'
  if (score >= 80) return 'rgba(48,209,88,0.85)'
  if (score >= 60) return 'rgba(48,209,88,0.55)'
  if (score >= 40) return 'rgba(255,159,10,0.85)'
  return 'rgba(255,69,58,0.85)'
}
```

**Verdict function** (inline in component; `delta = promptlyScore - rawScore`, signed):
```js
function verdict(delta) {
  if (delta >= 30) return '🚀 Big upgrade'
  if (delta >= 15) return '↑ Clear improvement'
  if (delta >= 5)  return '↗ Modest improvement'
  if (delta > -5)  return '→ Minimal difference'
  return '↓ Raw was clearer'
}
```

Display delta as: `delta >= 0 ? \`Δ +${delta} points\` : \`Δ ${delta} points\``

**Styling guidelines**:
- Panel background: `rgba(255,255,255,0.03)`, border: `0.5px solid rgba(255,255,255,0.08)`, borderRadius: 10, padding: 16
- Section labels: `fontSize: 9px, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)'`
- Reason items: `fontSize: 12px, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6`
- Footer: flexRow, `justifyContent: 'space-between'`, top border `0.5px solid rgba(255,255,255,0.06)`, marginTop 12, paddingTop 10
- Delta text: `fontSize: 13px, fontWeight: 600, color: 'rgba(255,255,255,0.7)'`
- Verdict badge: small pill, `background: rgba(255,255,255,0.06), borderRadius: 20, padding: '2px 10px', fontSize: 11`
- Panel visibility: `opacity + maxHeight` transition `150ms ease` — `maxHeight: 0` when hidden, `maxHeight: 500px` when open

**Loading dot**: single 6px circle, `background: rgba(255,255,255,0.4)`, `animation: pulse 1.2s ease-in-out infinite` using existing `pulse-ring` keyframe if available, otherwise define inline.

**Acceptance criteria**:
- [ ] Component exists at `src/renderer/components/EvalPanel.jsx`
- [ ] Fires `evaluatePrompt` IPC on mount (useEffect with empty dep array)
- [ ] Returns `null` when `evalFailed === true`
- [ ] Button shows "↗ Eval" with `WebkitAppRegion: 'no-drag'`
- [ ] Clicking button toggles `isOpen`
- [ ] Loading state shown when `isOpen && !evalData`
- [ ] Ready state shown when `isOpen && evalData`
- [ ] Score bars sized proportionally (width = score%)
- [ ] Raw score bar uses colour based on value; promptly score bar always green
- [ ] Three reasons per column rendered as text nodes (not dangerouslySetInnerHTML)
- [ ] Verdict badge shows correct string for delta
- [ ] Panel fade/reveal uses opacity or maxHeight transition only
- [ ] No new runtime npm imports

**Self-verify**: Re-read FEATURE_SPEC.md#3 acceptance criteria. Check every AC line.
**Test requirement**: Visual smoke test in running app — click Eval on a PROMPT_READY result, verify loading → ready transition, verify score bars, verify button disappears on simulated failure.
**⚠️ Boundaries**: Do NOT use `dangerouslySetInnerHTML`. Do NOT import from utils (reasons are just strings from IPC). `WebkitAppRegion: 'no-drag'` on button.
**CODEBASE.md update?**: Yes — add EvalPanel.jsx row to file map after EVAL-007.
**Architecture compliance**: One component per file; functional component; inline styles for dynamic values; JSX text nodes for all content.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EVAL-004 · ExpandedPromptReadyContent: add transcript prop + mount EvalPanel
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#5-integration-points
- **Dependencies**: EVAL-003
- **Touches**: `src/renderer/components/ExpandedPromptReadyContent.jsx`, `src/renderer/components/ExpandedDetailPanel.jsx`

**What to do**:

**In `ExpandedPromptReadyContent.jsx`:**
1. Add `transcript` to the props destructure
2. Import EvalPanel: `import EvalPanel from './EvalPanel.jsx'`
3. Compute eval prompt: `const evalPrompt = isPolishMode ? (polishResult?.polished || generatedPrompt) : generatedPrompt`
4. Mount EvalPanel below the action row divider (inside the bottom `flexShrink: 0` section, after the existing action row div):
   ```jsx
   <div style={{ padding: '0 24px 16px' }}>
     <EvalPanel transcript={transcript} prompt={evalPrompt} />
   </div>
   ```

**In `ExpandedDetailPanel.jsx`:**
- Find where `ExpandedPromptReadyContent` is rendered (look for `<ExpandedPromptReadyContent`)
- Add `transcript={thinkTranscript}` prop to the render call
- `thinkTranscript` is already a prop of ExpandedDetailPanel — no new prop needed on ExpandedDetailPanel

**Acceptance criteria**:
- [ ] `transcript` added to ExpandedPromptReadyContent prop destructure
- [ ] EvalPanel imported in ExpandedPromptReadyContent
- [ ] `evalPrompt` computed correctly (polish uses polished text, others use generatedPrompt)
- [ ] `<EvalPanel transcript={transcript} prompt={evalPrompt} />` rendered below action row
- [ ] ExpandedDetailPanel passes `transcript={thinkTranscript}` to ExpandedPromptReadyContent
- [ ] No other changes to either file

**Self-verify**: Read ExpandedDetailPanel to find the ExpandedPromptReadyContent render call. Confirm `thinkTranscript` is in ExpandedDetailPanel's props.
**Test requirement**: Lint pass. Visual smoke: Balanced mode done screen shows Eval button.
**⚠️ Boundaries**: Do NOT touch any other render path in ExpandedDetailPanel. Only add the one transcript prop.
**CODEBASE.md update?**: Yes — update ExpandedPromptReadyContent.jsx row (new prop) after EVAL-007.
**Architecture compliance**: Additive only; no breaking changes.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EVAL-005 · EmailReadyState: mount EvalPanel
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#5-integration-points
- **Dependencies**: EVAL-003
- **Touches**: `src/renderer/components/EmailReadyState.jsx`

**What to do**:

`EmailReadyState` already receives `transcript` as a prop. Add EvalPanel below the action row.

1. Import EvalPanel: `import EvalPanel from './EvalPanel.jsx'`
2. Compute email text: `const emailText = [emailOutput?.subject, emailOutput?.body].filter(Boolean).join('\n\n')`
3. Find the action row in EmailReadyState (bottom section with Edit / Save / Copy buttons)
4. Below the action row, add:
   ```jsx
   <div style={{ padding: '0 20px 16px' }}>
     <EvalPanel transcript={transcript} prompt={emailText} />
   </div>
   ```

**Acceptance criteria**:
- [ ] EvalPanel imported in EmailReadyState
- [ ] `emailText` computed as subject + "\n\n" + body (both parts filtered for truthiness)
- [ ] `<EvalPanel transcript={transcript} prompt={emailText} />` rendered below action row
- [ ] `transcript` prop already exists — no prop changes needed on EmailReadyState
- [ ] No other changes to EmailReadyState

**Self-verify**: Read the bottom section of EmailReadyState.jsx to find the action row. Add EvalPanel after it.
**Test requirement**: Lint pass. Visual smoke: Email mode done screen shows Eval button.
**⚠️ Boundaries**: Do NOT change EmailReadyState's existing props. Do NOT rearrange existing action buttons.
**CODEBASE.md update?**: Yes — update EmailReadyState.jsx row after EVAL-007.
**Architecture compliance**: Additive only.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EVAL-006 · WorkflowBuilderDoneState: add transcript prop + mount EvalPanel
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#5-integration-points
- **Dependencies**: EVAL-003
- **Touches**: `src/renderer/components/WorkflowBuilderDoneState.jsx`, `src/renderer/components/ExpandedDetailPanel.jsx`

**What to do**:

> ⚠️ ExpandedDetailPanel.jsx was already modified in EVAL-004 (added `transcript={thinkTranscript}` to the ExpandedPromptReadyContent render call). Do NOT re-write ExpandedDetailPanel from scratch. Read the file fresh from disk, then apply only the WorkflowBuilderDoneState change on top of the existing EVAL-004 change.

**In `WorkflowBuilderDoneState.jsx`:**
1. Add `transcript` to the props destructure
2. Import EvalPanel: `import EvalPanel from './EvalPanel.jsx'`
3. Mount EvalPanel below the action row (after the `actionRowStyle` div):
   ```jsx
   <div style={{ padding: '8px 0 4px' }}>
     <EvalPanel transcript={transcript} prompt={workflowJson || ''} />
   </div>
   ```

**In `ExpandedDetailPanel.jsx`:**
- Find where `WorkflowBuilderDoneState` is rendered (look for `<WorkflowBuilderDoneState`)
- Add `transcript={thinkTranscript}` prop to the render call
- This is the same ExpandedDetailPanel edit as EVAL-004 but for a different component

**Acceptance criteria**:
- [ ] `transcript` added to WorkflowBuilderDoneState prop destructure
- [ ] EvalPanel imported in WorkflowBuilderDoneState
- [ ] `<EvalPanel transcript={transcript} prompt={workflowJson || ''} />` rendered below action row
- [ ] ExpandedDetailPanel passes `transcript={thinkTranscript}` to WorkflowBuilderDoneState render call
- [ ] No other changes

**Self-verify**: Confirm `workflowJson` is a prop of WorkflowBuilderDoneState. Confirm `thinkTranscript` is in ExpandedDetailPanel props.
**Test requirement**: Lint pass. Visual smoke: Workflow done screen shows Eval button.
**⚠️ Boundaries**: Do NOT change any existing props or their types.
**CODEBASE.md update?**: Yes — update WorkflowBuilderDoneState.jsx row after EVAL-007.
**Architecture compliance**: Additive only.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EVAL-007 · Docs: CODEBASE.md + DECISIONS.md + TASKS.md + CLAUDE.md
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md (all sections)
- **Dependencies**: EVAL-006
- **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`, `CLAUDE.md`

**What to do**:

**CODEBASE.md:**
- Add `EvalPanel.jsx` row to file map: `src/renderer/components/EvalPanel.jsx | Self-contained eval widget — fires evaluatePrompt IPC on mount, owns loading/ready/failed state, renders toggle button + scorecard panel | props: transcript, prompt`
- Update `ExpandedPromptReadyContent.jsx` row: add `transcript` to props list
- Update `WorkflowBuilderDoneState.jsx` row: add `transcript` to props list
- Update `EmailReadyState.jsx` row: note EvalPanel added
- Add `evaluate-prompt` to IPC channels table: `evaluate-prompt | renderer → main | ✅ registered — spawn claudePath with dual-scoring eval prompt; 30s timeout; returns { success, data: { rawScore, promptlyScore, rawReasons, promptlyReasons } } or { success: false }`
- Update `preload.js` row: add `evaluatePrompt` to the exposed methods list

**DECISIONS.md:**
Add entry:
```
## D-EVAL-001 — Prompt Eval Scorecard — 2026-05-18
EvalPanel fires a parallel Claude CLI call on done-state mount to score raw transcript vs. Promptly output.
Self-contained component (no App.jsx state): fires IPC, owns loading/failed state, renders button+panel.
Transcript sourced from thinkTranscript (already in ExpandedDetailPanel) — no new prop chain through App.jsx.
Excluded from Image/Video modes (output is not a prompt; different output contract).
```

**TASKS.md:**
- Mark EVAL-001 through EVAL-006 as complete
- Update "What just happened" and "What's next" sections

**CLAUDE.md:**
- Append Active Feature section for FEATURE-EVAL-SCORECARD (see CLAUDE.md template in vibe-add-feature)

**Acceptance criteria**:
- [ ] EvalPanel.jsx row added to CODEBASE.md file map
- [ ] `evaluate-prompt` IPC channel added to CODEBASE.md IPC table
- [ ] preload.js row updated with `evaluatePrompt`
- [ ] DECISIONS.md D-EVAL-001 entry added
- [ ] TASKS.md updated with final status
- [ ] CLAUDE.md active feature section appended

**Self-verify**: Re-read CODEBASE.md IPC table and file map. Check all 4 updated rows.
**Test requirement**: No code test. Review docs completeness.
**⚠️ Boundaries**: Do NOT remove any existing entries. Only add/update.
**CODEBASE.md update?**: This task IS the CODEBASE.md update.
**Architecture compliance**: N/A — docs task.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: Prompt Eval Scorecard
> Tick after every task. All items ✅ before feature is shippable.
- [ ] "↗ Eval" button visible on Balanced, Detailed, Concise, Chain, Code, Design, Refine result screens
- [ ] "↗ Eval" button visible on Polish result screen (uses polished text as prompt)
- [ ] "↗ Eval" button visible on Email done screen
- [ ] "↗ Eval" button visible on Workflow done screen
- [ ] NO eval button on Image done screen
- [ ] NO eval button on Video done screen
- [ ] Loading state renders while IPC is in flight
- [ ] Ready state shows two columns with score bars + reasons + verdict
- [ ] Score bar colours correct for value ranges (raw); always green for promptly
- [ ] Verdict badge text matches delta thresholds
- [ ] Button disappears silently on eval failure (no error shown)
- [ ] Panel toggles open/close on button click
- [ ] All existing tests still pass
- [ ] Linter clean
- [ ] CODEBASE.md updated for all structural changes
- [ ] No regressions in other modes
---
