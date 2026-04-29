# Spec Review — FEATURE-ONBOARDING-WIZARD — add-feature
> Date: 2026-04-29 · Trigger: vibe-add-feature

## Documents audited
- vibe/features/2026-04-28-onboarding-wizard/FEATURE_SPEC.md
- vibe/ARCHITECTURE.md (contradiction check)

## Findings before fixes

### P0 — Critical (0 found)
None.

### P1 — Warnings (8 found, all fixed)

P1-001 · "electron-store" naming confusion
- Issue: "electron-store" named 6 times as storage mechanism, but ARCHITECTURE.md forbids runtime npm deps. Agent would attempt `npm install electron-store`.
- Fix applied: All "electron-store" references replaced with "config.json (via readConfig/writeConfig)".

P1-002 · preload.js missing from files in scope
- Issue: 11 new IPC channels require contextBridge entries, but preload.js was marked "ask first / out of scope".
- Fix applied: preload.js moved to Files in scope with full list of required entries.

P1-003 · 3 setup IPC channels missing from spec
- Issue: check-setup-complete, set-setup-complete, reset-setup-complete required by wizard but absent from IPC section.
- Fix applied: All 3 added to IPC additions section with return type definitions.

P1-004 · reopen-wizard IPC unspecified
- Issue: Settings "Recheck setup" needs to recreate splashWin from renderer with no mechanism defined.
- Fix applied: reopen-wizard IPC added to spec with full 4-step implementation detail.

P1-005 · "Download manually" URL missing
- Issue: Screen 3 failure state referenced HuggingFace with no URL.
- Fix applied: URL specified as https://huggingface.co/openai/whisper-base; splash-open-url IPC channel called.

P1-006 · "Need help?" button undefined
- Issue: Secondary button on Screen 1 NOT FOUND state had no action.
- Fix applied: Opens https://docs.anthropic.com/en/docs/claude-code/ via splash-open-url.

P1-007 · Collapsed mode error behavior unspecified
- Issue: TRANSCRIPTION_ERROR + GENERATION_ERROR only described as expanded-only, with no collapsed mode fallback.
- Fix applied: Collapsed mode uses existing ERROR state with "expand to retry" message. Auth error gets specific message.

P1-008 · Timeout warning placement unclear
- Issue: "Below the spinner" — but THINKING state has MorphCanvas, not a spinner.
- Fix applied: Warning positioned below MorphCanvas, above YOU SAID block. Style specified (11px amber). Props specified (transcriptionSlow, generationSlow).

### P2 — Notes (4 found, all fixed)

P2-1 · ErrorStatePanel.jsx naming collision with ErrorState.jsx
- Fix applied: Renamed to OperationErrorPanel.jsx throughout spec + plan + tasks.

P2-2 · ExpandedTransportBar not in files in scope
- Fix applied: Added to Files in scope with scoped instruction (hint-text-row switch only).

P2-3 · Screen 4 electron-store naming (covered by P1-001 fix)
- Fixed as part of P1-001.

P2-4 · Disabled download button style unspecified
- Fix applied: opacity: 0.45, cursor: default, pointerEvents: none.

## Post-fix verdict

✅ All 12 findings resolved — 0 open issues.
Spec is ready to build.
