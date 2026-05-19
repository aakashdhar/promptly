# FEATURE_SPEC.md — Eval Rich Metrics
> Feature: FEATURE-EVAL-METRICS
> Folder: vibe/features/2026-05-19-eval-rich-metrics/
> Added: 2026-05-19
> Parent feature: FEATURE-EVAL-SCORECARD (2026-05-18)

---

## 1. Feature overview

Extends the existing EvalPanel scorecard with four additional metrics that make the comparison genuinely useful: dimension breakdown (4 sub-scores per version), a gap coaching line (what neither version addressed), an intent drift flag (did Promptly change what the user actually wanted?), and a token efficiency badge (length cost vs score gain). All four metrics are returned by Claude in the existing `evaluate-prompt` IPC call — no new IPC channels. Only `main.js` (eval system prompt) and `EvalPanel.jsx` (render) change.

---

## 2. User stories

- As a user viewing an eval, I want to see WHICH dimensions Promptly improved (clarity, specificity, context, actionability) so I understand WHERE the value came from.
- As a user, I want an honest signal when Promptly drifted from my intent, not just a high score.
- As a user, I want to know what BOTH versions missed so I can improve the prompt myself.
- As a user, I want to know if Promptly made the prompt significantly longer for minimal score gain — an efficiency signal.

---

## 3. Acceptance criteria

- [ ] EvalPanel shows 4 dimension sub-scores (clarity, specificity, context, actionability) for both INPUT A and INPUT B as mini progress bars with labels
- [ ] EvalPanel shows a "gap" line — what neither version addressed — in a distinct coaching style (not italic, visually separated)
- [ ] EvalPanel shows an intent drift badge: green (preserved), amber (minor drift), red (significant drift) — with a short label
- [ ] EvalPanel shows a token efficiency badge: word count ratio (e.g. "2.4× longer") and point gain (e.g. "+12 pts") side by side
- [ ] All four metrics sourced from Claude JSON response — no hardcoded values, no client-side calculation for dimensions
- [ ] Word count for token efficiency is calculated client-side (simple `.split(' ').length`) — no dependency on Claude for this
- [ ] If Claude omits any new field (graceful degradation) — that section simply does not render; rest of panel still shows
- [ ] Eval system prompt updated to request all new fields with clear JSON schema
- [ ] Existing fields (rawScore, promptlyScore, rawReasons, promptlyReasons, critique) still present and rendered
- [ ] EvalPanel layout does not overflow the 500px maxHeight constraint
- [ ] All buttons/interactive elements keep `WebkitAppRegion: 'no-drag'`
- [ ] No emoji in any new UI text (font characters only — Unicode arrows, symbols)
- [ ] Tests updated: `evalScoreColor` and `evalVerdict` tests unaffected; no new testable pure functions introduced by this feature
- [ ] Lint clean (`npm run lint`)

---

## 4. Scope boundaries

**In scope:**
- `main.js` — update `evalSystemPrompt` string (the template inside `ipcMain.handle('evaluate-prompt', ...)`)
- `src/renderer/components/EvalPanel.jsx` — render new fields from `evalData`

**Explicitly deferred:**
- Persisting eval results to localStorage (history entries don't cache evals across sessions)
- Showing dimension breakdown in history entry view vs live view differently
- Animated dimension bars (static bars only — per ARCHITECTURE.md `transition: opacity 150ms ease` rule)
- Export/share eval results
- Dimension trend over multiple evals of the same prompt

**Out of scope (must not touch):**
- App.jsx, ExpandedDetailPanel, ExpandedPromptReadyContent, EmailReadyState, WorkflowBuilderDoneState — no prop changes needed
- preload.js — IPC channel name unchanged, no new methods
- promptUtils.js — evalScoreColor/evalVerdict unchanged
- tests/utils.test.js — no new pure functions to test
- Any other file not listed above

---

## 5. Integration points

- `ipcMain.handle('evaluate-prompt', ...)` in `main.js` (line ~998) — system prompt string updated, JSON schema extended
- `EvalPanel.jsx` (`src/renderer/components/EvalPanel.jsx`) — renders `evalData` fields; new fields added to render
- IPC return shape extended: `{ success: true, data: { rawScore, promptlyScore, rawReasons, promptlyReasons, critique, dimensions, gap, intentDrift, intentDriftLabel } }`
- `evalCache` in `ExpandedDetailPanel` — unaffected (still caches full `evalData` object, new fields included automatically)

---

## 6. New data model — Claude JSON response shape

Current shape:
```json
{
  "rawScore": 72,
  "promptlyScore": 85,
  "rawReasons": ["...", "...", "..."],
  "promptlyReasons": ["...", "...", "..."],
  "critique": "..."
}
```

New shape (additions in bold):
```json
{
  "rawScore": 72,
  "promptlyScore": 85,
  "rawReasons": ["...", "...", "..."],
  "promptlyReasons": ["...", "...", "..."],
  "critique": "...",
  "dimensions": {
    "clarity":      { "raw": 65, "structured": 80 },
    "specificity":  { "raw": 50, "structured": 75 },
    "context":      { "raw": 70, "structured": 88 },
    "actionability":{ "raw": 60, "structured": 82 }
  },
  "gap": "Neither version specifies the expected output format or length.",
  "intentDrift": "none",
  "intentDriftLabel": "Intent preserved"
}
```

**`intentDrift` values:** `"none"` | `"minor"` | `"significant"`
**`intentDriftLabel`:** short phrase Claude writes, 2-4 words (e.g. "Intent preserved", "Minor reframing", "Intent changed")

---

## 7. No new API endpoints

This feature uses the existing `evaluate-prompt` IPC channel with an extended JSON schema. No new channels.

---

## 8. Edge cases and error states

| Case | Behaviour |
|------|-----------|
| Claude omits `dimensions` | DimensionBreakdown section does not render |
| Claude omits `gap` | Gap section does not render |
| Claude omits `intentDrift` | Intent drift badge does not render |
| `intentDrift` value not in known set | Treat as `"none"` (green) |
| Score in dimensions outside 0-100 | Clamp to [0, 100] client-side before rendering bar width |
| Token efficiency: word count = 0 | Hide badge (avoid divide-by-zero) |
| Claude returns old schema (no new fields) | Graceful degradation — existing fields render, new sections hidden |
| Panel height overflow at 500px | Inner content scrolls via `overflowY: auto` on the inner container |

---

## 9. Non-functional requirements

- **Performance:** No additional IPC calls — all data in single existing Claude response. Panel renders synchronously from `evalData`.
- **Layout:** All new sections fit within the existing `maxHeight: 500px` collapsible container. If content is tall, inner div should scroll rather than overflow.
- **Accessibility:** No interactive elements added beyond existing button. Dimension labels are text nodes, not icons.
- **No emoji:** All indicators use Unicode characters or text labels only (consistent with app convention).

---

## 10. Conformance checklist

- [ ] `evalData.dimensions` renders 4 labelled mini-bar rows per version, or is hidden if absent
- [ ] `evalData.gap` renders as a distinct coaching block, or is hidden if absent
- [ ] `evalData.intentDrift` renders as a coloured badge with `intentDriftLabel`, or is hidden if absent
- [ ] Token efficiency badge shows word count ratio + point delta, calculated client-side
- [ ] All new UI sections degrade gracefully when fields are missing
- [ ] System prompt produces consistent valid JSON with new fields
- [ ] Lint clean
- [ ] No regressions to existing eval scorecard fields
- [ ] No new files created
- [ ] No App.jsx, preload.js, or non-scoped file touched
