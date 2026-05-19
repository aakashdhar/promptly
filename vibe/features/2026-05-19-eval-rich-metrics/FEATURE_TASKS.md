# FEATURE_TASKS — Eval Rich Metrics
> Feature: FEATURE-EVAL-METRICS
> Folder: vibe/features/2026-05-19-eval-rich-metrics/
> **Estimated effort:** 3 tasks — S: 1 (<2hrs), M: 2 (2-4hrs each) — approx. 5-7 hours total

---

### EVAL-M-001 · Update eval system prompt with new JSON fields
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#6-new-data-model
- **Dependencies**: None
- **Touches**: `main.js` (evalSystemPrompt string inside ipcMain.handle('evaluate-prompt'))

**What to do**:
Find `ipcMain.handle('evaluate-prompt', ...)` in main.js (~line 998). Replace the `evalSystemPrompt` template string with an updated version that:

1. Keeps all existing fields: `rawScore`, `promptlyScore`, `rawReasons`, `promptlyReasons`, `critique`
2. Adds `dimensions` object — four keys: `clarity`, `specificity`, `context`, `actionability`. Each key maps to `{ "raw": 0-100, "structured": 0-100 }`.
3. Adds `gap` string — one sentence (max 20 words) naming what BOTH versions fail to address. Be specific (not "add more context" — say WHAT context).
4. Adds `intentDrift` — exactly one of: `"none"` | `"minor"` | `"significant"`. `"none"` = structured version preserves the user's goal fully. `"minor"` = small reframing or scope shift. `"significant"` = structured version meaningfully changes what was asked.
5. Adds `intentDriftLabel` — 2–4 word phrase Claude writes matching the drift level (e.g. "Intent preserved" / "Minor reframing" / "Goal shifted" / "Scope changed").

The prompt must explicitly instruct Claude:
- Dimension scores are NOT derived from rawScore/promptlyScore — they are independent per-dimension assessments
- `gap` must be concrete and actionable, not generic
- `intentDrift` must be honest — if Promptly added verbose framing that changes the ask, flag it

Updated example JSON output to include in the prompt:
```json
{
  "rawScore": 72,
  "promptlyScore": 85,
  "rawReasons": ["...", "...", "..."],
  "promptlyReasons": ["...", "...", "..."],
  "critique": "...",
  "dimensions": {
    "clarity":       { "raw": 65, "structured": 82 },
    "specificity":   { "raw": 50, "structured": 78 },
    "context":       { "raw": 70, "structured": 86 },
    "actionability": { "raw": 68, "structured": 80 }
  },
  "gap": "Neither version specifies the expected output format or length.",
  "intentDrift": "none",
  "intentDriftLabel": "Intent preserved"
}
```

**Acceptance criteria**:
- [ ] evalSystemPrompt string updated in main.js
- [ ] All 5 existing fields still present in example JSON
- [ ] `dimensions` object with 4 keys (`clarity`, `specificity`, `context`, `actionability`), each `{ raw, structured }` present in example JSON
- [ ] `gap` field present in example JSON with description rule
- [ ] `intentDrift` enum constraint documented in prompt
- [ ] `intentDriftLabel` field present in example JSON
- [ ] Existing IPC handler validation unchanged (`typeof parsed.rawScore === 'number'`)

**Self-verify**: Read the updated prompt. Confirm all 9 fields are in the example JSON. Confirm the prompt text explicitly tells Claude when to use each `intentDrift` value. Lint must pass.
**Test requirement**: Manual — trigger an eval in the running app, check DevTools console or add a temporary `console.log(parsed)` to verify all new fields arrive. Remove any temporary logging before committing.
**⚠️ Boundaries**: Only the `evalSystemPrompt` string changes. Do NOT touch the handler's `resolve` logic, timeout, or validation.
**CODEBASE.md update?**: Yes — update `evaluate-prompt` IPC channel row to reflect new return shape.
**Architecture compliance**: IPC handler pattern unchanged. No new channels. Validation logic untouched.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EVAL-M-002 · Render dimension breakdown in EvalPanel
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#acceptance-criteria, FEATURE_PLAN.md#4-frontend-changes
- **Dependencies**: EVAL-M-001 (needs new fields in evalData)
- **Touches**: `src/renderer/components/EvalPanel.jsx`

**What to do**:
Add a dimension breakdown section to EvalPanel.jsx, rendered between the scorecard grid (reasons bullets) and the critique line.

Show ONLY when `evalData.dimensions` is present (gate with `&&`).

**Layout:**
```
DIMENSIONS (9px uppercase label)
┌──────────────────────────────┐
│ Clarity        [====  ] A  [========] B  │
│ Specificity    [===   ] A  [=======]  B  │
│ Context        [======] A  [=========]B  │
│ Actionability  [====  ] A  [========] B  │
└──────────────────────────────┘
```

**Implementation details:**
- Outer container: `marginTop: 12, paddingTop: 10, borderTop: '0.5px solid rgba(255,255,255,0.06)'`
- Section label: `fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(255,255,255,0.25)', marginBottom: 8`
- Each dimension row: `display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5` (last row: 0)
- Dimension label: `fontSize: 10, color: 'rgba(255,255,255,0.35)', width: 90, flexShrink: 0`
- Bar group (INPUT A): `display: 'flex', alignItems: 'center', gap: 4, flex: 1`
  - Track: `flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2`
  - Fill: `width: '${Math.min(100, Math.max(0, dim.raw))}%', height: 3, background: 'rgba(255,255,255,0.22)', borderRadius: 2`
  - Score: `fontSize: 9, color: 'rgba(255,255,255,0.35)', minWidth: 18, textAlign: 'right'`
- Bar group (INPUT B): same structure, fill colour uses `evalScoreColor(dim.structured, true)`
- Order of dimension rows: `['clarity', 'specificity', 'context', 'actionability']`
- Labels: `{ clarity: 'Clarity', specificity: 'Specificity', context: 'Context', actionability: 'Actionability' }`

Do NOT re-import `evalScoreColor` — it is already imported at the top of EvalPanel.jsx.

**Acceptance criteria**:
- [ ] Dimension section renders when `evalData.dimensions` is present
- [ ] Section hidden (no crash) when `evalData.dimensions` is absent
- [ ] 4 rows rendered in order: Clarity, Specificity, Context, Actionability
- [ ] Each row shows INPUT A bar (grey-white fill) and INPUT B bar (green-toned via evalScoreColor)
- [ ] Bar widths clamped to [0, 100]
- [ ] Score numbers shown after each bar
- [ ] Section separated from scorecard grid with borderTop divider

**Self-verify**: Re-read FEATURE_SPEC.md#acceptance-criteria. Check all dimension-related criteria ticked. Confirm `evalScoreColor` is not re-imported (already imported).
**Test requirement**: Manual smoke test — trigger eval, expand panel, confirm dimension rows render. Verify bar widths are proportional to scores.
**⚠️ Boundaries**: Do NOT extract sub-components to separate files. All new JSX stays inside EvalPanel.jsx. Do NOT change any existing render logic.
**CODEBASE.md update?**: Yes — update EvalPanel.jsx row description to mention dimension breakdown.
**Architecture compliance**: Inline styles for dynamic values (bar widths, colours). JSX text nodes only. No dangerouslySetInnerHTML. One component per file maintained.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EVAL-M-003 · Render gap + intent drift badge + token efficiency badge
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#acceptance-criteria, FEATURE_PLAN.md#4-frontend-changes
- **Dependencies**: EVAL-M-002
- **Touches**: `src/renderer/components/EvalPanel.jsx`

**What to do**:
Add three more sections to EvalPanel.jsx, placed between the dimension breakdown and the existing `delta row` (the row with deltaLabel and verdict badge):

**1. Gap coaching block** (show only if `evalData.gap` is present):
```jsx
<div style={{
  marginTop: 10,
  padding: '8px 10px',
  background: 'rgba(255,159,10,0.05)',
  border: '0.5px solid rgba(255,159,10,0.12)',
  borderRadius: 6,
}}>
  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(255,159,10,0.45)', marginBottom: 4 }}>
    What's missing
  </div>
  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>
    {evalData.gap}
  </div>
</div>
```

**2. Critique** (already exists — keep as-is, just ensure it still renders after gap block):
No change to critique render. It stays with its existing `borderTop` styling.

**3. Intent drift badge + token efficiency badge row** (show between critique and delta row):

Compute token efficiency client-side:
```js
const rawWords = (transcript || '').split(/\s+/).filter(Boolean).length
const promptWords = (prompt || '').split(/\s+/).filter(Boolean).length
const showEfficiency = rawWords > 0
const ratio = rawWords > 0 ? (promptWords / rawWords).toFixed(1) : null
const efficiencyLabel = ratio ? (parseFloat(ratio) >= 1 ? `${ratio}× longer` : `${ratio}× shorter`) : null
```

Drift colour helper (inline — no separate function):
```js
const driftColor = evalData.intentDrift === 'significant'
  ? 'rgba(255,69,58,0.8)'
  : evalData.intentDrift === 'minor'
    ? 'rgba(255,159,10,0.8)'
    : 'rgba(48,209,88,0.7)'
```

Row layout:
```jsx
{(evalData.intentDrift || showEfficiency) && (
  <div style={{
    display: 'flex', gap: 6, marginTop: 10,
    flexWrap: 'wrap', alignItems: 'center',
  }}>
    {evalData.intentDrift && (
      <span style={{
        background: `rgba(${driftColorRGB}, 0.08)`,
        border: `0.5px solid rgba(${driftColorRGB}, 0.2)`,
        borderRadius: 20, padding: '2px 8px',
        fontSize: 10, color: driftColor,
      }}>
        {evalData.intentDriftLabel || 'Intent evaluated'}
      </span>
    )}
    {showEfficiency && (
      <span style={{
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 20, padding: '2px 8px',
        fontSize: 10, color: 'rgba(255,255,255,0.45)',
      }}>
        {efficiencyLabel} · Δ {delta >= 0 ? `+${delta}` : delta} pts
      </span>
    )}
  </div>
)}
```

Note on `driftColorRGB`: Since inline styles can't interpolate the RGB string directly into rgba(), use a conditional for the background/border style:

```js
const driftBg = evalData.intentDrift === 'significant'
  ? 'rgba(255,69,58,0.08)'
  : evalData.intentDrift === 'minor'
    ? 'rgba(255,159,10,0.08)'
    : 'rgba(48,209,88,0.08)'

const driftBorder = evalData.intentDrift === 'significant'
  ? '0.5px solid rgba(255,69,58,0.2)'
  : evalData.intentDrift === 'minor'
    ? '0.5px solid rgba(255,159,10,0.2)'
    : '0.5px solid rgba(48,209,88,0.2)'
```

**Acceptance criteria**:
- [ ] Gap block renders with amber-tinted container when `evalData.gap` is present
- [ ] Gap block hidden when `evalData.gap` is absent
- [ ] Intent drift badge renders in correct colour: green / amber / red per drift level
- [ ] `intentDriftLabel` text shown in badge
- [ ] Intent drift badge hidden when `evalData.intentDrift` is absent
- [ ] Token efficiency badge shows ratio label and delta pts
- [ ] Token efficiency badge hidden when rawWords = 0
- [ ] Both badges rendered in same horizontal row
- [ ] `transcript` and `prompt` props used for word count (already available in EvalPanel scope)
- [ ] Existing critique and delta row still render correctly, unchanged

**Self-verify**: Re-read FEATURE_SPEC.md acceptance criteria. Confirm all items for gap, drift, efficiency ticked. Check no emoji in new text. Check all new sections degrade when fields absent.
**Test requirement**: Manual — trigger eval, expand panel, verify gap block (amber border), drift badge (green/amber/red), efficiency badge. Test with a very short transcript vs long structured prompt to verify ratio.
**⚠️ Boundaries**: Do NOT move critique or delta row. Do NOT extract helpers to separate files. Do NOT change the `transcript` or `prompt` props — they are already in EvalPanel's scope.
**CODEBASE.md update?**: Yes — EvalPanel.jsx row — add gap, intent drift, token efficiency to description.
**Architecture compliance**: All new values computed inline or as simple consts inside the render function. No new hooks. No new imports. Inline styles for all colour/dynamic values.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: FEATURE-EVAL-METRICS
> Tick after every task. All items ✅ before feature is shippable.
- [ ] Dimension breakdown renders for all 4 dimensions with mini bars
- [ ] Gap coaching block renders with amber styling
- [ ] Intent drift badge renders in correct colour (green/amber/red)
- [ ] Token efficiency badge shows ratio + delta pts
- [ ] All new sections degrade gracefully when Claude fields absent
- [ ] System prompt produces consistent valid JSON with all 9 fields
- [ ] No emoji in any new UI text
- [ ] No new files created
- [ ] No App.jsx, preload.js, or non-scoped files touched
- [ ] All new UI fits within 500px maxHeight constraint
- [ ] Linter clean (`npm run lint`)
- [ ] No regressions to existing eval scorecard (rawScore, promptlyScore, reasons, critique, verdict)
- [ ] CODEBASE.md updated for EvalPanel.jsx and evaluate-prompt IPC rows
