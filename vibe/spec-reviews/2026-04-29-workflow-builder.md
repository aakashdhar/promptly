# Spec Review — FEATURE-WORKFLOW-BUILDER — add-feature
> Date: 2026-04-29 · Trigger: vibe-add-feature
> Documents audited: FEATURE_SPEC.md, FEATURE_TASKS.md, SPEC.md (contradiction check), ARCHITECTURE.md

## Result: ✅ ALL P1 FINDINGS FIXED — SPEC READY

---

## Findings (all resolved)

### P0 — None found ✅

### P1 — 8 found, 8 fixed

| ID | Location | Issue | Fix applied |
|----|----------|-------|-------------|
| P1-001 | FEATURE_TASKS.md | Flat checklist, no Touches/Dependencies/AC/Self-verify | Full structured task format written for all 11 tasks |
| P1-002 | FEATURE_SPEC.md | No error handling for phase 1 or phase 2 Claude calls | Error handling section added with specific messages and ERROR state transitions |
| P1-003 | FEATURE_SPEC.md | "Save" button behaviour undefined | Save defined: isSaved flag toggle + bookmarkHistoryItem, "Saved ✓" UI state |
| P1-004 | FEATURE_SPEC.md | Amber placeholder highlight unreachable (all placeholders filled before phase 2) | Amber removed from JSON preview spec; replaced with booleans/null colour. Note added explaining why. |
| P1-005 | FEATURE_SPEC.md | promptUtils.js getModeTagStyle not in scope | promptUtils.js added to Files in scope; getModeTagStyle workflow case added to WFL-009 |
| P1-006 | FEATURE_SPEC.md | Blank node card schema undefined | Full blank node schema defined in Error handling section |
| P1-007 | FEATURE_SPEC.md | History `prompt` field content undefined | History saving section added: `${workflowName} — ${nodes.length} nodes`, workflowJson not stored |
| P1-008 | FEATURE_SPEC.md | Reiterate behaviour for user-added nodes undefined | Reiterate section updated: user-added nodes discarded, matching keys preserved |

### P2 — 3 noted, acknowledged
- Connector description text derivation from workflowAnalysis.connections — WFL-003 notes to use connections string verbatim
- Auto-expand placement — spec now says "follow video builder pattern exactly"
- Collapse tooltip — spec now says HTML title attribute (simplest approach)

---

## Cross-document consistency ✅
- Green accent rgba(34,197,94) distinct from existing modes
- generate-raw IPC channel already registered — no new channel needed
- STATE_HEIGHTS 860 matches video builder precedent
- No contradictions with SPEC.md (workflow is additive, unplanned)
