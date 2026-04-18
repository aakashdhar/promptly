# FEATURE_TASKS.md — F-FIRST-RUN
> Feature: First-run setup checklist
> Folder: vibe/features/2026-04-18-first-run/
> Created: 2026-04-18

> **Estimated effort:** 4 tasks — S: 3, M: 1 — approx. 3-4 hours total

---

### FRN-001 · Boot gate + DOM ID fix
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3 (acceptance criteria 1, 10)
- **Dependencies**: None
- **Touches**: `index.html`

**What to do**:
1. In the `<style>` block, add after `.firstrun-label` rule:
   ```css
   .status-ok    { color: var(--color-success); }
   .status-error { color: var(--color-recording); }
   ```
2. In `#firstrun-cli-row`, add `id="firstrun-cli-label"` to the label span and initialise `#firstrun-cli-status` to `○`:
   ```html
   <span id="firstrun-cli-status" class="firstrun-status">○</span>
   <span id="firstrun-cli-label" class="firstrun-label">Claude CLI installed</span>
   ```
3. In `#firstrun-mic-row`, add `id="firstrun-mic-status"` and `id="firstrun-mic-label"`:
   ```html
   <span id="firstrun-mic-status" class="firstrun-status">○</span>
   <span id="firstrun-mic-label" class="firstrun-label">Microphone access granted</span>
   ```
3. Add module-scope variables after `generatedPrompt`:
   ```js
   let cliOk = false;
   let micOk = false;
   ```
4. Change the boot line at the end of DOMContentLoaded from:
   ```js
   setState('IDLE');
   ```
   to:
   ```js
   if (getFirstRunComplete()) {
     setState('IDLE');
   } else {
     initFirstRun();
   }
   ```
   Note: `initFirstRun()` is defined in FRN-002 — add a stub `function initFirstRun() {}` here so the call doesn't throw, to be replaced in FRN-002.

**Acceptance criteria**:
- [ ] `#firstrun-cli-status` initialised to `○` in DOM
- [ ] `#firstrun-cli-label` ID present in DOM
- [ ] `#firstrun-mic-status` ID present in DOM
- [ ] `#firstrun-mic-label` ID present in DOM
- [ ] `.status-ok` and `.status-error` classes defined in `<style>`
- [ ] `cliOk`, `micOk` declared as module-scope vars
- [ ] Boot line calls `initFirstRun()` when `getFirstRunComplete()` returns false
- [ ] Boot line calls `setState('IDLE')` when `getFirstRunComplete()` returns true
- [ ] `npm run lint` passes

**Self-verify**: Reload app with DevTools open → confirm `localStorage.getItem('firstRunComplete')` is `null` → initFirstRun stub called (console.log if needed). Then set `localStorage.setItem('firstRunComplete', 'true')` → reload → IDLE boots directly.
**Test requirement**: Manual smoke — verify both boot paths work before FRN-002.
**⚠️ Boundaries**: Never toggle `#state-first-run` hidden directly — always via setState(). Do not access `localStorage.firstRunComplete` directly.
**CODEBASE.md update?**: No — wait until FRN-004 to update all at once.
**Architecture compliance**: localStorage via wrappers only; module-scope vars follow existing pattern.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FRN-002 · `initFirstRun()` — CLI check + mic pre-check
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3 (criteria 2-8), FEATURE_SPEC.md#8 (edge cases)
- **Dependencies**: FRN-001
- **Touches**: `index.html`

**What to do**:
Replace the stub `initFirstRun()` from FRN-001 with the full implementation:

```js
async function initFirstRun() {
  setState('FIRST_RUN');

  // CLI check
  const cliStatus = document.getElementById('firstrun-cli-status');
  const cliLabel = document.getElementById('firstrun-cli-label');
  let cliResult;
  try {
    cliResult = await window.electronAPI.checkClaudePath();
  } catch {
    cliResult = { found: false, error: 'IPC unavailable' };
  }
  if (cliResult.found) {
    cliOk = true;
    cliStatus.textContent = '✓';
    cliStatus.className = 'firstrun-status status-ok';
  } else {
    cliStatus.textContent = '✗';
    cliStatus.className = 'firstrun-status status-error';
    cliLabel.textContent = 'Install: npm i -g @anthropic-ai/claude-code';
  }

  // Mic pre-check
  const micStatus = document.getElementById('firstrun-mic-status');
  const micLabel = document.getElementById('firstrun-mic-label');
  const micBtn = document.getElementById('firstrun-mic-btn');
  try {
    const permResult = await navigator.permissions.query({ name: 'microphone' });
    if (permResult.state === 'granted') {
      micOk = true;
      micStatus.textContent = '✓';
      micStatus.className = 'firstrun-status status-ok';
      micBtn.hidden = true;
    } else if (permResult.state === 'denied') {
      micStatus.textContent = '✗';
      micStatus.className = 'firstrun-status status-error';
      micLabel.textContent = 'Enable in System Settings → Privacy';
      micBtn.hidden = true;
    }
    // 'prompt' state: leave button visible, ○ stays
  } catch {
    // permissions API unsupported — leave button visible
  }

  checkFirstRunCompletion();
}
```

Add a stub for `checkFirstRunCompletion()` at the bottom of the script (to be replaced in FRN-004):
```js
function checkFirstRunCompletion() {}
```

**Acceptance criteria**:
- [ ] `setState('FIRST_RUN')` called at top of `initFirstRun()`
- [ ] `checkClaudePath()` result correctly updates CLI status row (✓ or ✗ + install text)
- [ ] `cliOk` set to `true` only when `cliResult.found` is true
- [ ] `navigator.permissions.query` called for microphone; 'granted' hides button and shows ✓
- [ ] 'denied' state shows ✗ and updates label, hides button
- [ ] 'prompt' state leaves button visible and ○ shown
- [ ] `checkFirstRunCompletion()` called at end of `initFirstRun()`
- [ ] All text set via `textContent` — never `innerHTML`
- [ ] `npm run lint` passes

**Self-verify**: Re-read FEATURE_SPEC.md#3 and #8. Tick each criterion. Launch app fresh (clear `firstRunComplete`) → verify FIRST_RUN panel shows with correct CLI status (should be ✓ on dev machine where claude is installed).
**Test requirement**: Manual smoke — CLI row shows ✓ on dev machine. Mic row shows button (likely in 'prompt' state first time).
**⚠️ Boundaries**: querySelector on `.firstrun-label` within known parent IDs is acceptable; do not use querySelector chains beyond immediate sibling lookups. Never `innerHTML`.
**CODEBASE.md update?**: No — wait until FRN-004.
**Architecture compliance**: textContent for dynamic text; contextBridge IPC pattern via `window.electronAPI`; all state DOM changes via setState().

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FRN-003 · Mic grant button handler
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3 (criteria 7-9), FEATURE_SPEC.md#8 (getUserMedia error)
- **Dependencies**: FRN-001
- **Touches**: `index.html`

**What to do**:
Inside the DOMContentLoaded event listener (before the boot gate), add the mic button click handler:

```js
document.getElementById('firstrun-mic-btn').addEventListener('click', async () => {
  const micStatus = document.getElementById('firstrun-mic-status');
  const micLabel = document.getElementById('firstrun-mic-label');
  const micBtn = document.getElementById('firstrun-mic-btn');
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    micOk = true;
    micStatus.textContent = '✓';
    micStatus.className = 'firstrun-status status-ok';
    micBtn.hidden = true;
    checkFirstRunCompletion();
  } catch {
    micStatus.textContent = '✗';
    micStatus.className = 'firstrun-status status-error';
    micLabel.textContent = 'Enable in System Settings → Privacy';
    micBtn.hidden = true;
  }
});
```

**Acceptance criteria**:
- [ ] Click on `#firstrun-mic-btn` calls `getUserMedia({ audio: true })`
- [ ] On success: `micOk = true`, ✓ shown, button hidden
- [ ] On error: ✗ shown, label updated, button hidden
- [ ] `checkFirstRunCompletion()` called on success
- [ ] `textContent` used for all text updates
- [ ] `npm run lint` passes

**Self-verify**: Re-read FEATURE_SPEC.md#3 criteria 7-9. Launch → clear localStorage → FIRST_RUN → click button → macOS dialog appears.
**Test requirement**: Manual smoke — click "Grant Access" → confirm macOS permission dialog appears. Allow → ✓ shown, button hidden.
**⚠️ Boundaries**: Event listener set once at DOMContentLoaded — not dynamically attached. Button `hidden` via property assignment, not `style.display`.
**CODEBASE.md update?**: No — wait until FRN-004.
**Architecture compliance**: Event listener once at DOMContentLoaded; textContent; no innerHTML.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FRN-004 · `checkFirstRunCompletion()` + IDLE transition
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3 (criteria 10-11), FEATURE_SPEC.md#9 (600ms delay)
- **Dependencies**: FRN-002, FRN-003
- **Touches**: `index.html`, `vibe/CODEBASE.md`

**What to do**:
Replace the stub `checkFirstRunCompletion()` with the real implementation:

```js
function checkFirstRunCompletion() {
  if (cliOk && micOk) {
    setFirstRunComplete(true);
    setTimeout(() => setState('IDLE'), 600);
  }
}
```

Then update `vibe/CODEBASE.md`:
- Add `cliOk` and `micOk` to the module-scope variables table
- Add `firstrun-mic-status` to the DOM element IDs table
- Add `initFirstRun()` and `checkFirstRunCompletion()` to the index.html function list
- Update "Current state" to note F-FIRST-RUN as in progress

**Acceptance criteria**:
- [x] `checkFirstRunCompletion()` calls `setFirstRunComplete(true)` when both flags true
- [x] `setState('IDLE')` fires after 600ms delay (not immediately)
- [x] When only one flag is true, function is a no-op
- [x] `setFirstRunComplete` used — never `localStorage.setItem` directly
- [x] CODEBASE.md updated with all new vars/functions/IDs from this feature
- [x] `npm run lint` passes

**Self-verify**: Re-read FEATURE_SPEC.md#3 criteria 10-11. Full happy-path smoke test: clear localStorage → launch → CLI ✓ → click Grant Access → allow → both ✓ → 600ms → IDLE. Then restart → IDLE directly.
**Test requirement**: Full happy-path smoke test as described above. Also verify `localStorage.getItem('firstRunComplete')` is `'true'` after completion (check in DevTools).
**⚠️ Boundaries**: `setFirstRunComplete` wrapper only — never `localStorage.setItem`. setState is the only way to transition to IDLE.
**CODEBASE.md update?**: Yes — update vars table, DOM IDs table, function list, current state.
**Architecture compliance**: localStorage only via wrapper; setState for all state transitions.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: F-FIRST-RUN
> Tick after every task. All items ✅ before feature is shippable.
- [x] First launch shows FIRST_RUN state, not IDLE
- [x] CLI check reflects actual claudePath resolution result
- [x] Mic grant button triggers macOS permission dialog
- [x] Both checks pass → auto-transition to IDLE within 600ms
- [x] Subsequent launches skip directly to IDLE
- [x] No new IPC channels added
- [x] No `innerHTML` with dynamic content
- [x] No `localStorage.*` direct access (wrappers only)
- [x] All existing tests still pass (manual: all 6 states still reachable)
- [x] Linter clean (`npm run lint`)
- [x] No regressions: IDLE, RECORDING stub, ERROR dismiss all still work
- [x] CODEBASE.md updated: cliOk, micOk, initFirstRun(), checkFirstRunCompletion(), firstrun-mic-status

---
