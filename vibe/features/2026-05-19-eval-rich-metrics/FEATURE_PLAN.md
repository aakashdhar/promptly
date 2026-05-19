# FEATURE_PLAN.md — Eval Rich Metrics
> Feature: FEATURE-EVAL-METRICS
> Folder: vibe/features/2026-05-19-eval-rich-metrics/
> Added: 2026-05-19

---

## 1. Impact map

**Files to modify (2 total):**
| File | Change |
|------|--------|
| `main.js` | Update `evalSystemPrompt` string inside `ipcMain.handle('evaluate-prompt', ...)` — extend JSON schema to include `dimensions`, `gap`, `intentDrift`, `intentDriftLabel` |
| `src/renderer/components/EvalPanel.jsx` | Render new fields from `evalData` — dimension breakdown, gap, intent drift badge, token efficiency badge |

**New files:** None

**Files explicitly out of scope (must not touch):**
- `src/renderer/App.jsx`
- `preload.js`
- `src/renderer/components/ExpandedDetailPanel.jsx`
- `src/renderer/components/ExpandedPromptReadyContent.jsx`
- `src/renderer/components/EmailReadyState.jsx`
- `src/renderer/components/WorkflowBuilderDoneState.jsx`
- `src/renderer/utils/promptUtils.js`
- `tests/utils.test.js`
- All other files

---

## 2. No DB migration

No localStorage changes. No new IPC channels. No schema migration required.

---

## 3. Backend changes — main.js

**Location:** `ipcMain.handle('evaluate-prompt', async (_event, { transcript, prompt }) => { ... })`

**Change:** Replace the `evalSystemPrompt` template string to add four new output fields to the JSON schema. The system prompt must:

1. Keep all existing fields (`rawScore`, `promptlyScore`, `rawReasons`, `promptlyReasons`, `critique`)
2. Add `dimensions` object with four sub-scores per version (`clarity`, `specificity`, `context`, `actionability`) — each 0–100
3. Add `gap` string — what neither version addressed (1 sentence, max 20 words)
4. Add `intentDrift` enum — `"none"` | `"minor"` | `"significant"`
5. Add `intentDriftLabel` string — Claude-written 2–4 word label (e.g. "Intent preserved", "Minor reframing", "Goal shifted")

The IPC handler validation already checks `typeof parsed.rawScore === 'number' && typeof parsed.promptlyScore === 'number'` — this is sufficient. New fields are optional from the validator's perspective (graceful degradation in UI).

**Existing validation stays the same** — only the prompt string changes.

---

## 4. Frontend changes — EvalPanel.jsx

Current render tree inside the open panel:
```
scorecard grid (2 columns: Without Promptly / With Promptly)
  score bar + number
  reason bullets
critique (italic, borderTop)
delta row (delta label + verdict badge)
```

New render tree:
```
scorecard grid (2 columns) — UNCHANGED
  score bar + number
  reason bullets
dimension breakdown (4 rows, 2 sub-bars per row) — NEW
gap coaching block — NEW
critique (italic) — UNCHANGED, borderTop removed (gap section provides visual separation)
intent drift badge + token efficiency badge (inline row) — NEW
delta row — UNCHANGED
```

**Dimension breakdown:**
- 4 labelled rows: Clarity · Specificity · Context · Actionability
- Each row: label (9px uppercase) + two mini bars side by side (INPUT A bar left, INPUT B bar right)
- Bar colour: INPUT A uses `rgba(255,255,255,0.25)`, INPUT B uses `evalScoreColor(score, true)` (always green toned)
- Score number after each bar (10px, rgba(255,255,255,0.5))
- Full section hidden if `evalData.dimensions` is absent

**Gap coaching block:**
- Small label: "WHAT'S MISSING" (9px uppercase, rgba(255,255,255,0.25))
- Gap text: 12px, rgba(255,255,255,0.5), italic-free
- Background: `rgba(255,159,10,0.05)`, border: `0.5px solid rgba(255,159,10,0.12)`, borderRadius: 6
- Hidden if `evalData.gap` is absent

**Intent drift badge:**
- Inline with token efficiency: `display:flex, justifyContent:'space-between'`
- Drift colour: green `rgba(48,209,88,0.7)` for `"none"`, amber `rgba(255,159,10,0.8)` for `"minor"`, red `rgba(255,69,58,0.8)` for `"significant"`
- Badge style: small pill, `background: rgba(colour, 0.08)`, `border: 0.5px solid rgba(colour, 0.2)`, `padding: 2px 8px`, `fontSize: 10`
- Label: `evalData.intentDriftLabel` (e.g. "Intent preserved")
- Hidden if `evalData.intentDrift` is absent

**Token efficiency badge:**
- Calculated client-side: `rawWords = transcript.split(/\s+/).filter(Boolean).length`, `promptWords = prompt.split(/\s+/).filter(Boolean).length`
- Ratio: `(promptWords / rawWords).toFixed(1)` — shown as e.g. "2.4× longer" (or "0.8× shorter" if structured is shorter)
- Point gain: `Δ +${delta}` or `Δ ${delta}` pts
- Badge style: same pill as verdict badge — `background: rgba(255,255,255,0.06)`, `fontSize: 10`
- Hidden if rawWords = 0 (avoid divide-by-zero)

---

## 5. Conventions to follow

From ARCHITECTURE.md + CODEBASE.md:
- **One component per file** — EvalPanel remains the only component in EvalPanel.jsx. No sub-components extracted to separate files.
- **No dangerouslySetInnerHTML** — all text via JSX text nodes.
- **Inline styles for dynamic/stateful values** — dimension bar widths, badge colours are stateful → inline.
- **Transitions: opacity 150ms ease only** — no transform transitions on new elements.
- **WebkitAppRegion: 'no-drag'** — already on the toggle button; no new interactive elements added.
- **No emoji** — all new text uses Unicode characters or plain text labels.
- **Graceful degradation** — all new sections gated with `evalData.fieldName && (...)`.

---

## 6. Task breakdown

### Task order: Backend → Frontend (no data layer, no separate tests needed)

| ID | Title | Size | File |
|----|-------|------|------|
| EVAL-M-001 | Update eval system prompt with new JSON fields | S | main.js |
| EVAL-M-002 | Render dimension breakdown in EvalPanel | M | EvalPanel.jsx |
| EVAL-M-003 | Render gap + intent drift + token efficiency | M | EvalPanel.jsx |

---

## 7. Rollback plan

All changes are confined to two files. To rollback:
1. Revert `evalSystemPrompt` string in `main.js` to the version from commit `aa13eb6`
2. Revert `EvalPanel.jsx` to the version from the same commit
3. `git revert` on the feature commits if needed

---

## 8. Testing strategy

- No new pure functions exported — no unit tests to add
- Manual smoke test: generate a prompt → open eval → verify all 4 new sections render
- Graceful degradation test: temporarily break JSON output to verify missing fields don't crash render
- Lint: `npm run lint` after each task

---

## 9. CODEBASE.md sections to update

After feature complete:
- Row for `EvalPanel.jsx` — update description to mention dimension breakdown, gap, intent drift, token efficiency
- Row for `evaluate-prompt` IPC channel — update return shape to include new fields
