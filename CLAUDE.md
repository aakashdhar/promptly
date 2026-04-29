# CLAUDE.md — Promptly
> Promptly is a macOS floating bar that records speech and turns it into a structured Claude prompt.
> Electron v31 + Vanilla JS/HTML/CSS — zero build step, zero runtime deps.
> Read this file at the start of every session before touching any code.

---

## Session startup sequence (mandatory — every session)

1. Read `CLAUDE.md` (this file)
2. Read `vibe/CODEBASE.md` — current file map and live patterns
3. Read `vibe/ARCHITECTURE.md` — all decisions measured against this
4. Read `vibe/SPEC_INDEX.md` — compressed spec map
5. Read `vibe/TASKS.md` — current progress and next task

Do not write any code until this sequence is complete.

---

## Project structure

```
promptly/
├── CLAUDE.md              ← this file
├── BRIEF.md               ← problem, users, stack decisions
├── ARCHITECTURE.md        ← (moved to vibe/ARCHITECTURE.md after new:)
├── main.js                ← Electron main: window, IPC, PATH resolution, shortcut
├── preload.js             ← contextBridge only — exposes window.electronAPI
├── index.html             ← entire UI: state machine, waveform, modes, styles
├── package.json           ← Electron + electron-builder config
├── entitlements.plist     ← mic permission for hardened runtime
└── vibe/
    ├── TASKS.md           ← your progress view — open this
    ├── ARCHITECTURE.md    ← locked patterns — agent reads every session
    ├── CODEBASE.md        ← live codebase snapshot — update after every task
    ├── SPEC.md            ← full requirements
    ├── SPEC_INDEX.md      ← compressed spec map
    ├── PLAN.md            ← phases and feature dependency order
    ├── DECISIONS.md       ← append-only drift and change log
    ├── reviews/
    ├── features/
    ├── bugs/
    └── backlog/
```

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Shell | Electron v31+ |
| Frontend | Vanilla HTML + CSS + JS — single index.html |
| Speech | webkitSpeechRecognition |
| Prompt gen | claude -p via child_process |
| IPC | ipcMain + contextBridge preload |
| Storage | localStorage (mode, firstRunComplete) |
| Distribution | electron-builder → universal .dmg |
| Runtime deps | **None** — only electron + electron-builder as devDeps |

---

## Commands

```bash
npm start          # Run in development
npm run dist       # Build universal .dmg
npm run lint       # ESLint check
```

---

## Code style and naming

**JS:** Vanilla JS (ES6+). No TypeScript. No frameworks. No build step.
**Functions:** camelCase — `startRecording()`, `setState()`, `getMode()`
**Constants:** SCREAMING_SNAKE_CASE — `MODES`, `SHORTCUT_PRIMARY`
**State names:** SCREAMING_SNAKE_CASE strings — `'IDLE'`, `'RECORDING'`
**CSS classes:** kebab-case — `.recording-indicator`, `.prompt-output`
**CSS custom properties:** `--kebab-case` — `--color-action`, `--radius-window`
**IPC channels:** kebab-case strings — `'generate-prompt'`, `'copy-to-clipboard'`

**Design tokens (never hardcode outside these):**
```css
--color-action: #007AFF
--color-recording: #FF3B30
--color-success: #34C759
--bg-window: rgba(255,255,255,0.85)
--radius-window: 14px
--radius-inner: 8px
```

---

## Critical architecture rules

1. **PATH resolution** — `claude` binary MUST resolve via `exec('zsh -lc "which claude"')` at startup. Never `exec('claude ...')` directly. Cache result as `claudePath`.
2. **State machine** — All DOM changes go through `setState(newState, payload)`. Never mutate DOM outside setState.
3. **originalTranscript** — Captured once when recording stops. Never mutated. Regenerate always reads this.
4. **localStorage** — Only via `getMode()` / `setMode()` and `getFirstRunComplete()` / `setFirstRunComplete()`. Never `localStorage.*` directly in other code.
5. **contextBridge** — `nodeIntegration: false`, `contextIsolation: true` always. All IPC via `window.electronAPI`.
6. **innerHTML** — Never with user-provided or Claude-generated text. Use `textContent`. HTML only for static structure.
7. **Runtime deps** — Zero. If you think you need an npm package, you don't. Use the Web API or Electron API.

---

## Per-task sequence (runs on every "next")

1. Verify all acceptance criteria in the feature spec are ticked
2. Run manual smoke test: exercise the affected state(s) in the running app
3. Run lint: `npm run lint` — must pass before commit
4. Commit code changes:
   ```
   git add main.js preload.js index.html package.json entitlements.plist
   git commit -m "feat(scope): [TASK-ID] — description"
   ```
5. Commit doc updates separately:
   ```
   git add vibe/TASKS.md vibe/DECISIONS.md vibe/CODEBASE.md
   git commit -m "docs(TASKS): mark [TASK-ID] done — description"
   ```
6. Update "What just happened" and "What's next" in `vibe/TASKS.md`
7. Re-read `vibe/TASKS.md` silently
8. State the next task in plain English and confirm before starting

**Rules:**
- NEVER skip the commit step — uncommitted work is invisible to vibe-graph and vibe-review
- Code commit and doc commit are ALWAYS separate — never mix feat and docs in one commit
- If lint fails — fix before committing, do not commit with lint errors
- If smoke test finds a broken state — fix before committing

---

## Phase gates (mandatory — do not skip)

| Phase | Gate command | Condition |
|-------|-------------|-----------|
| Phase 1 complete | `review: phase 1` | All P1-00x tasks ticked |
| Phase 2 complete | `review: phase 2` | All features shipped, manual smoke passed |
| Final | `review: final` | 0 P0, 0 P1 issues — clear before distributing |

---

## Investigation discipline

For requests under 10 words: restate intent in one sentence before reading any files.
Data/state operations (reset, clear, seed, refresh) are not code bugs — do not investigate code.
Confirm the actual request before opening any file.

---

## CODEBASE.md update rule

After every task that adds or modifies a file: update `vibe/CODEBASE.md` to reflect the change.
If a new function is added to index.html, it belongs in CODEBASE.md.
If a new IPC channel is registered, it belongs in CODEBASE.md.
Never let CODEBASE.md drift more than one task behind.

## Never list (P0 — block commit immediately)

- Adding any runtime npm dependency
- `nodeIntegration: true` anywhere
- `innerHTML` with user-provided or Claude-generated text
- `exec('claude ...')` without the cached `claudePath`
- Storing API keys or tokens in the app
- `localStorage.*` outside the wrapper functions
- Introducing a framework, bundler, or build step
- Mutating `originalTranscript` after recording stops

> Completed feature sections removed 2026-04-27 (P2-008 — full-project review). Full specs remain in their respective `vibe/features/` and `vibe/bugs/` folders.

---
### Active Feature: FEATURE-IMAGE-BUILDER
> Folder: vibe/features/2026-04-27-image-builder/ | Added: 2026-04-27

**Feature summary**: New "Image" mode — guided tier-based interview after speech → Claude assembles natural language image prompt for Nano Banana / ChatGPT image gen.
**Files in scope**: src/renderer/components/ImageBuilderState.jsx (new), src/renderer/components/ImageBuilderDoneState.jsx (new), src/renderer/App.jsx, src/renderer/hooks/useMode.js, main.js, vibe/CODEBASE.md, vibe/DECISIONS.md, vibe/TASKS.md
**Files out of scope**: All other components, all hooks except useMode, preload.js, index.css

**Conventions** (from vibe/CODEBASE.md + vibe/ARCHITECTURE.md):
- One component per file in src/renderer/components/. Functional React components only.
- All state transitions via transition() in App.jsx — never mutate state directly.
- Inline styles for dynamic/stateful values; Tailwind only for static layout classes.
- No dangerouslySetInnerHTML with user/Claude content — use JSX text nodes.
- IPC via window.electronAPI only — never ipcRenderer directly.
- localStorage only via useMode() / useTone() / utils/history.js wrappers.
- Purple accent: rgba(139,92,246) — not used by any existing mode.

**Scope changes**: If user says "change:" — stop and run vibe-change-spec immediately.

**Boundaries:**
Always: follow ARCHITECTURE.md patterns · run lint after every change ·
        keep changes additive · update CODEBASE.md for new files ·
        update TASKS.md after every task

Ask first: adding new IPC channels · changing window dimensions · modifying existing mode flows
Never: touch files not in scope · change behaviour of other modes · use innerHTML with generated text

**Session startup:**
1. Read CLAUDE.md · 2. Read vibe/CODEBASE.md · 3. Read vibe/ARCHITECTURE.md
4. Read vibe/SPEC_INDEX.md · 5. Read vibe/TASKS.md · 6. Read FEATURE_TASKS.md
7. Confirm task before writing any code

**Between tasks:** "next" triggers this exact sequence — no deviations:
1. Run lint: `npm run lint 2>&1 | tail -10`
2. Stage and commit code changes:
   ```
   git add src/renderer/components/ImageBuilderState.jsx src/renderer/components/ImageBuilderDoneState.jsx src/renderer/App.jsx src/renderer/hooks/useMode.js main.js
   git commit -m "feat(image-builder): [TASK-ID] — description"
   ```
3. Stage and commit doc updates separately:
   ```
   git add vibe/features/2026-04-27-image-builder/FEATURE_TASKS.md vibe/TASKS.md vibe/DECISIONS.md vibe/CODEBASE.md
   git commit -m "docs(FEATURE_TASKS+TASKS): mark [TASK-ID] done — image-builder"
   ```
4. Re-read TASKS.md silently → state next task in plain English → confirm.
---

### Active Feature: FEATURE-ABORT-RESET
> Folder: vibe/features/2026-04-28-abort-reset/ | Added: 2026-04-28

**Feature summary**: Always-visible reset button that aborts any in-progress state and returns to IDLE for the current mode.
**Files in scope**: `src/renderer/App.jsx`, `src/renderer/components/ExpandedView.jsx`, `src/renderer/components/ExpandedTransportBar.jsx`, `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`
**Files out of scope**: All other components, all hooks, main.js, preload.js, index.css

**Conventions** (from vibe/CODEBASE.md + vibe/ARCHITECTURE.md):
- One component per file in src/renderer/components/. Functional React components only.
- All state transitions via transition() in App.jsx — never mutate state directly.
- Inline styles for dynamic/stateful values; Tailwind only for static layout classes.
- No dangerouslySetInnerHTML with user/Claude content.
- IPC via window.electronAPI only.
- Use `stateRef.current` (not `currentState`) inside event handlers to avoid stale closures.
- Use `displayState` for render-conditional visibility (follows animation, not instant state).
- `WebkitAppRegion: 'no-drag'` on ALL clickable elements.

**Scope changes**: If user says "change:" — stop and run vibe-change-spec immediately.

**Boundaries:**
Always: follow ARCHITECTURE.md patterns · run lint after every change ·
        keep changes additive · update CODEBASE.md for new props/refs ·
        update TASKS.md after every task

Ask first: adding new IPC channels · changing window dimensions
Never: touch files not in scope · change behaviour of other modes · add runtime npm packages

**Session startup:**
1. Read CLAUDE.md · 2. Read vibe/CODEBASE.md · 3. Read vibe/ARCHITECTURE.md
4. Read vibe/SPEC_INDEX.md · 5. Read vibe/TASKS.md · 6. Read FEATURE_TASKS.md
7. Confirm task before writing any code

**Between tasks:** "next" triggers this exact sequence — no deviations:
1. Run lint: `npm run lint 2>&1 | tail -10`
2. Stage and commit code changes:
   ```
   git add src/renderer/App.jsx src/renderer/components/ExpandedView.jsx src/renderer/components/ExpandedTransportBar.jsx
   git commit -m "feat(abort-reset): [TASK-ID] — description"
   ```
3. Stage and commit doc updates separately:
   ```
   git add vibe/features/2026-04-28-abort-reset/FEATURE_TASKS.md vibe/TASKS.md vibe/DECISIONS.md vibe/CODEBASE.md
   git commit -m "docs(FEATURE_TASKS+TASKS): mark [TASK-ID] done — abort-reset"
   ```
4. Re-read TASKS.md silently → state next task in plain English → confirm.
---

---
### Active Feature: FEATURE-HISTORY-EMPTY-STATE
> Folder: vibe/features/2026-04-28-history-empty-state/ | Added: 2026-04-28

**Feature summary**: Show empty state (clock icon + "Select a history to view details") in right panel when no history entry is selected on launch.
**Files in scope**: `src/renderer/components/ExpandedView.jsx`, `src/renderer/components/ExpandedDetailPanel.jsx`, `vibe/CODEBASE.md`, `vibe/TASKS.md`, `vibe/DECISIONS.md`
**Files out of scope**: All other components, all hooks, App.jsx, main.js, preload.js, index.css

**Conventions** (from vibe/CODEBASE.md + vibe/ARCHITECTURE.md):
- Inline styles for conditional/dynamic rendering
- No dangerouslySetInnerHTML — JSX text nodes only
- Functional React components, one per file

**Scope changes**: If user says "change:" — stop and run vibe-change-spec immediately.

**Boundaries:**
Always: follow ARCHITECTURE.md patterns · run lint after every change · keep changes additive · update CODEBASE.md · update TASKS.md after every task
Never: touch files not in scope · change showEntryDetail logic · remove getHistory import

**Between tasks:** "next" triggers this exact sequence — no deviations:
1. Run lint: `npm run lint 2>&1 | tail -10`
2. Stage and commit code changes:
   ```
   git add src/renderer/components/ExpandedView.jsx src/renderer/components/ExpandedDetailPanel.jsx
   git commit -m "feat(history-empty-state): [TASK-ID] — description"
   ```
3. Stage and commit doc updates separately:
   ```
   git add vibe/features/2026-04-28-history-empty-state/FEATURE_TASKS.md vibe/TASKS.md vibe/DECISIONS.md vibe/CODEBASE.md
   git commit -m "docs(FEATURE_TASKS+TASKS): mark [TASK-ID] done — history-empty-state"
   ```
4. Re-read TASKS.md silently → state next task in plain English → confirm.
---

---
### Active Feature: FEATURE-WORKFLOW-BUILDER
> Folder: vibe/features/2026-04-27-workflow-builder/ | Added: 2026-04-29

**Feature summary**: New "Workflow" mode — user speaks automation idea, Claude maps it to n8n nodes + generates importable JSON workflow.
**Files in scope**: `src/renderer/components/WorkflowBuilderState.jsx` (new), `src/renderer/components/WorkflowBuilderDoneState.jsx` (new), `src/renderer/App.jsx`, `src/renderer/hooks/useMode.js`, `main.js`, `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`
**Files out of scope**: All other components, all hooks except useMode, preload.js, index.css

**Conventions** (from vibe/CODEBASE.md + vibe/ARCHITECTURE.md):
- One component per file in src/renderer/components/. Functional React components only.
- All state transitions via transition() in App.jsx — never mutate state directly.
- Inline styles for dynamic/stateful values; Tailwind only for static layout classes.
- No dangerouslySetInnerHTML with user/Claude content — use JSX text nodes.
- IPC via window.electronAPI only — never ipcRenderer directly.
- localStorage only via useMode() / useTone() / utils/history.js wrappers.
- Green accent: rgba(34,197,94) — not used by any existing mode.

**Scope changes**: If user says "change:" — stop and run vibe-change-spec immediately.

**Boundaries:**
Always: follow ARCHITECTURE.md patterns · run lint after every change ·
        keep changes additive · update CODEBASE.md for new files ·
        update TASKS.md after every task

Ask first: adding new IPC channels · changing window dimensions · modifying existing mode flows
Never: touch files not in scope · change behaviour of other modes · use innerHTML with generated text

**Session startup:**
1. Read CLAUDE.md · 2. Read vibe/CODEBASE.md · 3. Read vibe/ARCHITECTURE.md
4. Read vibe/SPEC_INDEX.md · 5. Read vibe/TASKS.md · 6. Read FEATURE_TASKS.md
7. Confirm task before writing any code

**Between tasks:** "next" triggers this exact sequence — no deviations:
1. Run lint: `npm run lint 2>&1 | tail -10`
2. Stage and commit code changes:
   ```
   git add src/renderer/components/WorkflowBuilderState.jsx src/renderer/components/WorkflowBuilderDoneState.jsx src/renderer/App.jsx src/renderer/hooks/useMode.js main.js
   git commit -m "feat(workflow): WFL-XXX — description"
   ```
3. Stage and commit doc updates separately:
   ```
   git add vibe/features/2026-04-27-workflow-builder/FEATURE_TASKS.md vibe/TASKS.md vibe/DECISIONS.md vibe/CODEBASE.md
   git commit -m "docs(FEATURE_TASKS+TASKS): mark WFL-XXX done — workflow-builder"
   ```
4. Re-read TASKS.md silently → state next task in plain English → confirm.
---
