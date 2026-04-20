# FEATURE_TASKS.md — FEATURE-010: Refine Mode
> Created: 2026-04-20
> **Estimated effort:** 5 tasks — S: 3 (<2hrs), M: 2 (2-4hrs) — approx. 3 hours total

---

### RFNE-001 · main.js — add refine to MODE_CONFIG and show-mode-menu
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#5-integration-points
- **Dependencies**: None
- **Touches**: `main.js`

**What to do**:
1. In MODE_CONFIG, add after `design` entry:
```js
refine: { name: 'Refine', standalone: true, instruction: `[exact system prompt — see FEATURE_SPEC acceptance criteria]` }
```
2. In `show-mode-menu` IPC handler modes array, add after `{ key: 'design', label: 'Design' }`:
```js
{ key: 'refine', label: 'Refine' },
```

**Acceptance criteria**:
- [ ] `refine` key present in MODE_CONFIG with `standalone: true` and full system prompt
- [ ] `refine` appears in right-click context menu after `Design`
- [ ] Selecting Refine from menu sends `mode-selected` with value `'refine'`

**Self-verify**: Generate a prompt in Refine mode and confirm four sections appear.
**Test requirement**: Manual — right-click → see Refine, click it, confirm pill updates.
**⚠️ Boundaries**: Never use `standalone: false` for refine — it has its own 4-section output format.
**CODEBASE.md update?**: Yes — note 7 modes in MODE_CONFIG.
**Architecture compliance**: `standalone: true` pattern identical to `design` mode.

**Decisions**:
- None yet.

---

### RFNE-002 · useMode.js — add refine label
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#5-integration-points
- **Dependencies**: RFNE-001
- **Touches**: `src/renderer/hooks/useMode.js`

**What to do**:
Add `refine: 'Refine'` to the MODE_LABELS object.

**Acceptance criteria**:
- [ ] `useMode()` returns `modeLabel === 'Refine'` when mode is `'refine'`
- [ ] Falls back to 'Balanced' for unknown modes (existing fallback in hook)

**Self-verify**: Select Refine from menu, confirm pill shows 'Refine'.
**Test requirement**: Manual — pill label check.
**⚠️ Boundaries**: Do not change default mode value.
**CODEBASE.md update?**: No — logic only.
**Architecture compliance**: Same pattern as all other MODE_LABELS entries.

**Decisions**:
- None yet.

---

### RFNE-003 · IdleState.jsx — purple accent for Refine mode
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria
- **Dependencies**: RFNE-002
- **Touches**: `src/renderer/components/IdleState.jsx`

**What to do**:
1. Derive `const isRefine = mode === 'refine'` at top of component.
2. Mode pill: change background/border/color to purple when isRefine.
   - background: `isRefine ? 'rgba(168,85,247,0.12)' : 'rgba(10,132,255,0.12)'`  (was hardcoded via Tailwind — switch to inline style)
   - border: `isRefine ? '0.5px solid rgba(168,85,247,0.3)' : '0.5px solid rgba(10,132,255,0.25)'`
   - color: `isRefine ? 'rgba(200,160,255,0.9)' : 'rgba(100,180,255,0.85)'`
3. Pulse ring container: conditional inline styles.
   - background: `isRefine ? 'rgba(168,85,247,0.12)' : 'rgba(10,132,255,0.15)'`
   - border: `isRefine ? '1px solid rgba(168,85,247,0.35)' : '1px solid rgba(10,132,255,0.4)'`
   - boxShadow: `isRefine ? '0 0 12px rgba(168,85,247,0.2)' : '0 0 12px rgba(10,132,255,0.3), 0 0 24px rgba(10,132,255,0.12)'`
4. Pulse ring divs (2 animated border divs): switch Tailwind border color classes to purple when isRefine.
5. Mic SVG: change stroke colors to `isRefine ? 'rgba(200,160,255,0.8)' : 'rgba(100,180,255,1)'`.
6. Subtitle text: `isRefine ? "Describe what exists, what's wrong, and what you want" : "Press ⌥ Space or click to speak your prompt"`.

**Acceptance criteria**:
- [ ] Mode pill shows purple colors when refine is active
- [ ] Pulse ring container shows purple background/border/shadow
- [ ] Mic SVG strokes are purple
- [ ] Subtitle text changes to refine copy
- [ ] All other modes: no change to existing blue colors

**Self-verify**: Switch between Balanced and Refine — visuals must toggle.
**Test requirement**: Manual — idle state visual check in both modes.
**⚠️ Boundaries**: Only use inline styles for dynamic values. Static classes stay Tailwind.
**CODEBASE.md update?**: No — component behavior only.
**Architecture compliance**: Tailwind static + inline dynamic — per ARCHITECTURE.md styling rule.

**Decisions**:
- None yet.

---

### RFNE-004 · PromptReadyState.jsx — purple accent for Refine mode
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria
- **Dependencies**: RFNE-002
- **Touches**: `src/renderer/components/PromptReadyState.jsx`

**What to do**:
1. Add `labelColor` param to `renderPromptOutput(text, labelColor = 'rgba(100,170,255,0.42)')` — use it in the label span style.
2. Status line: `{mode === 'refine' ? 'Refinement prompt ready' : 'Prompt ready'}`.
3. renderPromptOutput call: pass `mode === 'refine' ? 'rgba(168,85,247,0.7)' : 'rgba(100,170,255,0.42)'`.
4. Copy button className hover shadow: `mode === 'refine' ? 'hover:shadow-[0_4px_28px_rgba(168,85,247,0.65)]' : 'hover:shadow-[0_4px_28px_rgba(10,132,255,0.65)]'` (isCopied check takes priority).
5. Copy button background: `isCopied ? green : mode === 'refine' ? purple : blue`.
6. Copy button boxShadow: `isCopied ? green-shadow : mode === 'refine' ? 'rgba(168,85,247,0.3)' : blue-shadow`.

**Acceptance criteria**:
- [ ] Status line shows 'Refinement prompt ready' when mode === 'refine'
- [ ] Section labels (Current state, Problem, Desired outcome, Constraints) render in purple
- [ ] Copy button shows purple gradient when mode === 'refine' and not yet copied
- [ ] Copy button still turns green on copy regardless of mode
- [ ] Blue mode unaffected

**Self-verify**: Generate a prompt in Refine mode — check all four visual targets.
**Test requirement**: Manual — full Refine flow, verify each visual.
**⚠️ Boundaries**: isCopied state takes priority over mode for button color.
**CODEBASE.md update?**: No — component logic only.
**Architecture compliance**: JSX text nodes only. Inline styles for dynamic values.

**Decisions**:
- None yet.

---

### RFNE-005 · Docs — CODEBASE.md + DECISIONS.md + TASKS.md
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#9-conformance-checklist
- **Dependencies**: RFNE-001 through RFNE-004
- **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`, `vibe/ARCHITECTURE.md`

**What to do**:
1. CODEBASE.md — update MODE_CONFIG row to note 7 modes including `refine`.
2. ARCHITECTURE.md — add Refine row to Prompt modes table.
3. DECISIONS.md — append Feature Start entry for FEATURE-010.
4. TASKS.md — mark FEATURE-010 complete, update What just happened + What's next.

**Acceptance criteria**:
- [ ] CODEBASE.md reflects 7 modes
- [ ] ARCHITECTURE.md prompt modes table has Refine row
- [ ] DECISIONS.md has FEATURE-010 entry
- [ ] TASKS.md shows FEATURE-010 complete

**CODEBASE.md update?**: Yes — this task IS the update.

**Decisions**:
- None yet.

---

#### Conformance: FEATURE-010 Refine Mode
> Tick after every task. All items ✅ before feature is shippable.
- [ ] All acceptance criteria above ticked
- [ ] `npm run lint` passes (0 errors)
- [ ] Manual smoke test: Refine appears in menu → purple UI → record → four sections → purple labels → purple copy button → copy works → green flash → mode persists after restart
- [ ] Other modes: no visual regression (blue accent still present)
- [ ] CODEBASE.md updated (7 modes)
- [ ] ARCHITECTURE.md updated (Refine row in prompt modes table)
- [ ] DECISIONS.md updated
