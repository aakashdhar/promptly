# FEATURE_TASKS.md — Quick Copy from Menu Bar (FEATURE-018)
> Folder: vibe/features/2026-04-24-quick-copy/
> Added: 2026-04-24

> **Estimated effort:** 5 tasks — S: 5 (<2hrs each) — approx. 2 hours total

---

### QCPY-001 · main.js — lastGeneratedPrompt + set-last-prompt IPC + buildTrayMenu + wire right-click
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria
- **Dependencies**: None
- **Touches**: `main.js`

**What to do**:
1. Add `let lastGeneratedPrompt = null;` after the `let currentIconState = 'idle';` line (around line 184)
2. Add `buildTrayMenu()` function after `updateTrayMenu()` — builds a `Menu.buildFromTemplate` array that:
   - Conditionally prepends "Copy last prompt" item + separator when `lastGeneratedPrompt` is truthy
   - Click handler: `clipboard.writeText(lastGeneratedPrompt)` → `updateMenuBarIcon('ready')` → `setTimeout(1200ms)` → revert to prior `currentIconState` (guard with `isDestroyed()`)
   - Then the standard items: Show/Hide Promptly, separator, Path configuration..., separator, Uninstall Promptly..., separator, Quit Promptly
   - Quit click: `isQuitting = true; app.removeAllListeners('window-all-closed'); app.quit()`
3. Add `ipcMain.handle('set-last-prompt', (_event, prompt) => { lastGeneratedPrompt = prompt || null; });` inside `app.whenReady()`, near other ipcMain.handle blocks
4. Update `createMenuBarIcon` right-click handler: replace the entire inline menu build with `menuBarTray.popUpContextMenu(buildTrayMenu())`

**Acceptance criteria**:
- [ ] `lastGeneratedPrompt` var declared at module scope
- [ ] `set-last-prompt` IPC handler registered — stores the prompt string
- [ ] `buildTrayMenu()` returns a Menu with "Copy last prompt" at top when `lastGeneratedPrompt` truthy, absent otherwise
- [ ] Copy click writes to clipboard, flashes green dot ~1200ms, reverts to previous icon state
- [ ] `createMenuBarIcon` right-click calls `buildTrayMenu()` instead of inline menu

**Self-verify**: Right-click before any generation → no "Copy last prompt". Generate a prompt → right-click → item appears at top.
**Test requirement**: Manual smoke test (no automated test for Electron tray menus).
**⚠️ Boundaries**: Do not open win on copy. Do not mutate originalTranscript. Do not touch preload.js yet.
**CODEBASE.md update?**: Yes — after QCPY-002 (done together in QCPY-005).
**Architecture compliance**: clipboard already imported. currentIconState already tracked. buildTrayMenu() is a pure menu builder — no side effects beyond the copy click.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### QCPY-002 · main.js — update updateTrayMenu() to use buildTrayMenu()
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (last bullet)
- **Dependencies**: QCPY-001
- **Touches**: `main.js`

**What to do**:
Replace the inline `Menu.buildFromTemplate([...])` inside `updateTrayMenu()` with `buildTrayMenu()`:
```js
function updateTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
}
```
Also remove the `tray.on('click', ...)` call from inside `updateTrayMenu()` — it should not re-register the click handler on every call (causes listener accumulation). The click handler belongs only in `createTray()` setup if tray were ever used.

**Acceptance criteria**:
- [ ] `updateTrayMenu()` uses `buildTrayMenu()` — no duplicate menu template
- [ ] No `tray.on('click')` registration inside `updateTrayMenu()`
- [ ] `npm run lint` passes — 0 errors

**Self-verify**: Search for any remaining inline menu template in updateTrayMenu — should be empty.
**Test requirement**: Lint clean.
**⚠️ Boundaries**: `tray` is null — `updateTrayMenu()` early-returns immediately. This change is for code hygiene + forward compatibility only.
**CODEBASE.md update?**: No structural change (updateTrayMenu already documented).
**Architecture compliance**: DRY — both tray paths use the same builder.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### QCPY-003 · preload.js — expose setLastPrompt via contextBridge
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#5-integration-points
- **Dependencies**: QCPY-001
- **Touches**: `preload.js`

**What to do**:
Add to the `contextBridge.exposeInMainWorld('electronAPI', { ... })` object:
```js
setLastPrompt: (prompt) => ipcRenderer.invoke('set-last-prompt', prompt),
```
Place it near other similar fire-and-forget methods (e.g., after `updateMenuBarState`).

**Acceptance criteria**:
- [ ] `window.electronAPI.setLastPrompt` callable from renderer
- [ ] Invokes `set-last-prompt` IPC channel
- [ ] `npm run lint` passes — 0 errors

**Self-verify**: Check that `setLastPrompt` appears in the contextBridge object and is not duplicated.
**Test requirement**: Lint clean.
**⚠️ Boundaries**: Do not change any existing contextBridge methods. Do not use `ipcRenderer.send` — use `invoke` (matches the ipcMain.handle pattern).
**CODEBASE.md update?**: Yes — in QCPY-005.
**Architecture compliance**: Follows established contextBridge pattern. Renderer never calls ipcRenderer directly.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### QCPY-004 · App.jsx — call setLastPrompt in handleGenerateResult
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#5-integration-points
- **Dependencies**: QCPY-003
- **Touches**: `src/renderer/App.jsx`

**What to do**:
In `handleGenerateResult` useCallback, find the branch where `prompt` is truthy and `setGeneratedPrompt(prompt)` is called. Immediately after that call, add:
```js
window.electronAPI?.setLastPrompt?.(prompt);
```
This covers all modes (standard, polish, iteration) since `handleGenerateResult` is the unified result handler.

Note: for polish mode, `handleGenerateResult` receives the raw output — `parsePolishOutput` runs inside `usePolishMode`. The `prompt` argument to `handleGenerateResult` is the raw Claude output in polish mode. The `setLastPrompt` call should fire with whatever prompt is being stored, which is the raw output (same as what's stored in history). This is acceptable — the "last prompt" in the tray menu refers to the last generated content.

**Acceptance criteria**:
- [ ] `window.electronAPI?.setLastPrompt?.(prompt)` called after every successful `setGeneratedPrompt(prompt)` in `handleGenerateResult`
- [ ] Optional chaining ensures no crash if electronAPI not available (e.g., in test environments)
- [ ] `npm run build:renderer` succeeds
- [ ] Lint passes

**Self-verify**: Add a log temporarily if needed to verify IPC fires. Remove before commit.
**Test requirement**: `npm run build:renderer` succeeds. Manual smoke test (QCPY-004 complete → run full smoke checklist).
**⚠️ Boundaries**: Do not modify the polish flow's `parsePolishOutput` call. Do not add setLastPrompt elsewhere. Do not mutate `originalTranscript`.
**CODEBASE.md update?**: No — `handleGenerateResult` already documented; the new call is a minor addition.
**Architecture compliance**: Follows established `window.electronAPI?.method?.()` optional chain pattern used throughout App.jsx.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### QCPY-005 · Docs — CODEBASE.md, DECISIONS.md, TASKS.md
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#10-conformance-checklist
- **Dependencies**: QCPY-001, QCPY-002, QCPY-003, QCPY-004
- **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`, `CLAUDE.md`

**What to do**:
1. **CODEBASE.md** — Module-scope variables table: add `lastGeneratedPrompt` row. IPC channels table: add `set-last-prompt` row. preload.js row: add `setLastPrompt` to the exposed methods list.
2. **DECISIONS.md** — Append `D-FEATURE-018` entry: feature-start block + `buildTrayMenu()` tech-choice decision (DRY menu builder instead of duplicate inline templates).
3. **TASKS.md** — Add FEATURE-018 entry with all tasks ticked.
4. **CLAUDE.md** — The active feature section was added at the start; verify it is present and accurate. No removal needed — feature just completed.

**Acceptance criteria**:
- [ ] CODEBASE.md `lastGeneratedPrompt` row present in module-scope vars table
- [ ] CODEBASE.md `set-last-prompt` IPC channel row present
- [ ] CODEBASE.md preload.js row updated with `setLastPrompt`
- [ ] DECISIONS.md D-FEATURE-018 entry appended
- [ ] TASKS.md shows FEATURE-018 complete (all 5 tasks ticked)

**Self-verify**: Re-read CODEBASE.md module vars and IPC sections to confirm entries exist.
**Test requirement**: None (docs only).
**⚠️ Boundaries**: CODEBASE.md — add rows, do not reorganise existing table. DECISIONS.md — append only, never delete.
**CODEBASE.md update?**: Yes — this IS the CODEBASE.md update task.
**Architecture compliance**: CODEBASE.md update rule: "After every task that adds or modifies a file: update CODEBASE.md."

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: Quick Copy from Menu Bar (FEATURE-018)
> Tick after every task. All items ✅ before feature is shippable.
- [ ] "Copy last prompt" appears only when `lastGeneratedPrompt` is truthy
- [ ] Clipboard write confirmed via paste after copy
- [ ] No window opens on copy
- [ ] Green dot flash lasts ~1200ms then reverts to previous icon state
- [ ] `set-last-prompt` IPC registered and receives prompt on every PROMPT_READY
- [ ] `setLastPrompt` exposed in contextBridge
- [ ] App.jsx calls `setLastPrompt` in `handleGenerateResult` after successful generation
- [ ] `npm run lint` passes — 0 errors
- [ ] `npm run build:renderer` succeeds
- [ ] CODEBASE.md updated
- [ ] DECISIONS.md FEATURE-018 entry appended
- [ ] TASKS.md updated
