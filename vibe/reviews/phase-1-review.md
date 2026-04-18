# Phase 1 Review — Promptly
> Reviewed: 2026-04-18 | Reviewer: vibe-review skill
> Scope: P1-001 through P1-009 (Foundation — Electron shell, IPC skeleton, PATH resolution)

---

## Automated checks

```
npm run lint → 0 errors, 6 warnings (console.log — expected dev logs, clean before release)
npm audit    → 2 low severity vulnerabilities (no high/critical)
Tests        → No test runner configured (expected for Phase 1 — manual smoke test per ARCHITECTURE.md)
```

All automated checks pass. 0 blocking errors.

---

## Carryover

No previous reviews — this is the first review. No carryover to check.

---

## Architecture drift

**No drift detected.** All Phase 1 code follows ARCHITECTURE.md:

- ✅ `contextIsolation: true`, `nodeIntegration: false` enforced (main.js:22-24)
- ✅ `preload.js` is the only bridge — contextBridge only, no direct node exposure (preload.js:1-22)
- ✅ `claudePath` resolved via `exec('zsh -lc "which claude"')` at startup, cached (main.js:36-44)
- ✅ Module-scope `let win = null` — accessible to shortcut callbacks without closure issues (main.js:11)
- ✅ Constants in SCREAMING_SNAKE_CASE — `SHORTCUT_PRIMARY`, `SHORTCUT_FALLBACK` (main.js:7-8)
- ✅ IPC channel names in kebab-case (main.js:69, 74, 79)
- ✅ Zero runtime dependencies — only devDeps in package.json
- ✅ `will-quit` unregisters globalShortcut cleanly (main.js:87-89)
- ✅ All 6 design tokens defined at `:root` in index.html (index.html:8-15)

---

## Findings

### 🔴 P1-001 — generate-prompt argument mismatch (preload.js:7-8 vs main.js:69)

**File:** `preload.js` line 7-8 and `main.js` line 69

**Evidence:**
```js
// preload.js:7-8 — sends two separate arguments
generatePrompt: (transcript, mode) =>
  ipcRenderer.invoke('generate-prompt', transcript, mode),

// main.js:69 — destructures first argument as an object
ipcMain.handle('generate-prompt', (_event, { transcript, mode }) => {
```

**What happens:** `ipcRenderer.invoke('generate-prompt', transcript, mode)` passes transcript as the 2nd argument to the handler (after `_event`) and mode as the 3rd. The handler at line 69 destructures the 2nd argument as `{ transcript, mode }` — but the 2nd argument is a raw string (transcript), not an object. Result: both `transcript` and `mode` will be `undefined` in the handler when F-CLAUDE calls this.

**Fix:** Change preload.js to send a single object:
```js
generatePrompt: (transcript, mode) =>
  ipcRenderer.invoke('generate-prompt', { transcript, mode }),
```
This aligns with SPEC IPC table payload `{ transcript, mode }` and matches the main.js handler destructuring.

**Impact:** Will break F-CLAUDE integration in Phase 2 if not fixed first.

---

### 🔴 P1-002 — check-claude-path return shape missing `found` field (main.js:79-83)

**File:** `main.js` lines 79-83

**Evidence:**
```js
// main.js:79-83 (current stub)
ipcMain.handle('check-claude-path', () => {
  if (claudePath) {
    return { path: claudePath };      // ← missing `found: true`
  }
  return { error: 'Claude CLI not found.' }; // ← missing `found: false`
});
```

**SPEC says:** `check-claude-path` returns `{ found, path, error }` (SPEC.md IPC surface, PLAN.md IPC table).

**Impact:** F-FIRST-RUN checks `result.found` to determine CLI status. With the current return shape, `result.found` is `undefined` (falsy) even on success — the first-run screen will always think Claude CLI is missing.

**Fix:**
```js
ipcMain.handle('check-claude-path', () => {
  if (claudePath) {
    return { found: true, path: claudePath };
  }
  return { found: false, error: 'Claude CLI not found.' };
});
```

---

### 🔴 P1-003 — Window not positioned (main.js:13-29)

**File:** `main.js` lines 13-29

**Evidence:**
```js
function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 80,
    // no x, y coordinates
    frame: false,
    ...
  });
```

**SPEC F1 acceptance criteria:** "Window opens centred horizontally near bottom of screen"

**Impact:** Electron's default places the window centred on screen (both horizontally and vertically). SPEC requires it near the bottom. This misses the spec'd UX behaviour for Phase 1.

**Fix:** Add positioning in createWindow():
```js
const { screen } = require('electron'); // add to imports
// inside createWindow():
const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
const windowWidth = 480;
const windowHeight = 80;
win = new BrowserWindow({
  width: windowWidth,
  height: windowHeight,
  x: Math.round((screenWidth - windowWidth) / 2),
  y: Math.round(screenHeight * 0.85),
  ...
});
```

---

### 🟡 P2-001 — copy-to-clipboard payload and return diverge from SPEC (preload.js:10-11, main.js:74-77)

**SPEC says:** payload `{ text }`, return `{ success }` (SPEC.md IPC surface, PLAN.md IPC table)

**Current:** preload sends raw string, main receives raw string, returns `{ ok: true }`.

**Consistent within implementation** (preload and main agree), but diverges from spec contract. F-ACTIONS will need to match actual implementation.

**Fix:** Either update spec (raw string is simpler) or align to spec. Recommend updating to match spec for consistency across features.

---

### 🟡 P2-002 — shortcut-conflict IPC sends no payload (main.js:61)

**SPEC says:** `shortcut-conflict` payload `{ fallback }` — the fallback shortcut string.

**Current:** `win.webContents.send('shortcut-conflict')` — no second argument.

**Impact:** Renderer can't display "using ⌃`" if it doesn't know the fallback shortcut name.

**Fix:**
```js
win.webContents.send('shortcut-conflict', { fallback: SHORTCUT_FALLBACK });
```

---

### 🟡 P2-003 — index.html excluded from lint without DECISIONS.md entry

`npm run lint` was changed from `eslint main.js preload.js index.html` to `eslint main.js preload.js` to avoid ESLint HTML parsing errors. The change is pragmatic and correct (ESLint 9 cannot parse HTML without a plugin), but no DECISIONS.md entry was made.

**Fix:** Add entry to DECISIONS.md.

---

## Strengths

- **Security posture is excellent** — contextIsolation, nodeIntegration false, no secrets, no innerHTML risk in skeleton (main.js:21-24, preload.js:5)
- **PATH resolution is correct and critical** — login shell approach is exactly right for macOS CLI apps; failure path handled cleanly (main.js:36-44)
- **Shortcut conflict flow is well-designed** — `did-finish-load` guard prevents race condition where renderer isn't ready to receive the conflict event (main.js:60-62)
- **SCREAMING_SNAKE_CASE constants** — shortcut values in constants, not magic strings scattered through code (main.js:7-8)
- **`will-quit` cleanup** — globalShortcut.unregisterAll() is the right place, not window-all-closed (main.js:87-89)
- **index.html design tokens** — all 6 tokens defined correctly at :root, ready for Phase 2 features to consume (index.html:8-15)
- **entitlements.plist** — complete set of hardened runtime entitlements including JIT and library validation flags required for Electron (entitlements.plist:5-13)

---

## Quality score

| Category | Score |
|----------|-------|
| Start | 10.0 |
| P1 findings (3 × −0.5) | −1.5 |
| P2 findings (3 × −0.2) | −0.6 |
| Architecture drift | 0 |
| **Total** | **7.9 / 10** |

**Grade: B** — Solid foundation, correct security posture and architecture. Three IPC contract bugs must be fixed before Phase 2 subagents read these files and copy wrong patterns.

---

## Summary

Phase 1 built the correct Electron shell. Architecture compliance is clean. The P1 findings are all IPC contract mismatches between preload.js, main.js, and the SPEC — not security or structural issues. They must be fixed now because Phase 2 subagents will read main.js stubs as reference for the real implementations.

P1-001 (generate-prompt arg mismatch) is the most critical — it will silently pass undefined to the F-CLAUDE handler if not fixed.

No P0 findings. Gate passes after P1 fixes are applied.
