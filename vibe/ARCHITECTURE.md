# ARCHITECTURE.md — Promptly
> Created: 2026-04-18 via architect: | Last updated: 2026-04-18
> Source: BRIEF.md + architect: conversation decisions
> ⚠️ This is the agent's constitution. Every code decision is measured against it.

---

## Project type

**Type:** Desktop app (Electron)
**Platform:** macOS only — always-on-top floating bar
**Stack (locked):**
  Shell:    Electron v31+, universal binary (arm64 + x64)
  Frontend: Vanilla HTML + CSS + JS — single index.html, zero build step
  Speech:   Web Speech API (webkitSpeechRecognition) — native macOS engine
  CLI:      `claude -p` via child_process — PATH resolved via login shell at startup
  IPC:      Electron ipcMain + preload.js contextBridge
  Storage:  localStorage — mode only, nothing sensitive
  Dist:     electron-builder → .dmg (arm64 + x64)
  Backend:  None — Claude CLI is the AI layer
  Database: None — no persistence beyond localStorage

> This stack is locked. Do NOT introduce frameworks (React, Vue, Svelte, Next.js),
> build tools (Vite, Webpack, esbuild), or TypeScript. The constraint is intentional:
> zero build step, zero runtime npm dependencies. Any deviation requires a change:
> command and a DECISIONS.md entry.

---

## Folder structure

```
promptly/
├── main.js            # Window config, global shortcut, IPC handlers, PATH resolution
├── preload.js         # contextBridge — exposes electronAPI to renderer (sandboxed)
├── index.html         # Entire UI: state machine, waveform, mode system, all styles
├── package.json       # Electron + electron-builder config, no runtime dependencies
└── entitlements.plist # Mic permission for hardened runtime (required for notarisation)
```

**Rules:**
- All UI lives in `index.html`. No separate `.css` or `.js` files — the whole renderer is one file.
- `main.js` handles only: window creation, IPC, PATH resolution, global shortcut registration.
- `preload.js` is the only bridge between renderer and main. It exposes `window.electronAPI` exclusively.
- No new top-level files without a DECISIONS.md entry explaining why.

---

## Naming conventions

| Type | Convention | Example |
|------|-----------|---------|
| IPC channel names | kebab-case strings | `'generate-prompt'`, `'copy-to-clipboard'` |
| JS functions | camelCase | `startRecording()`, `setState()` |
| CSS classes | kebab-case | `.recording-indicator`, `.prompt-output` |
| CSS custom properties | `--kebab-case` | `--color-action`, `--radius-window` |
| Constants | SCREAMING_SNAKE_CASE | `MODES`, `SHORTCUT_PRIMARY` |
| State names | SCREAMING_SNAKE_CASE strings | `'IDLE'`, `'RECORDING'`, `'PROMPT_READY'` |
| IPC handlers in main.js | ipcMain.handle('verb-noun') | `ipcMain.handle('resolve-claude-path')` |

---

## State management

**Approach:** In-memory state machine inside `index.html`. Single `currentState` variable.

**States (6 total — spec'd in BRIEF.md):**
```
FIRST_RUN → IDLE → RECORDING → THINKING → PROMPT_READY → ERROR
```

**Rules:**
- All state transitions go through a single `setState(newState, payload)` function.
- `setState` is the only place DOM class changes and element visibility are toggled.
- No state stored outside `currentState` + `localStorage` (mode only).
- localStorage accessed only via two wrapper functions: `getMode()` and `setMode()` — never `localStorage.*` directly in other code.
- `transcript` and `generatedPrompt` are plain module-scope variables — not in localStorage, not in DOM attributes.
- The `originalTranscript` is captured once at recording stop and never mutated — regenerate always uses it.

---

## Frontend patterns

**DOM rules:**
- All elements accessed by `id` — no querySelector chains.
- Event listeners set once at `DOMContentLoaded`. No dynamic listener attachment.
- No innerHTML with untrusted data — use `textContent` for user-generated content. Use `innerHTML` only for static structure.
- Edit mode uses `contenteditable` on the prompt output element. `Escape` cancels (restores), `Done` saves to `generatedPrompt`.

**Styling:**
- All styles inline in `<style>` block inside `index.html`. No external stylesheets.
- Design tokens as CSS custom properties at `:root`:
  - `--color-action: #007AFF` (iOS blue)
  - `--color-recording: #FF3B30` (iOS red)
  - `--color-success: #34C759` (iOS green)
  - `--bg-window: rgba(255,255,255,0.85)`
  - `--radius-window: 14px`
  - `--radius-inner: 8px`
- System font only: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif`
- CSS `transition`: opacity `150ms ease` only — no transforms in transitions, no bounces, no slides.
- CSS `@keyframes` animations may use `transform` for functional animations (spinner rotation, recording dot pulse). No transforms in `transition` declarations anywhere.
- No hardcoded hex values outside the token definitions.

**IPC pattern:**
- Renderer calls `window.electronAPI.methodName(args)` — never `ipcRenderer` directly.
- All `window.electronAPI` methods are defined in `preload.js` via `contextBridge.exposeInMainWorld`.
- Main process responds via `ipcMain.handle` (async request/response) or sends events via `win.webContents.send` (push).

---

## IPC surface (complete list)

| Direction | Channel | Purpose |
|-----------|---------|---------|
| renderer → main | `generate-prompt` | Send transcript + mode, returns Claude output |
| renderer → main | `copy-to-clipboard` | Write string to system clipboard |
| renderer → main | `check-claude-path` | Returns resolved claude binary path or error |
| main → renderer | `shortcut-triggered` | Global ⌥Space / ⌃\` fired from outside app |
| main → renderer | `shortcut-conflict` | Primary shortcut taken, fallback active |

---

## PATH resolution (critical — most common failure point)

**Rule:** The `claude` binary MUST be resolved via the user's login shell at startup.

```js
// main.js — run once at app ready, cache result
exec('zsh -lc "which claude"', (err, stdout) => {
  claudePath = stdout.trim(); // cache globally
});
```

- Never use bare `exec('claude ...')` — it will fail for most users.
- If resolution fails → send `check-claude-path` error to renderer → transition to ERROR state.
- All subsequent `claude -p` calls use the cached `claudePath`.
- If `claudePath` is null at call time → ERROR state, message: "Claude CLI not found."

---

## Prompt modes

| Mode | Key | Behaviour |
|------|-----|-----------|
| Balanced | default | Standard structured prompt |
| Detailed | `detailed` | Expanded with edge cases and constraints |
| Concise | `concise` | Minimal, direct prompt |
| Chain | `chain` | Multi-step chain-of-thought prompt |
| Code | `code` | Code-first with language/output format specified |

- Mode is selected via right-click context menu on the bar.
- Active mode persisted in localStorage via `getMode()` / `setMode()`.
- Mode label visible in IDLE state next to shortcut hint — never hidden.
- Mode drives the system prompt prefix sent to `claude -p`.

---

## Testing philosophy

**Context:** Vanilla JS Electron app, no test framework in dependencies for v1.

**What gets tested:**

| Type | Scope | Method | When |
|------|-------|--------|------|
| Manual smoke test | All 6 states, all 5 modes | Run app, exercise each flow | Before every commit |
| Manual regression | Global shortcut, PATH resolution, edit mode | Checklist in TASKS.md | Before every release |
| Unit (if added) | Pure functions — mode system, state transitions | Vitest (add as devDep if needed) | If logic grows complex |
| E2E | Full flow — speak → generate → copy | Playwright + Electron driver | v2 if distribution expands |

**Rules:**
- For v1: manual smoke test checklist is the test suite. Honour it before every commit.
- No test skipping — if a flow is broken, fix it before the commit goes in.
- If unit tests are added, they go in `tests/` at root. Vitest as devDep only.

---

## Code quality

**Linter:** ESLint — configured for vanilla JS (no TypeScript plugin needed)
- `no-unused-vars` — no dead code
- `no-console` (warn) — `console.log` allowed during dev, clean before release
- No TypeScript — this is intentional. Do not add JSDoc types as a workaround for `any`.

**Formatter:** Prettier
- Single quotes, semicolons, 2-space indent, 100 char line length

**Git conventions:**
- Conventional commits: `feat(scope)`, `fix(scope)`, `docs(scope)`, `design(scope)`
- Branch naming: `feature/[TASK-ID]-slug`, `fix/[TASK-ID]-slug` — always branched off `main`
- Doc commits always separate from code commits
- Pre-commit: linter must pass before commit

**Dependencies:**
- Zero runtime npm dependencies — this is a hard constraint from BRIEF.md.
- Only devDependencies: `electron`, `electron-builder`. Nothing else without DECISIONS.md entry.
- `npm audit` before every commit — high/critical = block commit.
- Pin exact versions in package.json.

---

## The O'Reilly principles (enforced by review:)

**Spec before code** — no task starts without acceptance criteria in FEATURE_TASKS.md.
**Context preservation** — CLAUDE.md, CODEBASE.md, ARCHITECTURE.md, TASKS.md read every session.
**Incremental progress** — one task at a time. Confirm → build → verify → commit.
**Drift prevention** — every deviation from this document logged in DECISIONS.md.

---

## Always list

The following are required on every task — no exceptions:

- Use `contextBridge` for all renderer↔main communication — never expose node APIs directly
- Use the cached `claudePath` for all `exec` calls involving the Claude binary
- Call `setState(newState, payload)` for all DOM state changes — never mutate DOM directly
- Use `getMode()` / `setMode()` for all localStorage mode access
- Use `textContent` for all user-provided or Claude-generated text rendered to DOM

---

## Ask first

Check with the human before doing any of the following:

- Adding a new IPC channel not in the IPC surface table
- Adding a new localStorage key beyond `mode` and `firstRunComplete`
- Changing window dimensions or position
- Changing the text of any error message or user-facing copy
- Changing the system prompt for any mode

---

## Never list

The following are P0 review findings — they block phase gates:

- [ ] Adding runtime npm dependencies (zero runtime deps is a hard constraint)
- [ ] Using `nodeIntegration: true` — always use contextBridge/preload instead
- [ ] Using `innerHTML` with any user-provided or Claude-generated text — use `textContent`
- [ ] Calling `exec('claude ...')` without the cached login-shell-resolved path
- [ ] Storing any sensitive data (API keys, tokens) — Claude CLI handles auth, nothing in app
- [ ] Accessing `localStorage` directly outside `getMode()` / `setMode()` wrappers
- [ ] Introducing a framework, build step, or bundler (Vite, Webpack, React, etc.)
- [ ] Mutating `originalTranscript` after it is captured — regenerate must always use original

---

## Architecture decisions log

> Decisions made during architect: session.
> Full history of changes in DECISIONS.md.

| Decision | Choice | Reason | Date |
|----------|--------|--------|------|
| Frontend framework | Vanilla HTML/CSS/JS | Zero build step; zero runtime deps; constraint from BRIEF.md | 2026-04-18 |
| State management | In-memory state machine, single setState() | 6 known states, no async complexity, no framework needed | 2026-04-18 |
| localStorage access | Wrapper functions only (getMode/setMode) | Prevents scattered direct access, easy to audit | 2026-04-18 |
| TypeScript | Not used | Vanilla JS mandate from BRIEF.md; build complexity outweighs benefit for this app size | 2026-04-18 |
| Testing v1 | Manual smoke checklist | No test framework needed for ~5 files; Playwright for v2 if distributes | 2026-04-18 |
| IPC pattern | contextBridge + preload.js | Electron security best practice; sandboxed renderer | 2026-04-18 |
| PATH resolution | zsh login shell at startup, cached | Most common failure mode in Electron+CLI; spec'd in BRIEF.md as high-risk | 2026-04-18 |
| CSS approach | Inline in index.html, CSS custom properties | Single-file constraint; tokens prevent hardcoded colours | 2026-04-18 |

---

## Changelog

> Updated by architect: when decisions change.
> 2026-04-18 — Initial ARCHITECTURE.md created via architect: from BRIEF.md
