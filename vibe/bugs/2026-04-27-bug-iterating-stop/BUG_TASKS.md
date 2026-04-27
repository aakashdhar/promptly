# BUG_TASKS — Iterating stop button missing in expanded view

### BUG-ITER-001 · Implement fix
- **Status**: `[x]` | **Depends on**: None | **Touches**: App.jsx, ExpandedView.jsx, ExpandedTransportBar.jsx

**What changed**:
1. `App.jsx` — added `onStopIterate={stopIterating}` to `<ExpandedView>`
2. `ExpandedView.jsx` — accepted `onStopIterate` prop and forwarded to `<ExpandedTransportBar>`
3. `ExpandedTransportBar.jsx`:
   - Added `onStopIterate` prop + `isIterating = currentState === 'ITERATING'`
   - Centre button: click calls `onStopIterate` when iterating; shows stop square icon + blue glow + `iterGlow` animation
   - Blue pulse rings shown during ITERATING
   - Pause button + timer dimmed (opacity 0.35/0.2) during ITERATING (same as isTyping)
   - Waveform zone: renders `<MorphCanvas />` during ITERATING (reuses existing blue wave)

**Acceptance criteria**:
- [x] Centre button shows blue stop affordance during ITERATING in expanded view
- [x] Clicking centre button calls `stopIterating()` correctly
- [x] Blue waveform visible during ITERATING
- [x] Pause button dimmed (not clickable visually) during ITERATING
- [x] Build passes (`npm run build:renderer` — 0 errors)
- [x] Lint clean (`npm run lint` — 0 errors)

---

### BUG-ITER-002 · Verify + update docs
- **Status**: `[ ]` | **Depends on**: BUG-ITER-001

**What to do**:
1. Manual smoke test: expanded view → iterate → confirm stop button works
2. Update CODEBASE.md ExpandedTransportBar props entry
3. Append DECISIONS.md entry
4. Update TASKS.md

---

#### Bug Fix Sign-off
- [ ] Fix implemented — centre button stops iteration in expanded view
- [ ] Build clean
- [ ] Lint clean
- [ ] Manual smoke test — expanded iterate → stop → THINKING → PROMPT_READY
- [ ] CODEBASE.md updated
- [ ] DECISIONS.md updated
