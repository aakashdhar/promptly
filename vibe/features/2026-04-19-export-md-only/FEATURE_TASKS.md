# FEATURE_TASKS.md — FEATURE-008: Export Simplification

> **Estimated effort:** 2 tasks — S: 2 — approx. 1 hour total

---

### EXPS-001 · Simplify export — delete ExportPanel, direct .md export
- **Status**: `[x]`
- **Size**: S
- **Dependencies**: None
- **Touches**: `src/renderer/components/PromptReadyState.jsx`, `src/renderer/components/ExportPanel.jsx` (delete)

**What to do**:

1. **Delete** `src/renderer/components/ExportPanel.jsx`

2. **In PromptReadyState.jsx** — make these changes:
   - Remove `import ExportPanel from './ExportPanel.jsx'`
   - Remove `const [showExport, setShowExport] = useState(false)`
   - Add `handleExport` async function:
     ```js
     async function handleExport() {
       const content = `# Generated Prompt\n\n${generatedPrompt}\n\n---\n\n**You said:** ${originalTranscript}\n\n**Mode:** ${mode}\n\n**Generated:** ${new Date().toISOString()}`
       const filename = `prompt-${Date.now()}.md`
       if (window.electronAPI) await window.electronAPI.saveFile({ content, filename, format: 'md' })
     }
     ```
   - Remove the `useEffect` that watches `showExport` for window resize
   - Change the export-prompt event listener to call `handleExport()` directly (not toggle)
   - In the top row: change Export button `onClick` to `handleExport`; remove the `showExport` active color style (just use the same dimmed style as Regenerate/Reset)
   - Remove the `{showExport && <ExportPanel ... />}` render
   - Remove the `↓ Export` button from the button row entirely

**Acceptance criteria**:
- [ ] ExportPanel.jsx no longer exists
- [ ] Export button in top row calls handleExport directly
- [ ] No showExport state anywhere
- [ ] No ↓ Export button in button row
- [ ] No ExportPanel render
- [ ] handleExport builds .md content and calls saveFile
- [ ] export-prompt listener calls handleExport (not toggle)
- [ ] Build passes

**Self-verify**: Run `npm run build:renderer` — 0 errors. Check button row has only Edit + Copy prompt.
**Test requirement**: Manual — click Export, verify save dialog opens immediately with .md default
**⚠️ Boundaries**: Do not touch main.js, preload.js, App.jsx, or any other component
**CODEBASE.md update?**: Yes — in EXPS-002

---

### EXPS-002 · Docs: CODEBASE.md + DECISIONS.md
- **Status**: `[x]`
- **Size**: S
- **Dependencies**: EXPS-001

**What to do**:

1. **CODEBASE.md** — remove ExportPanel.jsx row from file map; update PromptReadyState row to reflect simplified export
2. **DECISIONS.md** — append FEATURE-008 entry

**Acceptance criteria**:
- [ ] ExportPanel.jsx removed from CODEBASE.md file map
- [ ] PromptReadyState row updated
- [ ] DECISIONS.md has FEATURE-008 entry

---

#### Conformance: FEATURE-008 Export Simplification
- [ ] ExportPanel.jsx deleted
- [ ] ↓ Export button removed from button row
- [ ] Export button opens save dialog directly
- [ ] ⌘E triggers direct export
- [ ] Window stays at 560px
- [ ] Lint passes
- [ ] CODEBASE.md updated
