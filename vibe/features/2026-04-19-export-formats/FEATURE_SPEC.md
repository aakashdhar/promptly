# FEATURE_SPEC.md — FEATURE-007: Export Formats

> Feature folder: vibe/features/2026-04-19-export-formats/
> Added: 2026-04-19 | Status: planning

---

## 1. Feature overview

Add export capability to the PROMPT_READY state. Users can save the generated prompt (plus transcript and mode metadata) as a file in one of three formats: plain text (.txt), Markdown (.md), or JSON (.json). The export panel slides in below the prompt area when the user clicks Export or presses ⌘E, and a macOS save dialog handles file placement.

---

## 2. User stories

- As a user in PROMPT_READY, I want to save my generated prompt to a file so I can reference it later or share it.
- As a user, I want to choose between text, Markdown, and JSON so the file fits my downstream workflow.
- As a keyboard user, I want ⌘E to open the export panel without reaching for the mouse.

---

## 3. Acceptance criteria

- [ ] An "Export" text button appears in the top row of PROMPT_READY alongside Regenerate and Reset
- [ ] Clicking Export toggles a format picker panel (open/close)
- [ ] Format picker shows three tiles: Text (.txt), Markdown (.md), JSON (.json)
- [ ] The selected format tile highlights in blue; unselected tiles are dimmed
- [ ] A "↓ Export" button in the bottom button row opens the macOS save dialog
- [ ] The save dialog uses the correct default filename: `prompt-{timestamp}.{ext}`
- [ ] Files are written to disk correctly in all three formats
- [ ] Text format: `PROMPT\n\n{prompt}\n\nYOU SAID\n\n{transcript}\n\nMODE: {mode}`
- [ ] Markdown format: sections with `#`, `---`, `**You said:**`, `**Mode:**`, `**Generated:**` timestamp
- [ ] JSON format: valid JSON object with keys `prompt`, `transcript`, `mode`, `timestamp`
- [ ] ⌘E keyboard shortcut opens the export panel when in PROMPT_READY state
- [ ] Window height increases by 90px when export panel opens; decreases when closed
- [ ] If save dialog is cancelled, nothing happens (no error, panel stays open)
- [ ] Export panel closes automatically after a successful save (onExportDone callback)

---

## 4. Scope boundaries

**Included:**
- ExportPanel component (format picker + format content builder)
- save-file IPC channel (main.js + preload.js)
- PromptReadyState integration (Export toggle button, panel render, ↓ Export button)
- Window resize on panel open/close
- ⌘E shortcut via existing App.jsx keydown listener (already stubbed — dispatches `export-prompt` custom event)

**Explicitly deferred:**
- Drag-to-export (future)
- Export history / recent exports (future)
- Custom file naming templates (future)
- Share sheet / email / AirDrop (future)
- Auto-export on copy (future)

---

## 5. Integration points

| File | Change |
|------|--------|
| `src/renderer/components/ExportPanel.jsx` | New component |
| `src/renderer/components/PromptReadyState.jsx` | Import ExportPanel, add showExport state, Export toggle, panel render, ↓ Export button, window resize effect |
| `main.js` | Add `save-file` ipcMain.handle — dialog.showSaveDialog + fs.writeFileSync |
| `preload.js` | Add `saveFile: (opts) => ipcRenderer.invoke('save-file', opts)` |
| `src/renderer/App.jsx` | ⌘E already dispatches `export-prompt` custom event — PromptReadyState listens for it |

`dialog` is already imported in electron; `fs` is already required in main.js.

---

## 6. New data model changes

None. Export is a read-only operation on existing state (`generatedPrompt`, `originalTranscript`, `mode`).

---

## 7. New IPC channels

| Channel | Direction | Payload | Returns |
|---------|-----------|---------|---------|
| `save-file` | renderer → main | `{ content: string, filename: string, format: string }` | `{ ok: boolean, filePath?: string }` |

---

## 8. Edge cases and error states

| Case | Handling |
|------|----------|
| User cancels save dialog | Returns `{ ok: false }` — panel stays open, no error shown |
| fs.writeFileSync fails (permissions, disk full) | Catch + return `{ ok: false, error }` — future: show error toast |
| Export panel open when Regenerate runs | showExport resets to false on onReset / onRegenerate |
| ⌘E pressed while export panel already open | Closes panel (toggle behaviour) |
| Window height mismatch on rapid open/close | useEffect debounce not needed — Electron setSize is idempotent |

---

## 9. Non-functional requirements

- No new npm packages — `dialog` and `fs` already available via Electron
- `save-file` IPC handler must validate that `filePath` is a real path before writing
- Content passed to `fs.writeFileSync` is app-generated (not user-provided HTML) — safe to write as-is
- Window resize via existing `resizeWindow` IPC — no new channel needed

---

## 10. Conformance checklist

- [ ] ExportPanel.jsx renders three format tiles; selected tile highlights in blue
- [ ] Clicking ↓ Export triggers macOS save dialog with correct defaultPath
- [ ] File written correctly in all three formats
- [ ] ⌘E opens export panel in PROMPT_READY
- [ ] Window expands +90px on open, returns to 560px on close
- [ ] Cancelled save: no error, panel stays open
- [ ] Successful save: panel auto-closes
- [ ] No new runtime npm dependencies
- [ ] Lint passes
- [ ] CODEBASE.md updated
