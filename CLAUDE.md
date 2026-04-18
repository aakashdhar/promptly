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

---

---

### Active Feature: F-SPEECH (Speech recording)
> Folder: vibe/features/2026-04-18-speech-recording/ | Added: 2026-04-18

**Feature summary**: Replace the shortcut stub with real `webkitSpeechRecognition` — live transcript in RECORDING state, `originalTranscript` captured once at stop, transitions to THINKING. Stub (setTimeout IDLE) left for F-CLAUDE to replace.
**Files in scope**: `index.html` (only)
**Files out of scope**: `main.js`, `preload.js`, `package.json`, `entitlements.plist`

**Conventions** (from vibe/ARCHITECTURE.md):
- `setState(newState, payload)` is the ONLY function that mutates DOM visibility
- `textContent` for all dynamic text — never `innerHTML` with any external content
- No new IPC channels — `webkitSpeechRecognition` is a renderer Web API
- New module-scope vars: `recognition` (webkitSpeechRecognition|null), `isRecording` (boolean)
- New functions: `startRecording()`, `stopRecording()`
- `originalTranscript` captured ONCE in `stopRecording()` — never mutated after

**Scope changes**: If user says "change:" — stop and run vibe-change-spec immediately.

**Boundaries:**
Always: follow ARCHITECTURE.md patterns · run manual smoke test after every change ·
        keep changes additive · update CODEBASE.md for new functions/vars (FPH-003)

Ask first: adding any new IPC channel · adding localStorage keys beyond mode/firstRunComplete

Never: use innerHTML with dynamic content · access localStorage directly · touch main.js or preload.js ·
       add runtime npm dependencies · toggle DOM visibility outside setState() ·
       mutate `originalTranscript` after `stopRecording()` captures it

**Between tasks:** "next" triggers this exact sequence:
1. Verify all acceptance criteria in FEATURE_TASKS.md for completed task
2. Manual smoke test: exercise RECORDING, auto-stop, and ERROR paths
3. Run lint: `npm run lint` (must pass)
4. Commit code changes:
   ```
   git add index.html
   git commit -m "feat(speech): [FPH-00X] — description"
   ```
5. Commit doc updates separately:
   ```
   git add vibe/features/2026-04-18-speech-recording/FEATURE_TASKS.md vibe/TASKS.md vibe/DECISIONS.md vibe/CODEBASE.md
   git commit -m "docs(FEATURE_TASKS+TASKS): mark [FPH-00X] done — speech"
   ```
6. Re-read TASKS.md silently → state next task → confirm before starting.

---

---

### Active Feature: F-CLAUDE (Claude CLI integration + 5 prompt modes)
> Folder: vibe/features/2026-04-18-claude-integration/ | Added: 2026-04-18

**Feature summary**: Replace generate-prompt stub with real claude CLI spawn call; add 5-mode system prompts; add right-click mode context menu; wire PROMPT_READY on success.
**Files in scope**: `main.js`, `index.html`
**Files out of scope**: `preload.js` (generatePrompt already exposed), `package.json`, `entitlements.plist`

**Conventions** (from vibe/ARCHITECTURE.md):
- `spawn(claudePath, ['-p', systemPrompt])` — transcript via stdin, never shell argument
- `setState()` for all state transitions
- `textContent` for all dynamic text (mode labels, checkmarks, prompt output)
- `getMode()` / `setMode()` for all localStorage mode access
- No new IPC channels — `generate-prompt` already registered
- MODE_SYSTEM_PROMPTS in main.js only; MODES (keys+labels) in index.html only

**Scope changes**: If user says "change:" — stop and run vibe-change-spec immediately.

**Boundaries:**
Always: follow ARCHITECTURE.md patterns · manual smoke test after every change ·
        keep changes additive · update CODEBASE.md for new constants/functions (FCL-004)

Ask first: changing any system prompt text · adding any new IPC channel · new localStorage key

Never: use innerHTML with dynamic content · access localStorage directly ·
       pass transcript as shell argument · mutate originalTranscript ·
       add runtime npm dependencies

**Between tasks:** "next" triggers this exact sequence:
1. Verify all acceptance criteria in FEATURE_TASKS.md for completed task
2. Manual smoke test: exercise affected states
3. Run lint: `npm run lint` (must pass)
4. Commit code changes:
   ```
   git add main.js index.html
   git commit -m "feat(claude): [FCL-00X] — description"
   ```
5. Commit doc updates separately:
   ```
   git add vibe/features/2026-04-18-claude-integration/FEATURE_TASKS.md vibe/TASKS.md vibe/DECISIONS.md vibe/CODEBASE.md
   git commit -m "docs(FEATURE_TASKS+TASKS): mark [FCL-00X] done — claude"
   ```
6. Re-read TASKS.md silently → state next task → confirm before starting.

---

### Active Feature: F-ACTIONS (Copy, Edit, Regenerate)
> Folder: vibe/features/2026-04-18-actions/ | Added: 2026-04-18

**Feature summary**: Wire the three action buttons in PROMPT_READY: Copy (clipboard + green flash 1.8s), Edit (contenteditable + Escape/Done), Regenerate (originalTranscript re-run → THINKING → PROMPT_READY).
**Files in scope**: `index.html` (only)
**Files out of scope**: `main.js`, `preload.js` (copy-to-clipboard IPC already live), `package.json`, `entitlements.plist`

**Conventions** (from vibe/ARCHITECTURE.md):
- `setState()` for all state transitions (THINKING, PROMPT_READY, ERROR)
- `textContent` for all dynamic text — never `innerHTML`
- `getMode()` for all localStorage mode reads
- `generatedPrompt` module-scope var — readable and writable (Edit/Done updates it)
- `originalTranscript` — read-only in this feature, never mutated

**Scope changes**: If user says "change:" — stop and run vibe-change-spec immediately.

**Boundaries:**
Always: follow ARCHITECTURE.md patterns · manual smoke test after every change ·
        keep changes additive · update CODEBASE.md (FAC-004)

Ask first: adding any new IPC channel · adding localStorage keys

Never: use innerHTML with dynamic content · access localStorage directly · touch main.js or preload.js ·
       add runtime npm dependencies · mutate `originalTranscript`

**Between tasks:** "next" triggers this exact sequence:
1. Verify all acceptance criteria in FEATURE_TASKS.md for completed task
2. Manual smoke test: exercise Copy, Edit, Regenerate paths
3. Run lint: `npm run lint` (must pass)
4. Commit code changes:
   ```
   git add index.html
   git commit -m "feat(actions): [FAC-00X] — description"
   ```
5. Commit doc updates separately:
   ```
   git add vibe/features/2026-04-18-actions/FEATURE_TASKS.md vibe/TASKS.md vibe/DECISIONS.md vibe/CODEBASE.md
   git commit -m "docs(FEATURE_TASKS+TASKS): mark [FAC-00X] done — actions"
   ```
6. Re-read TASKS.md silently → state next task → confirm before starting.

---

## Never list (P0 — block commit immediately)

- Adding any runtime npm dependency
- `nodeIntegration: true` anywhere
- `innerHTML` with user-provided or Claude-generated text
- `exec('claude ...')` without the cached `claudePath`
- Storing API keys or tokens in the app
- `localStorage.*` outside the wrapper functions
- Introducing a framework, bundler, or build step
- Mutating `originalTranscript` after recording stops
