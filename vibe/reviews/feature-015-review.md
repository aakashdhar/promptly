# Review: FEATURE-015 — Polish Mode
> Reviewed: 2026-04-23
> Reviewer: vibe-review skill
> Scope: POL-001–007 (7 tasks, 9 files)
> Files reviewed: main.js · preload.js · src/renderer/hooks/useTone.js · src/renderer/hooks/useMode.js
>                 src/renderer/components/IdleState.jsx · src/renderer/App.jsx
>                 src/renderer/components/PolishReadyState.jsx · src/renderer/utils/history.js
>                 src/renderer/components/HistoryPanel.jsx

---

## Automated checks

### Lint
```
npm run lint → 0 errors, 1 pre-existing warning
  main.js:4: no-console (console.error in uncaughtException handler — acceptable sentinel)
```

### Build
```
npm run build:renderer → SUCCESS
  34 modules transformed
  dist-renderer/assets/index-BnPvUviO.js  248.01 kB (gzip: 72.84 kB)
  Built in 133ms
```

### npm audit
```
3 vulnerabilities (2 low, 1 high)
  @xmldom/xmldom ≤0.8.12 — high severity (DoS via recursive XML serialisation)
    Path: electron-builder → @xmldom/xmldom (devDep chain only)
    NOT present in packaged .dmg — zero runtime risk
  @eslint/plugin-kit <0.3.4 — low (ReDoS in ConfigCommentParser)
    Path: eslint devDep chain only — zero runtime risk
```
All three are devDep-only. Identical audit report to FEATURE-014. **No P0 from audit.**

---

## Carryover from previous reviews

### Open P1 items (from FEATURE-014)
| ID | Status | Notes |
|----|--------|-------|
| BL-030 | Still open — App.jsx now 652 lines (was 561) | Added ~91 lines this feature (polish handlers, polishResult state, polishToneRef) |
| BL-031 | Still open — devDep audit vuln | No change in status |

### Open P2 items
| ID | Status | Notes |
|----|--------|-------|
| BL-027 | Still open | Hardcoded hex in index.html (unrelated) |

BL-032 (handleTypingSubmit useCallback) was marked ✅ resolved before this feature.

---

## Architecture drift detection

### Check 1: localStorage wrapper compliance — ✅ PASS
- `useTone.js` (`src/renderer/hooks/useTone.js`): direct `localStorage.getItem/setItem` calls are inside `getPolishTone()` and `setPolishTone()` wrapper functions. This IS the wrapper — same pattern as `useMode.js`. No drift.
- `IdleState.jsx`, `PolishReadyState.jsx`, `App.jsx`: zero direct `localStorage.*` calls confirmed. All tone access goes through `usePolishTone()` hook.

### Check 2: No dangerouslySetInnerHTML — ✅ PASS
- `PolishReadyState.jsx`: changes array rendered via `.map()` with JSX text nodes. No `dangerouslySetInnerHTML` anywhere.
- `HistoryPanel.jsx`: `selected.polishChanges.map()` with JSX text nodes. Compliant.

### Check 3: contextBridge / IPC pattern — ✅ PASS
- All IPC via `window.electronAPI.*`. `nodeIntegration: false`, `contextIsolation: true` unchanged.
- `preload.js` `generatePrompt` correctly passes `options` through to IPC.

### Check 4: Inline styles for new components — ✅ PASS
- `PolishReadyState.jsx`: 100% inline styles. Zero Tailwind class usage confirmed.

### Check 5: generate-prompt transcript via systemPrompt, not shell arg — ✅ PASS
- `main.js` line 463: `spawn(claudePath, ['-p', systemPrompt, '--model', 'claude-sonnet-4-6'])` — transcript embedded in systemPrompt, never passed as CLI arg.

### Check 6: polishToneRef stale-closure fix — ✅ PASS
- `App.jsx` line 107: `const polishToneRef = useRef(polishTone)`
- `App.jsx` line 111: `useEffect(() => { polishToneRef.current = polishTone }, [polishTone])`
- All three generate calls (`stopRecording`, `handleTypingSubmit`, `handleRegenerate`) correctly use `polishToneRef.current`.
- `handlePolishToneChange` uses `newTone` directly (receives it as parameter — no stale closure risk).

### Check 7: useCallback on async handlers — ✅ PASS
- `handleTypingSubmit`: `useCallback` with `[mode]` dep — ✅
- `handleRegenerate`: `useCallback` with `[mode]` dep — ✅
- `handlePolishToneChange`: `useCallback` with `[]` dep — ✅ (uses `originalTranscript.current` via ref, `newTone` via param)

### Check 8: systemPrompt declared as `let` for {TONE} mutation — ✅ PASS
- `main.js` line 452: `let systemPrompt = modeConf.standalone ? ...` — correct, enables mutation at line 460.

### Check 9: backwards compatibility of options param — ✅ PASS
- `generate-prompt` handler destructures `{ transcript, mode, options = {} }` — all existing callers omitting options receive `{}` default, unaffected.

### Check 10: ARCHITECTURE.md prompt modes table — ⚠️ P2 DRIFT
- `vibe/ARCHITECTURE.md` line 228–238: Prompt modes table ends at `Refine`. `Polish` mode not added.
- DECISIONS.md has D-POL-001 entry, and CODEBASE.md was updated correctly.
- ARCHITECTURE.md is the living constitution — it must reflect all active modes.

---

## Findings

### P0 — Critical (blocks gate)
None.

---

### P1 — Fix before deploy

#### BL-033 — App.jsx 652 lines: SRP concern continues to grow
- **File**: `src/renderer/App.jsx` — 652 lines (was 561 before this feature, 500-line P1 threshold)
- **Description**: FEATURE-015 added ~91 lines to App.jsx: `usePolishTone`, `polishResult` state, `copied` state, `polishToneRef`, `parsePolishOutput` call sites, `handlePolishToneChange`, PolishReadyState render block, onReuse update. App.jsx is now the dominant concern across all reviews. SRP is significantly violated — it owns recording, transcription, generation, history, 3-separate copy-flash states, polish parsing, iteration, and all IPC wiring.
- **Carryover of BL-030 (now grown)**: App.jsx started at 561; now 652. The trend is +90 lines/feature.
- **Fix**: Extract polish flow into a `usePolishMode` hook in the next refactor pass. Candidates: `parsePolishOutput`, `polishResult`+`polishToneRef`+their effects, `handlePolishToneChange`, and the `copied`/`setCopied` state. This won't break any API contract.

#### BL-031 (carryover) — @xmldom/xmldom high severity devDep audit vuln
- **File**: `package.json` (devDep chain: `electron-builder`)
- **Description**: GHSA-crh6-fp67-6883 — ReDoS via recursive XML serialisation. DevDep chain only. Zero runtime risk in packaged .dmg.
- **Fix**: Track for upstream `electron-builder` release that upgrades `@xmldom/xmldom ≥0.8.13`.

---

### P2 — Fix this sprint

#### BL-034 — ARCHITECTURE.md prompt modes table missing polish entry
- **File**: `vibe/ARCHITECTURE.md` line 238 (after Refine row)
- **Description**: The Prompt modes table does not include `polish`. The `generate-prompt` IPC description (line 119) also does not mention the new `options` parameter.
- **Fix**: Add `| Polish | `polish` | Standalone — clean polished prose + change notes; bypasses PROMPT_TEMPLATE; {TONE} replaced via options.tone |` row. Update IPC table generate-prompt entry to note `options` passthrough.

#### BL-035 — `copied` state not reset on PolishReadyState exit
- **File**: `src/renderer/App.jsx` line 80
- **Description**: `const [copied, setCopied] = useState(false)` lives in App.jsx and is never reset when `transition(STATES.IDLE)` or `transition(STATES.THINKING)` is called. If a user: (1) opens polish output → copy flashes green → (2) immediately dismisses via Reset → (3) generates again via history Reuse → the `copied` state will be `false` (the 1.8s timeout will have expired). However, if the user triggers Reset during the 1.8s flash window and immediately reuses a history entry, PolishReadyState will briefly render with `copied=true` showing "✓ Copied" before the 1.8s timeout fires. This is an edge-case cosmetic bug.
- **Fix**: Call `setCopied(false)` inside `transition()` when leaving PROMPT_READY, or reset in the `onReset` handler: `onReset={() => { setCopied(false); transition(STATES.IDLE) }}`.

#### BL-036 — FEATURE_TASKS.md conformance checklist not ticked
- **File**: `vibe/features/2026-04-23-polish-mode/FEATURE_TASKS.md` lines 666–683
- **Description**: All 18 conformance checklist items remain as `[ ]` unchecked. Per CLAUDE.md per-task sequence: "Verify all acceptance criteria in the feature spec are ticked." The code is correct but the tracking doc is incomplete.
- **Fix**: Tick all 18 conformance items in FEATURE_TASKS.md.

---

### P3 — Nice to have

#### — Redundant `resizeWindow(320)` calls remain
- **File**: `src/renderer/App.jsx` lines 194, 298, 328 (stopRecording onstop, handleRegenerate, handlePolishToneChange)
- **Description**: These calls follow `transition(STATES.THINKING)` which already issues `resizeWindow(STATE_HEIGHTS.THINKING)` = 320 internally. Same P3 finding from FEATURE-014 review. Each generates two identical IPC round-trips.
- **Fix**: Remove the three explicit `resizeWindow(320)` calls that follow `transition(STATES.THINKING)`.

#### — HistoryPanel uses `mode !== 'polish'` check implicitly
- **File**: `src/renderer/components/HistoryPanel.jsx` line 174
- **Description**: `const isPolish = entry.mode === 'polish'` derived per entry inside the map callback. This is correct and idiomatic. Minor stylistic note: the pattern is inconsistent with some other derivations — low priority.

---

## Strengths

- **polishToneRef stale-closure fix** (`src/renderer/App.jsx` lines 107–111): The mandatory ref-mirror pattern from ARCHITECTURE.md was applied correctly and proactively. All three generate call sites (`stopRecording`, `handleTypingSubmit`, `handleRegenerate`) read `polishToneRef.current`, while `handlePolishToneChange` uses its parameter directly. No silent stale-closure bug.

- **parsePolishOutput** (`src/renderer/App.jsx` lines 44–53): Clean pure function, defined outside the component (no dependency injection needed). Graceful degradation: if Claude omits POLISHED label, returns `raw.trim()`; if CHANGES label missing, returns `[]`. Edge case from spec section 8 correctly handled.

- **useTone.js** (`src/renderer/hooks/useTone.js`): Minimal, 22 lines. Follows `useMode.js` wrapper pattern exactly — `TONE_KEY` constant, `getPolishTone`/`setPolishTone` named exports, `usePolishTone` default export. localStorage boundary is clean.

- **Backwards compatibility** (`main.js` line 445, `preload.js` line 7): `options = {}` default parameter in IPC handler + optional third arg in preload — all existing call sites that omit options continue to work without modification.

- **PolishReadyState.jsx** (`src/renderer/components/PolishReadyState.jsx`): 145 lines. All styles inline, matching IteratingState/TypingState pattern exactly. No Tailwind classes. Props interface is 8 props (under 10-prop threshold). Edit button correctly absent per spec review P1-002 decision.

- **HistoryPanel polish integration** (`src/renderer/components/HistoryPanel.jsx` lines 174–188): `isPolish` derived from `entry.mode` (not from localStorage) — correct props-down pattern. Green accent applied to both left border and mode tag for selected entries. The optional `polishChanges` display block in the right panel (lines 303–310) is a well-executed bonus that the spec described as "optional if desired" — adds real value without bloating the component.

- **history.js polishChanges** (`src/renderer/utils/history.js` line 4): `polishChanges = null` default with `if (polishChanges) entry.polishChanges = polishChanges` guard ensures the field is sparse — only present when truthy. No schema pollution on non-polish entries.

- **onReuse polish path** (`src/renderer/App.jsx` lines 634–642): Correctly sets `polishResult` from `entry.polishChanges` before `transition(STATES.PROMPT_READY)`, so the PolishReadyState component receives its data. The fallback `entry.polishChanges || []` handles legacy history entries without the field.

---

## Spec conformance

All acceptance criteria from FEATURE_SPEC.md verified by code inspection:

| Criterion | Status |
|-----------|--------|
| `polish` in MODE_CONFIG with standalone + {TONE} + {TRANSCRIPT} | ✅ main.js line 132 |
| `generate-prompt` accepts `options = {}`, uses `options.tone` | ✅ main.js line 445, 458–461 |
| `promptly_polish_tone` key + `useTone.js` hook | ✅ useTone.js line 3 |
| `polish: 'Polish'` in MODE_LABELS | ✅ useMode.js line 11 |
| IdleState: green ring, lines icon, subtitle, tone toggle | ✅ IdleState.jsx lines 10, 52–57, 84, 115 |
| `parsePolishOutput` extracts polished + changes gracefully | ✅ App.jsx lines 44–53 |
| PolishReadyState renders polished text + changes + copy | ✅ PolishReadyState.jsx |
| PolishReadyState shown when mode === 'polish' + PROMPT_READY | ✅ App.jsx lines 603–618 |
| Tone change in output reruns generation | ✅ handlePolishToneChange App.jsx line 324 |
| Copy copies polished text only, 1.8s green flash | ✅ App.jsx lines 611–614 |
| Polish entries save to history with polishChanges field | ✅ history.js line 11; all 3 generate flows |
| HistoryPanel green mode tag for polish entries | ✅ HistoryPanel.jsx lines 174, 183, 186, 210–213 |
| Reuse from history loads PolishReadyState correctly | ✅ App.jsx lines 634–642 |
| All existing modes unaffected | ✅ options = {} default, mode guard on polish block |
| npm run lint passes | ✅ 0 errors |
| npm run build:renderer succeeds | ✅ 34 modules |
| CODEBASE.md updated | ✅ useTone.js, PolishReadyState, polishResult, polishTone, polishToneRef, copied, MODE_CONFIG 8 modes, promptly_polish_tone |
| DECISIONS.md updated (D-POL-001) | ✅ |

**Not verified by code (requires manual smoke):**
- Tone persists across app restart (localStorage write confirmed; restart test is manual)
- Green flash duration (setTimeout 1800ms confirmed in code)

### FEATURE_TASKS.md conformance checklist: NOT ticked (P2 BL-036)

---

## Quality score

| Category | Deductions |
|----------|-----------|
| P0 findings (×1.0 each) | 0 |
| P1 findings (×0.5 each) | −1.0 (BL-033 App.jsx SRP + BL-031 carryover) |
| P2 findings (×0.2 each) | −0.6 (BL-034 ARCHITECTURE.md + BL-035 copied state + BL-036 checklist) |
| P3 findings (×0.1 each) | −0.2 (resizeWindow double-calls + HistoryPanel style note) |
| Architecture drift (×0.5 each) | −0.5 (ARCHITECTURE.md modes table not updated) |
| **Score** | **7.7 / 10 — Grade B** |

Note: −0.5 for architecture drift applied because ARCHITECTURE.md prompt modes table is the living spec for prompt mode definitions and was not updated (BL-034). CODEBASE.md and DECISIONS.md were updated correctly.

---

## Gate decision

**✅ PASS — 0 P0 findings**

2 P1 findings logged to backlog (BL-033 App.jsx SRP, BL-031 carryover — both manageable).
3 P2 findings logged (BL-034 ARCHITECTURE.md update, BL-035 copied state reset, BL-036 checklist ticks).
2 P3 findings noted above.

FEATURE-015 Polish Mode is cleared for manual smoke test.
Manual smoke is the remaining gate before broader distribution.
