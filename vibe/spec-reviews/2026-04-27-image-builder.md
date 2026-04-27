# SPEC REVIEW — Promptly / FEATURE-IMAGE-BUILDER — on demand
> Date: 2026-04-27 | Trigger: user-initiated (spec-review: after additions 1–4)

## Documents audited
- BRIEF.md
- vibe/SPEC.md
- vibe/ARCHITECTURE.md
- vibe/features/2026-04-27-image-builder/FEATURE_SPEC.md

## Verdict
P0: 0 · P1: 9 (all fixed) · P2: 5 (logged, low risk)
Action: all P1 findings fixed inline during review session.

---

## P1 Findings (all resolved)

### P1-001 · FEATURE_SPEC.md · Custom chip text-entry UX
Issue: "Custom / describe it" (T2 Q3) and "Custom (type it)" (T3 Q5) had no
spec for how text entry worked in a chip-based UI.
Fix applied: Added inline text field spec — clicking Custom chip reveals a
text field below the chip row; Enter confirms; empty + Next = Skip. Chip
displays first 20 chars of typed text.

### P1-002 · FEATURE_SPEC.md · "Copy now →" at Q1 with empty imageAnswers
Issue: "Copy now →" is visible on Q1 before any answer is selected. Behaviour
with empty imageAnswers was undefined — could cause undefined substitution
in the system prompt template.
Fix applied: Added rule to Navigation section: if imageAnswers is empty,
model/useCase lines are omitted from the system prompt; Claude uses transcript
alone. "Copy now →" is never disabled.

### P1-003 · FEATURE_SPEC.md · Tier 2→3 transition UI unspecified
Issue: Tier transition UI only specified the tier 1→2 transition ("Essential ✓"
box). Tier 2→3 was completely absent — agent would either skip it or invent it.
Fix applied: Added tier 2→3 spec — "Important ✓" box with blue header; both
boxes stack when tier 3 begins; answered params row in tier 3 shows only tier 3
answers.

### P1-004 · FEATURE_SPEC.md · Compact→expanded mid-interview state preservation
Issue: ARCHITECTURE.md handleExpand() switches entire App.jsx render to
ExpandedView. Whether IMAGE_BUILDER sub-state survived this transition was
unspecified.
Fix applied: Added "Expand toggle during IMAGE_BUILDER" block to State machine
section — currentTier/currentQuestion/imageAnswers are App.jsx state/refs, survive
the transition, passed as props; expanding mid-interview does NOT reset question flow.

### P1-005 · FEATURE_SPEC.md · ThinkingState label AC missing
Issue: "Assembling prompt..." label change to ThinkingState was in prose but
absent from the acceptance criteria list.
Fix applied: Added AC — "ThinkingState shows 'Assembling prompt...' when
mode === 'image' (not the default 'Generating prompt...')"

### P1-006 · FEATURE_SPEC.md · History entry shape undefined
Issue: AC said "save with mode: 'image'" but full shape was undefined. The
"Parameters applied" panel needs imageAnswers from history.
Fix applied: Added History entry shape block with full field list including
all 17 imageAnswers keys.

### P1-007 · FEATURE_SPEC.md · Sub-state pattern undocumented
Issue: IMAGE_BUILDER sub-state (currentTier/currentQuestion/imageAnswers inside
a single STATES entry) is a new pattern not in ARCHITECTURE.md; DECISIONS.md
entry not required by spec.
Fix applied: Added "Sub-state pattern note" block with DECISIONS.md rationale.
Added vibe/DECISIONS.md to Files in scope (was already there; rationale text added).

### P1-008 · FEATURE_SPEC.md ↔ ARCHITECTURE.md · State list drift
Issue: ARCHITECTURE.md state count (11) would drift after adding IMAGE_BUILDER
and IMAGE_BUILDER_DONE. ARCHITECTURE.md not in Files in scope.
Fix applied: Added vibe/ARCHITECTURE.md to Files in scope. Added two ACs for
state list update and Prompt modes table update.

### P1-009 · FEATURE_SPEC.md · Non-deterministic ACs
Issue: Two ACs asserted specific words would appear in Claude's output — untestable
because Claude output is non-deterministic.
Fix applied: Rewritten as system-prompt-structure ACs — assertions are about
what instructions go INTO Claude, not what comes out.

---

## P2 Notes (logged, not fixed)

- imageAnswers key names defined in history entry shape (model, useCase, style,
  lighting, aspectRatio, subjectDetail, composition, colourPalette, background,
  mood, resolution, camera, text, detail, avoid, surface, postProcessing)
- Progress bar completedQuestions increment ambiguity — recommend: completedQuestions
  = 0-based index of current question so progress advances only after answering/skipping
- Tier 3 Q1 (Resolution) and T3 Q4 (Detail specificity) can produce contradictory
  keywords — Claude handles this; noted as known overlap
- SPEC.md mode table will drift — follow-on doc task after feature ships
- Edit answers from final screen renders at 520px cap from Q1 onward (by calculation);
  consistent with spec

---

## Cross-document consistency (post-fix)
- generate-raw IPC channel: ✅ present in ARCHITECTURE.md
- resize-window IPC channel: ✅ present in ARCHITECTURE.md
- Purple accent rgba(139,92,246): ✅ not used by existing modes
- useMode + history wrappers: ✅ followed
- ARCHITECTURE.md state list: flagged in P1-008 — update required as part of feature
- Sub-state pattern: flagged in P1-007 — DECISIONS.md entry required as part of feature
