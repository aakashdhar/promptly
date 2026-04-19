# FEATURE_SPEC.md — FEATURE-008: Export Simplification (Markdown only)

> Feature folder: vibe/features/2026-04-19-export-md-only/
> Added: 2026-04-19 | Replaces: FEATURE-007 export panel UI

---

## 1. Feature overview

Simplify the export flow: remove the format picker panel (ExportPanel.jsx), remove the ↓ Export button from the button row, and make the "Export" text button in the top row a single-click direct export to .md. No panel, no format selection, no extra UI. Clicking Export immediately opens the macOS save dialog with .md as the only format.

---

## 2. User stories

- As a user in PROMPT_READY, I want to click Export and immediately get a save dialog — no extra steps.

---

## 3. Acceptance criteria

- [ ] "Export" button appears in top row alongside Regenerate and Reset (unchanged position)
- [ ] Clicking Export immediately opens macOS save dialog with default filename `prompt-{timestamp}.md`
- [ ] Save dialog has only Markdown filter `{ name: 'Markdown', extensions: ['md'] }`
- [ ] File is saved as Markdown with the same format as before: `# Generated Prompt`, `**You said:**`, `**Mode:**`, `**Generated:**` timestamp
- [ ] No format picker panel (ExportPanel.jsx deleted)
- [ ] No ↓ Export button in the Edit / Copy button row
- [ ] ⌘E directly exports (no toggle — calls handleExport immediately)
- [ ] Window height stays at 560px always — no expand/contract on export
- [ ] "Export" button in top row does NOT have active/highlighted state (no showExport state)
- [ ] Cancelled save: nothing happens, no error

---

## 4. Scope boundaries

**Included:**
- Delete `ExportPanel.jsx`
- Simplify `PromptReadyState.jsx` — remove showExport state, remove panel render, remove ↓ Export button, remove resize useEffect, make Export direct-export
- Update `main.js` save-file filters to Markdown only (optional — leaving all three is harmless, but clean to simplify)
- Update CODEBASE.md, DECISIONS.md

**Explicitly NOT changed:**
- `save-file` IPC handler in main.js — keep (still needed)
- `saveFile` in preload.js — keep (still needed)
- Copy, Edit, Regenerate, Reset flows — untouched

---

## 5. Integration points

| File | Change |
|------|--------|
| `src/renderer/components/ExportPanel.jsx` | Delete |
| `src/renderer/components/PromptReadyState.jsx` | Remove import, showExport state, resize useEffect, ExportPanel render, ↓ Export button; add inline handleExport(); update export-prompt listener to call handleExport directly |
| `main.js` | Optional: simplify save-file dialog filters to Markdown only |

---

## 6. Conformance checklist

- [ ] ExportPanel.jsx deleted
- [ ] ↓ Export button removed from button row
- [ ] Export button in top row opens save dialog directly (no panel)
- [ ] Saved file is valid Markdown
- [ ] ⌘E triggers direct export
- [ ] Window height fixed at 560px
- [ ] Lint passes
- [ ] CODEBASE.md updated
