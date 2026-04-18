# FEATURE_SPEC.md — F-FIRST-RUN
> Feature: First-run setup checklist
> Folder: vibe/features/2026-04-18-first-run/
> Created: 2026-04-18 | Needs: F-STATE complete ✅

---

## 1. Feature overview

On the very first launch of Promptly, a two-item checklist screen guides the user through the two prerequisites needed before the app is usable: Claude CLI must be installed and resolvable, and microphone access must be granted. Once both are satisfied, the app transitions automatically to IDLE and never shows the checklist again.

This feature gates the IDLE boot path on `getFirstRunComplete()` and wires up the already-stubbed `#state-first-run` panel with real logic.

---

## 2. User stories

- **As a first-time user**, I see a clear checklist on launch so I know exactly what's needed before I can use the app.
- **As a user with Claude already installed**, I see a green check for CLI immediately on load.
- **As a user who hasn't granted mic access**, I see a "Grant Access" button that triggers the macOS permission dialog.
- **As a returning user**, I go straight to IDLE — the checklist never appears again.

---

## 3. Acceptance criteria

- [ ] On first launch (`firstRunComplete` not set), app boots into FIRST_RUN state (not IDLE)
- [ ] `checkClaudePath()` IPC called at FIRST_RUN init; CLI row shows ✓ (green) if found
- [ ] If CLI not found: CLI row shows ✗ (red) and label updates to "Install: npm i -g @anthropic-ai/claude-code"
- [ ] Mic row shows "Grant Access" button by default
- [ ] If mic permission already granted (via `navigator.permissions.query`): button hidden, ✓ shown immediately
- [ ] If mic permission already denied: ✗ shown, label updates to "Enable in System Settings → Privacy"
- [ ] Clicking "Grant Access" calls `getUserMedia({ audio: true })`
- [ ] On mic grant success: ✓ shown, button hidden
- [ ] On mic grant error: ✗ shown, label updated to "Enable in System Settings → Privacy"
- [ ] When `cliOk && micOk`: `setFirstRunComplete(true)` called, then `setState('IDLE')` after 600ms delay
- [ ] On subsequent launches (`firstRunComplete === 'true'`): boots directly to IDLE, no checks run
- [ ] All status symbols use `textContent` (never `innerHTML`)
- [ ] No new IPC channels added

---

## 4. Scope boundaries

**Included:**
- Boot gate: `getFirstRunComplete()` check → route to FIRST_RUN or IDLE
- CLI check via existing `checkClaudePath()` IPC
- Mic permission check via `navigator.permissions.query`
- Mic permission grant via `navigator.mediaDevices.getUserMedia`
- Auto-transition to IDLE when both checks pass
- `setFirstRunComplete(true)` persistence

**Explicitly deferred:**
- Re-checking CLI on every launch (firstRunComplete bypasses all checks — correct per spec)
- Retry button for CLI install (user must restart app after installing)
- "Open System Settings" button (just shows text instruction in v1)
- Any animation between checklist and IDLE (600ms delay is the only transition)
- Onboarding copy beyond the two checklist rows (no welcome text, no version display)

---

## 5. Integration points

**Reads:**
- `getFirstRunComplete()` — localStorage wrapper, already implemented (index.html)
- `window.electronAPI.checkClaudePath()` — preload.js, calls `check-claude-path` IPC
- `navigator.permissions.query` / `navigator.mediaDevices.getUserMedia` — Web API

**Writes:**
- `setFirstRunComplete(true)` — localStorage wrapper, already implemented (index.html)
- `currentState` via `setState('FIRST_RUN')` / `setState('IDLE')` — state machine

**DOM elements used:**
- `#state-first-run` — panel shown/hidden by setState (already wired)
- `#firstrun-cli-status` — status symbol for CLI (already in DOM, no ID change)
- `#firstrun-cli-label` — CLI row label text (needs ID added — currently anonymous span)
- `#firstrun-mic-status` — status symbol for mic (needs ID added — currently anonymous span)
- `#firstrun-mic-label` — mic row label text (needs ID added — currently anonymous span)
- `#firstrun-mic-btn` — Grant Access button (already in DOM)

**Spec refs:** SPEC.md#f8, SPEC.md#data-model (firstRunComplete), SPEC.md#ipc-surface

---

## 6. New data model changes

No new localStorage keys. `firstRunComplete` is already defined in SPEC.md data model and the wrapper functions are already implemented.

**New module-scope variables in index.html:**
```js
let cliOk = false;
let micOk = false;
```

---

## 7. New API endpoints

None. No new IPC channels. `check-claude-path` is already registered in main.js.

---

## 8. Edge cases and error states

| Scenario | Behaviour |
|----------|-----------|
| Claude CLI not installed | ✗ red in CLI row, label → install command; completion blocked |
| Mic already granted | ✓ shown immediately, button hidden; completion may trigger instantly |
| Mic denied at system level | ✗ red, label → System Settings instruction; completion blocked |
| getUserMedia throws | ✗ red, label → System Settings instruction |
| Both checks already pass on first run | Auto-transition after 600ms, no user action needed |
| `navigator.permissions` not supported | Fall through to 'prompt' case — show button (fail-safe) |
| `window.electronAPI.checkClaudePath` unavailable | Treat as CLI not found; log error |
| User quits app during FIRST_RUN | `firstRunComplete` stays false → FIRST_RUN shown again on next launch (correct) |
| CLI status briefly empty on init | `#firstrun-cli-status` initialised to `○` in DOM; overwritten after IPC resolves |

---

## 9. Non-functional requirements

- No new runtime npm dependencies
- All text set via `textContent` — never `innerHTML`
- Status symbols (✓, ✗, ○) are plain Unicode — no icon fonts
- The 600ms completion delay lets user see both green checks before transition (per UX polish)
- `navigator.permissions.query` is async — both checks (CLI + mic) should resolve before calling `checkFirstRunCompletion()`

---

## 10. Conformance checklist

What must be true before this feature is shippable:

- [ ] First launch shows FIRST_RUN state, not IDLE
- [ ] CLI check reflects actual `claudePath` resolution result
- [ ] Mic grant button triggers macOS permission dialog
- [ ] Both checks pass → auto-transition to IDLE within 600ms
- [ ] Subsequent launches skip directly to IDLE
- [ ] No new IPC channels
- [ ] No `innerHTML` with dynamic content
- [ ] No `localStorage.*` direct access (only wrapper functions)
- [ ] Lint passes (`npm run lint`)
- [ ] CODEBASE.md updated: `cliOk`, `micOk`, `initFirstRun()`, `checkFirstRunCompletion()`, `firstrun-mic-status`

---

## UI Specification

### Layout (FIRST_RUN state — 120px height already in STATE_HEIGHTS)

```
┌─────────────────────────────────────────────────┐
│  ✓  Claude CLI installed                        │
│  ○  Microphone access granted    [Grant Access] │
└─────────────────────────────────────────────────┘
```

Error states:
```
┌─────────────────────────────────────────────────┐
│  ✗  Install: npm i -g @anthropic-ai/claude-code │
│  ✗  Enable in System Settings → Privacy         │
└─────────────────────────────────────────────────┘
```

### CSS additions (using existing tokens)
```css
.status-ok    { color: var(--color-success); }
.status-error { color: var(--color-recording); }
```

### Symbols
- Pending: `○` (neutral, no class)
- OK: `✓` + `.status-ok` class
- Error: `✗` + `.status-error` class

### "Grant Access" button
- Uses existing `.btn-action` class — no new styles needed
- Hidden via `.hidden = true` (not via CSS class) once mic is resolved
