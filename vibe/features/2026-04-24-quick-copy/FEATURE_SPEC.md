# FEATURE_SPEC.md — Quick Copy from Menu Bar (FEATURE-018)
> Folder: vibe/features/2026-04-24-quick-copy/
> Added: 2026-04-24

---

## 1. Feature overview

Users must currently open the Promptly bar to copy the last generated prompt. This interrupts workflow — especially when Promptly has been dismissed after a PROMPT_READY state and the user realises they need the prompt again. Quick Copy adds a "Copy last prompt" item to the menubar icon's right-click context menu so the user can grab the last prompt silently, without the bar ever opening.

---

## 2. User stories

- **As a user who just dismissed Promptly**, I want to right-click the menu bar icon and copy the last prompt without reopening the bar, so I can stay in my current app.
- **As a new user with no generated prompt**, I want the menu item to be absent or greyed out so the menu is clean and intentional.

---

## 3. Acceptance criteria

- [ ] "Copy last prompt" appears in the menubar right-click context menu when a prompt exists
- [ ] Clicking "Copy last prompt" writes the prompt to the clipboard — no window opens, no state change in the renderer
- [ ] "Copy last prompt" is absent from the menu when no prompt has been generated yet
- [ ] After copying, the menubar icon briefly shows the green "ready" dot for ~1200ms, then reverts to the previous icon state
- [ ] `lastGeneratedPrompt` is stored in main process memory — updated via `set-last-prompt` IPC every time PROMPT_READY is reached
- [ ] Works from the `menuBarTray` right-click menu (the active Tray instance)
- [ ] The `updateTrayMenu()` function is also updated for forward compatibility (though `tray` is currently null)

---

## 4. Scope boundaries

**Included:**
- `set-last-prompt` IPC handler (renderer → main, stores prompt string)
- "Copy last prompt" item in `menuBarTray` right-click menu
- Green dot flash on copy (1200ms, then revert)
- `setLastPrompt` exposed via contextBridge in preload.js
- Call to `setLastPrompt` in App.jsx after every successful prompt generation

**Explicitly deferred / out of scope:**
- Keyboard shortcut for quick copy (separate feature if needed)
- Storing the prompt across app restarts (session-memory only)
- Notification or toast in the renderer on copy success
- Showing a preview of the prompt text in the menu

---

## 5. Integration points

- `main.js` — `lastGeneratedPrompt` module var, `set-last-prompt` IPC handler, `createMenuBarIcon()` right-click rebuild, `updateTrayMenu()` update
- `preload.js` — `setLastPrompt` contextBridge exposure
- `src/renderer/App.jsx` — `handleGenerateResult()` calls `setLastPrompt` after every successful generation
- IPC channels: `set-last-prompt` (new, renderer → main)

---

## 6. New data model changes

None. `lastGeneratedPrompt` is a module-scope `let` variable in main.js — session memory only, not persisted.

---

## 7. New API / IPC endpoints

| Channel | Direction | Payload | Returns |
|---------|-----------|---------|---------|
| `set-last-prompt` | renderer → main | `prompt` (string) | void (fire-and-forget via invoke) |

---

## 8. Edge cases and error states

- **No prompt yet** — menu item absent; clipboard write never called
- **Empty string prompt** — treat as no prompt (falsy check)
- **menuBarTray destroyed** — guard with `isDestroyed()` before any tray access
- **win destroyed** — copy does not require win; guard only in show/hide item
- **Very long prompt** — `clipboard.writeText` handles any string length; no truncation

---

## 9. Non-functional requirements

- No window open or focus steal on copy
- Green dot flash must not interfere with live recording/thinking pulse — only triggers when `currentIconState` is `idle` or `ready` (i.e., not during active recording/thinking)
- Zero new runtime npm dependencies
- Lint clean before commit

---

## 10. Conformance checklist

- [ ] "Copy last prompt" appears only when `lastGeneratedPrompt` is truthy
- [ ] Clipboard write confirmed via paste after copy
- [ ] No window opens on copy
- [ ] Green dot flash lasts ~1200ms then reverts to previous icon state
- [ ] `set-last-prompt` IPC registered and receives prompt on every PROMPT_READY
- [ ] `setLastPrompt` exposed in contextBridge
- [ ] App.jsx calls `setLastPrompt` in `handleGenerateResult` after successful generation
- [ ] Lint passes — 0 errors
- [ ] CODEBASE.md updated
- [ ] DECISIONS.md FEATURE-018 entry appended
