# FEATURE_TASKS.md — F-ACTIONS: Copy, Edit, Regenerate
> Feature: Action buttons in PROMPT_READY state
> Folder: vibe/features/2026-04-18-actions/
> Created: 2026-04-18

> **Estimated effort:** 4 tasks — S: 3, M: 1 — approx. 3-4 hours total

---

### FAC-001 · Copy button — green flash + clipboard IPC
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3 (Copy), SPEC.md#F5
- **Dependencies**: None
- **Touches**: `index.html`

**What to do**:

1. Add `.btn-success` CSS rule in `<style>` block (after `.btn-action:hover`):

```css
.btn-action.btn-success {
  background: var(--color-success);
}
```

2. In `DOMContentLoaded`, after the mode menu setup block, add:

```js
// Copy
document.getElementById('action-copy').addEventListener('click', async () => {
  await window.electronAPI.copyToClipboard(generatedPrompt);
  const btn = document.getElementById('action-copy');
  btn.textContent = 'Copied!';
  btn.classList.add('btn-success');
  setTimeout(() => {
    btn.textContent = 'Copy';
    btn.classList.remove('btn-success');
  }, 1800);
});
```

**Acceptance criteria**:
- [ ] Clicking Copy calls `window.electronAPI.copyToClipboard(generatedPrompt)`
- [ ] Button background changes to `--color-success` (green) on click
- [ ] Button text changes to "Copied!" on click
- [ ] After 1800ms: button text returns to "Copy", green removed
- [ ] Prompt text stays visible throughout — no state transition
- [ ] `.btn-action.btn-success` rule uses `--color-success` token (no hardcoded hex)

**Self-verify**: `npm start` → speak → PROMPT_READY → click Copy → green flash 1.8s → "Copied!" → returns to "Copy" → paste in any app confirms clipboard text matches generated prompt.
**Test requirement**: Manual — Copy flash + clipboard paste confirms correct text.
**⚠️ Boundaries**: Do not touch `main.js` or `preload.js` — `copy-to-clipboard` is already live.
**CODEBASE.md update?**: No — wait for FAC-004.
**Architecture compliance**: `textContent` for button label. No state transition — prompt stays visible. CSS token for color.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FAC-002 · Edit mode — contenteditable, Escape cancel, Done save
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3 (Edit), SPEC.md#F6
- **Dependencies**: None
- **Touches**: `index.html`

**What to do**:

In `DOMContentLoaded`, after the Copy listener, add three listeners:

```js
// Edit
document.getElementById('action-edit').addEventListener('click', () => {
  const output = document.getElementById('prompt-output');
  output.contentEditable = 'true';
  output.focus();
  document.getElementById('action-edit').hidden = true;
  document.getElementById('action-done').hidden = false;
});

// Done
document.getElementById('action-done').addEventListener('click', () => {
  const output = document.getElementById('prompt-output');
  generatedPrompt = output.textContent;
  output.contentEditable = 'false';
  document.getElementById('action-done').hidden = true;
  document.getElementById('action-edit').hidden = false;
});

// Escape to cancel edit
document.getElementById('prompt-output').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const output = document.getElementById('prompt-output');
    output.textContent = generatedPrompt;
    output.contentEditable = 'false';
    document.getElementById('action-done').hidden = true;
    document.getElementById('action-edit').hidden = false;
  }
});
```

Note: `setState('PROMPT_READY', { prompt })` already sets `#prompt-output` via `textContent` and `contentEditable` defaults to `'false'` (inherited), so entering PROMPT_READY always starts in non-edit mode.

**Acceptance criteria**:
- [ ] Clicking Edit sets `#prompt-output` contentEditable to `'true'` and focuses it
- [ ] Edit button hidden while Done button shown during edit mode
- [ ] Pressing Escape: `#prompt-output.textContent` restored to `generatedPrompt`, contentEditable set to `'false'`, Done hidden, Edit shown
- [ ] Clicking Done: `generatedPrompt` updated to `#prompt-output.textContent`, contentEditable set to `'false'`, Done hidden, Edit shown
- [ ] `originalTranscript` is not touched anywhere in this task
- [ ] Re-entering PROMPT_READY (from Regenerate) resets to non-edit mode (setState sets textContent, contentEditable not set to true)

**Self-verify**: PROMPT_READY → click Edit → type → Done → text persists → click Edit → type → Escape → original restored → click Edit → type → click Regenerate (goes to THINKING then PROMPT_READY with fresh prompt, not edited text).
**Test requirement**: Manual — Edit/Done saves; Escape restores; Regenerate uses originalTranscript not edited text.
**⚠️ Boundaries**: Do not mutate `originalTranscript`. Use `textContent` not `innerHTML` for restoration. `contentEditable` attribute toggles via property assignment (`output.contentEditable = 'true'`).
**CODEBASE.md update?**: No — wait for FAC-004.
**Architecture compliance**: `textContent` only. Event listeners set once at DOMContentLoaded. No direct DOM visibility toggles outside `hidden` attribute (not setState — these are within-state visibility changes, not state transitions).

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FAC-003 · Regenerate button — originalTranscript → THINKING → PROMPT_READY
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3 (Regenerate), SPEC.md#F7
- **Dependencies**: None
- **Touches**: `index.html`

**What to do**:

In `DOMContentLoaded`, after the Done/Escape listeners, add:

```js
// Regenerate
document.getElementById('action-regenerate').addEventListener('click', async () => {
  setState('THINKING');
  const genResult = await window.electronAPI.generatePrompt(originalTranscript, getMode());
  if (!genResult.success) {
    setState('ERROR', { message: genResult.error });
    return;
  }
  generatedPrompt = genResult.prompt;
  setState('PROMPT_READY', { prompt: generatedPrompt });
});
```

**Acceptance criteria**:
- [ ] Clicking Regenerate immediately calls `setState('THINKING')`
- [ ] Calls `window.electronAPI.generatePrompt(originalTranscript, getMode())` — not `generatedPrompt`
- [ ] On success → `generatedPrompt = genResult.prompt`, `setState('PROMPT_READY', { prompt: generatedPrompt })`
- [ ] On failure → `setState('ERROR', { message: genResult.error })`
- [ ] `originalTranscript` read-only — not mutated
- [ ] Mode used is `getMode()` at time of click (current active mode)

**Self-verify**: PROMPT_READY → change mode via right-click → click Regenerate → THINKING → PROMPT_READY with different mode output. Also: PROMPT_READY → Edit → type → Done → Regenerate → PROMPT_READY output is new generation from original speech (not the edited text).
**Test requirement**: Manual — Regenerate transitions THINKING → PROMPT_READY; uses originalTranscript not generatedPrompt.
**⚠️ Boundaries**: `originalTranscript` must not be reassigned. Use `getMode()` not direct localStorage access.
**CODEBASE.md update?**: No — wait for FAC-004.
**Architecture compliance**: `setState()` for all state transitions. `getMode()` wrapper. `textContent` used by setState for PROMPT_READY payload.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FAC-004 · CODEBASE.md update
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#10
- **Dependencies**: FAC-001, FAC-002, FAC-003
- **Touches**: `vibe/CODEBASE.md`

**What to do**:

1. Update "Last updated" line:
   ```
   > Last updated: 2026-04-18 (FAC-004 — F-ACTIONS complete: Copy flash, Edit contenteditable, Regenerate)
   ```

2. Update "Current state":
   ```
   **Phase:** Phase 2 in progress — F-STATE ✅ — F-FIRST-RUN ✅ — F-SPEECH ✅ — F-CLAUDE ✅ — F-ACTIONS ✅ — Phase 2 complete (pending review: phase 2)
   ```

3. Add `.btn-success` CSS note under CSS design tokens section.

4. Update index.html file map note — action handlers wired for Copy, Edit, Regenerate.

**Acceptance criteria**:
- [ ] "Last updated" line updated to FAC-004
- [ ] "Current state" reflects F-ACTIONS complete, Phase 2 complete
- [ ] CODEBASE.md accurately reflects all F-ACTIONS additions

**Self-verify**: Read CODEBASE.md — all 4 changes visible.
**Test requirement**: No code changes — CODEBASE.md only.
**⚠️ Boundaries**: Only CODEBASE.md changes. Do not touch source files.
**CODEBASE.md update?**: Yes — this is the CODEBASE.md update task.
**Architecture compliance**: N/A — documentation only.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: F-ACTIONS
> Tick after every task. All items ✅ before feature is shippable.
- [ ] Copy flashes green (`--color-success`) for 1.8s, text "Copied!", returns to "Copy"
- [ ] Copy writes `generatedPrompt` to clipboard via `copyToClipboard` IPC
- [ ] Edit makes `#prompt-output` contenteditable, shows Done, hides Edit
- [ ] Escape cancels edit: restores `generatedPrompt`, exits contenteditable, hides Done, shows Edit
- [ ] Done saves `#prompt-output.textContent` to `generatedPrompt`, exits contenteditable
- [ ] `originalTranscript` never mutated by any action
- [ ] Regenerate uses `originalTranscript` (not `generatedPrompt` or edited DOM text)
- [ ] Regenerate uses current `getMode()` at click time
- [ ] Regenerate transitions THINKING → PROMPT_READY on success
- [ ] Regenerate transitions to ERROR on failure
- [ ] No new IPC channels added
- [ ] No `innerHTML` with dynamic content
- [ ] No `localStorage.*` direct access
- [ ] `npm run lint` passes
- [ ] CODEBASE.md updated
