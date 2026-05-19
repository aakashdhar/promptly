# Final Review Pass 2 — Promptly (Complete Project)
> Date: 2026-05-19 | Scope: Full codebase re-gate after P1+P2 fix pass
> Previous gate: final-review-2026-05-19.md — Score 7.4/10 (Grade B) — 0 P0, 2 P1, 2 P2, 7 P3
> This pass: verifying all P1 and P2 findings from pass 1 are resolved

---

## Step 0 — Automated checks

### ESLint (`npm run lint`)
```
> promptly@2.4.1 lint
> eslint main.js preload.js
(no output — 0 errors, 0 warnings)
```
✅ Lint clean.

### Vitest (`npm test`)
```
> promptly@2.4.1 test
> vitest run

 RUN  v4.1.5 /Users/aakash-anon/Documents/GitHub-personal/promptly

 Test Files  1 passed (1)
      Tests  45 passed (45)
   Duration  206ms
```
✅ All 45 tests pass. No regressions from fix pass.

### npm audit
```
found 0 vulnerabilities
```
✅ 0 vulnerabilities — BL-FINAL2-001 (`ip-address` + `brace-expansion`) resolved by `npm audit fix` run 2026-05-19.

### scripts/preflight.sh
```
FAIL: node not found in non-login shell PATH.
Electron child processes will fail with env: node: No such file or directory.
```
Expected behavior — Homebrew node at `/opt/homebrew/bin` is not in non-login shell PATH on this dev machine.
The script is correctly detecting a real environment constraint. Not a script bug.

### scripts/assert-splash.js
```
✓ ASSERT 1: s1-notfound has manual path input (#s1-manual-path)
✓ ASSERT 2: s1-notresponding has manual path input (#s1-notresponding-path)
✓ ASSERT 3: submit buttons present for both path inputs
✓ ASSERT 4: Check again buttons present on all dependency error screens

All 4 splash assertions passed.
```
✅ All 4 splash structural assertions pass.

---

## Carryover check — Pass 1 P1/P2 findings

| ID | Finding | Status |
|----|---------|--------|
| BL-FINAL2-001 | npm audit 2 moderate vulns | ✅ RESOLVED — `npm audit fix` run; `npm audit` now returns 0 vulnerabilities |
| BL-EMAIL-003 / BL-FINAL2 | App.jsx 719 lines (orchestrator) | ✅ RESOLVED — D-APP-ORCHESTRATOR added to DECISIONS.md 2026-05-19; accepted as irreducible orchestrator |
| BL-FINAL2-002 | ARCHITECTURE.md IPC table 16 channels missing | ✅ RESOLVED — all 16 channels added to ARCHITECTURE.md IPC surface table 2026-05-19 |
| BL-FINAL2-003 | EMAIL_READY + email mode absent from ARCHITECTURE.md | ✅ RESOLVED — state count 17→18, email transition in diagram, email row in prompt modes table |

All 4 P1/P2 findings from pass 1 are resolved.

---

## Architecture drift check — post-fix verification

| Decision | Evidence | Status |
|----------|----------|--------|
| State count "18 total" | `vibe/ARCHITECTURE.md:81` — "States (18 total — ... EMAIL_READY added via features)" | ✅ |
| EMAIL_READY in state diagram | `vibe/ARCHITECTURE.md:93` — "RECORDING (email mode) → THINKING → EMAIL_READY" | ✅ |
| Email row in prompt modes table | `vibe/ARCHITECTURE.md:348` — email row with teal accent, always-expanded description | ✅ |
| IPC table completeness | `vibe/ARCHITECTURE.md:189–196` — evaluate-prompt, retry-transcription, check-claude, and all onboarding channels present | ✅ |
| D-APP-ORCHESTRATOR in DECISIONS.md | `vibe/DECISIONS.md:1815` — entry logged | ✅ |

No architecture drift remaining.

---

## Security review — final gate

| Check | Status |
|-------|--------|
| npm audit: high/critical | ✅ 0 |
| npm audit: moderate | ✅ 0 (was 2 in pass 1 — resolved) |
| Hardcoded tokens/API keys | ✅ None |
| `dangerouslySetInnerHTML` with user/Claude content | ✅ Zero occurrences |
| `nodeIntegration: false` on all BrowserWindows | ✅ Both windows confirmed |
| CSP — `src/renderer/index.html` | ✅ Full policy present |
| CSP — `splash.html` | ✅ Present at splash.html:5 |
| `console.log` in production code | ✅ Zero |
| `shell.openExternal` URL validation | ✅ `url.startsWith('https://')` guard |

Security: clean.

---

## Component size audit

| File | Lines | Status |
|------|-------|--------|
| `App.jsx` | 719 | ✅ ACCEPTED — irreducible orchestrator; D-APP-ORCHESTRATOR in DECISIONS.md |
| `ExpandedDetailPanel.jsx` | 490 | ✅ Monitor (10 under P1 threshold) |
| `EvalPanel.jsx` | 272 | ✅ |
| `EmailReadyState.jsx` | 443 | ✅ |
| `WorkflowBuilderState.jsx` | 470 | ✅ |
| `main.js` | 1675 | ✅ Accepted (Electron main — architectural necessity) |

---

## Open P3 carryovers (unchanged from pass 1 — no P3 fixes required)

| ID | File | Finding | Status |
|----|------|---------|--------|
| BL-FINAL2-004 | `vibe/CODEBASE.md` | OperationErrorPanel "105 lines" → actual 128 lines | Open |
| P3-EXP-002 | `src/renderer/components/ExpandedDetailPanel.jsx` | 490 lines — 10 under P1 threshold | Open |
| P3-WFL-DEL-001 | `src/renderer/components/WorkflowBuilderState.jsx` | × delete btn no hover state | Open |
| P3-IIFE-001 | `src/renderer/components/EvalPanel.jsx` | IIFE JSX pattern for drift badge scoped consts | Open |
| P3-IMG2-002 | `src/renderer/hooks/useImageBuilder.js` | generateVariations silent failure, no retry affordance | Open |
| BL-EMAIL-011 | `src/renderer/App.jsx` | useState ordering cosmetic | Open |
| P3-EXP-003 | `src/renderer/components/ExpandedDetailPanel.jsx` | 27+ props — boundary layer, all consumed | Open |

---

## Score calculation

```
Start:                                        10.0
P0 findings (× 1.0):                          0.0   (0 P0)
P1 findings (× 0.5):                          0.0   (0 P1 — all pass-1 P1s resolved)
P2 findings (× 0.2):                          0.0   (0 P2 — all pass-1 P2s resolved)
P3 findings (× 0.1):                         -0.7   (7 P3 carryovers — unchanged from pass 1)
Architecture drift violations (× 0.5):        0.0   (0 — IPC table + email state both resolved)
─────────────────────────────────────────
Score:                                         9.3 / 10 — Grade A
```

Δ from pass 1: +1.9 (P1-001 acceptance resolved −0.5; P1-002 npm fix −0.5; P2-001+P2-002 fixed −0.4; arch drift resolved −0.5 = +1.9 total)

---

## Gate decision

```
✅ PASS — Final gate cleared.

P0: 0  |  P1: 0  |  P2: 0  |  P3: 7 (all open carryovers, logged to backlog)

Score: 9.3/10 — Grade A

The codebase may be tagged and distributed.
```

---

## Summary

| Severity | Count | Items |
|----------|-------|-------|
| P0 | 0 | — |
| P1 | 0 | All resolved (npm audit fix + D-APP-ORCHESTRATOR acceptance) |
| P2 | 0 | All resolved (ARCHITECTURE.md IPC table + email state/mode) |
| P3 | 7 | Monitor-only carryovers — logged to backlog |
