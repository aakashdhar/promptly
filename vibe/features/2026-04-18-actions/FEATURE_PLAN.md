# FEATURE_PLAN.md — F-ACTIONS: Copy, Edit, Regenerate
> Created: 2026-04-18

---

## 1. Impact map

**Files to modify:**
- `index.html` — add event listeners for Copy, Edit (Done/Escape), Regenerate; add copy flash CSS

**Files explicitly out of scope (do not touch):**
- `main.js` — `copy-to-clipboard` IPC already implemented; no changes needed
- `preload.js` — `copyToClipboard` already exposed; no changes needed
- `package.json`, `entitlements.plist` — no changes

---

## 2. Files out of scope

`main.js`, `preload.js`, `package.json`, `entitlements.plist` — all no-touch for this feature.

---

## 3. DB migration plan

None — no database, no localStorage keys added.

---

## 4. Backend changes

None — `copy-to-clipboard` and `generate-prompt` IPC handlers are already live.

---

## 5. Frontend changes (index.html only)

### CSS additions (in `<style>` block)
- `.btn-action.btn-success` — green flash state: `background: var(--color-success)`
- Transition already on `.btn-action`: `transition: opacity 150ms ease` — no new transitions needed

### JS additions (in `DOMContentLoaded`)
All listeners added once at DOMContentLoaded, after existing listener blocks.

**Copy handler** (`#action-copy`):
```js
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

**Edit handler** (`#action-edit`):
```js
document.getElementById('action-edit').addEventListener('click', () => {
  const output = document.getElementById('prompt-output');
  output.contentEditable = 'true';
  output.focus();
  document.getElementById('action-edit').hidden = true;
  document.getElementById('action-done').hidden = false;
});
```

**Done handler** (`#action-done`):
```js
document.getElementById('action-done').addEventListener('click', () => {
  const output = document.getElementById('prompt-output');
  generatedPrompt = output.textContent;
  output.contentEditable = 'false';
  document.getElementById('action-done').hidden = true;
  document.getElementById('action-edit').hidden = false;
});
```

**Escape key handler** (on `#prompt-output`):
```js
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

**Regenerate handler** (`#action-regenerate`):
```js
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

---

## 6. Conventions to follow (from ARCHITECTURE.md)

- `textContent` only — never `innerHTML` for any user-generated or Claude-generated content
- Event listeners set once at `DOMContentLoaded` — no dynamic attachment
- All state transitions via `setState()` — never toggle DOM visibility directly
- `getMode()` for all localStorage mode reads
- `generatedPrompt` module-scope var — write via `=` assignment, never via DOM attribute
- `originalTranscript` — read-only in this feature

---

## 7. Task breakdown

| ID | Title | Size | Deps |
|----|-------|------|------|
| FAC-001 | Copy button — flash + clipboard IPC | S | None |
| FAC-002 | Edit mode — contenteditable, Escape, Done | M | None |
| FAC-003 | Regenerate — originalTranscript → THINKING → PROMPT_READY | S | None |
| FAC-004 | CODEBASE.md update | S | FAC-001, FAC-002, FAC-003 |

FAC-001, FAC-002, FAC-003 are independent — all touch different DOM elements in `index.html`.

---

## 8. Rollback plan

All changes are additive event listeners in `index.html`. Revert = remove the 5 listener blocks added in DOMContentLoaded. No IPC changes, no schema changes.

---

## 9. Testing strategy

Manual smoke test (per ARCHITECTURE.md v1 testing philosophy):
- Copy: PROMPT_READY → click Copy → green flash 1.8s → "Copied!" → paste confirms clipboard content
- Edit: click Edit → type change → Done → text updated; click Edit → type → Escape → text restored
- Regenerate: PROMPT_READY → click Regenerate → THINKING → PROMPT_READY with new prompt

---

## 10. CODEBASE.md sections to update (FAC-004)

- "Last updated" line
- "Current state" — F-ACTIONS ✅, Phase 2 complete pending review
- File map — index.html key exports: add `copyFlash()` logic note
- DOM element IDs — already accurate (IDs existed since F-STATE)
- "What just happened" / "What's next" in TASKS.md
