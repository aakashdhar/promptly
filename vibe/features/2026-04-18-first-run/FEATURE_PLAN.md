# FEATURE_PLAN.md — F-FIRST-RUN
> Feature: First-run setup checklist
> Created: 2026-04-18

---

## 1. Impact map

**Files to modify:**

| File | Change |
|------|--------|
| `index.html` | All logic: new vars, CSS classes, `initFirstRun()`, `checkFirstRunCompletion()`, mic button handler, boot gate, DOM ID addition |

**New files:** None

---

## 2. Files explicitly out of scope

| File | Reason |
|------|--------|
| `main.js` | `check-claude-path` handler already complete and correct |
| `preload.js` | `checkClaudePath()` already exposed via contextBridge |
| `package.json` | No new deps |
| `entitlements.plist` | Mic entitlement already set (P1-002) |

---

## 3. DB migration plan

None — `firstRunComplete` localStorage key already defined in spec and wrappers already implemented.

---

## 4. Backend changes

None. All IPC needed (`check-claude-path`) is already registered in main.js.

---

## 5. Frontend changes (index.html only)

### 5a. CSS — add 2 classes (within existing `<style>` block)

After `.firstrun-label` rule, add:
```css
.status-ok    { color: var(--color-success); }
.status-error { color: var(--color-recording); }
```

### 5b. DOM — add IDs to anonymous spans

In `#firstrun-cli-row`, add `id="firstrun-cli-status"` initial value `○` and `id="firstrun-cli-label"` to the label:
```html
<span id="firstrun-cli-status" class="firstrun-status">○</span>
<span id="firstrun-cli-label" class="firstrun-label">Claude CLI installed</span>
```

In `#firstrun-mic-row`, add `id="firstrun-mic-status"` and `id="firstrun-mic-label"`:
```html
<span id="firstrun-mic-status" class="firstrun-status">○</span>
<span id="firstrun-mic-label" class="firstrun-label">Microphone access granted</span>
```

Note: `#firstrun-cli-status` already exists in the DOM but currently has no initial text — initialise to `○` for visual consistency with the mic row.

### 5c. Module-scope variables — add after `generatedPrompt`

```js
let cliOk = false;
let micOk = false;
```

### 5d. New function: `initFirstRun()`

```js
async function initFirstRun() {
  setState('FIRST_RUN');

  // CLI check
  let cliResult;
  try {
    cliResult = await window.electronAPI.checkClaudePath();
  } catch {
    cliResult = { found: false, error: 'IPC unavailable' };
  }
  const cliStatus = document.getElementById('firstrun-cli-status');
  const cliLabel = document.getElementById('firstrun-cli-label');
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
    // 'prompt' state: leave button visible, status stays ○
  } catch {
    // permissions API unsupported — leave button visible
  }

  checkFirstRunCompletion();
}
```

### 5e. New function: `checkFirstRunCompletion()`

```js
function checkFirstRunCompletion() {
  if (cliOk && micOk) {
    setFirstRunComplete(true);
    setTimeout(() => setState('IDLE'), 600);
  }
}
```

### 5f. Mic button handler (inside DOMContentLoaded)

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

### 5g. Boot gate change (DOMContentLoaded, last line)

Before:
```js
setState('IDLE');
```
After:
```js
if (getFirstRunComplete()) {
  setState('IDLE');
} else {
  initFirstRun();
}
```

---

## 6. Conventions to follow

From ARCHITECTURE.md and CODEBASE.md:

- `setState()` is the only DOM visibility mutation point — never toggle `hidden` on state panels directly
- `textContent` for all dynamic text — never `innerHTML` with user or external content
- `getFirstRunComplete()` / `setFirstRunComplete()` — never `localStorage.*` directly
- All elements accessed by `id` — no `querySelector` chains except for `.firstrun-label` siblings (acceptable since they're within known parent IDs)
- Event listeners set once at `DOMContentLoaded` — no dynamic attachment
- `window.electronAPI` methods called from renderer — never `ipcRenderer` directly
- Transitions: `opacity 150ms ease` only — no transforms in transitions
- Design tokens: use `--color-success` and `--color-recording` via CSS classes — no hardcoded hex

---

## 7. Task breakdown

| Order | Task | Size | Dependencies |
|-------|------|------|-------------|
| 1 | FRN-001 · Boot gate + DOM ID fix | S | None |
| 2 | FRN-002 · `initFirstRun()` — CLI check + mic pre-check | M | FRN-001 |
| 3 | FRN-003 · Mic grant button handler | S | FRN-001 |
| 4 | FRN-004 · `checkFirstRunCompletion()` + IDLE transition | S | FRN-002, FRN-003 |

FRN-002 and FRN-003 can be written simultaneously (no shared writes) but FRN-004 logically depends on both being in place.

---

## 8. Rollback plan

All changes are additive to `index.html`. To rollback:
1. Revert to commit before FRN-001
2. The boot line `setState('IDLE')` is restored
3. The DOM panel still exists but is never shown — no visible regression

---

## 9. Testing strategy

Manual smoke test (no automated tests in v1):

1. **Happy path:** Clear localStorage → launch → FIRST_RUN shown → CLI ✓ → click Grant Access → allow → ✓ → 600ms → IDLE
2. **Return user:** Launch with `firstRunComplete=true` → IDLE directly, no FIRST_RUN
3. **Mic already granted:** Launch with fresh localStorage on a machine with mic pre-granted → both ✓ shown → auto-transition
4. **CLI not found:** (Hard to test locally — can temporarily set `claudePath = null` in main.js) → ✗ shown, install instruction
5. **Mic denied:** (System Settings → revoke → relaunch) → ✗ shown, System Settings instruction
6. **DevTools reset:** Open DevTools → `localStorage.removeItem('firstRunComplete')` → reload → FIRST_RUN shown again

---

## 10. CODEBASE.md sections to update

After feature complete, update:
- **Module-scope variables** — add `cliOk`, `micOk`
- **DOM element IDs** — add `firstrun-mic-status`
- **index.html functions** — add `initFirstRun()`, `checkFirstRunCompletion()`
- **Current state** — update F-FIRST-RUN to complete
