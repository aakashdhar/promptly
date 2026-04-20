# ARCHITECTURE.md — Promptly
> Created: 2026-04-18 via architect: | Last updated: 2026-04-18
> Source: BRIEF.md + architect: conversation decisions
> ⚠️ This is the agent's constitution. Every code decision is measured against it.

---

## Project type

**Type:** Desktop app (Electron)
**Platform:** macOS only — always-on-top floating bar
**Stack (as-built — FEATURE-004 migrated renderer to React + Vite):**
  Shell:    Electron v31+, universal binary (arm64 + x64)
  Frontend: React 18 + Vite — `src/renderer/` → built to `dist-renderer/` (devDeps only)
  Styling:  Tailwind v4 for static classes; inline styles for dynamic/stateful layout
  Speech:   getUserMedia + MediaRecorder (renderer) → transcribe-audio IPC → Whisper CLI (main)
  CLI:      `claude -p` via child_process — PATH resolved via login shell at startup
  IPC:      Electron ipcMain + preload.js contextBridge
  Storage:  localStorage — mode + history, nothing sensitive
  Dist:     electron-builder → .dmg (arm64 + x64)
  Backend:  None — Claude CLI is the AI layer
  Database: None — no persistence beyond localStorage

> Runtime npm dependencies: zero — React/Vite/Tailwind are devDeps only, not in .dmg.
> Any new runtime dependency requires a DECISIONS.md entry.
> 📝 2026-04-19 · Stack updated — FEATURE-004 React migration (see D-FCR in DECISIONS.md)

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

**States (9 total — 6 original + SHORTCUTS, HISTORY, PAUSED, ITERATING added via features):**
```
FIRST_RUN → IDLE → RECORDING → THINKING → PROMPT_READY → ERROR
                 ↕ PAUSED (FEATURE-011)
                 → ITERATING (FEATURE-012)
IDLE / PROMPT_READY → SHORTCUTS (FEATURE-006)
IDLE / PROMPT_READY → HISTORY (FEATURE-009)
```

**Rules:**
- All state transitions go through a single `setState(newState, payload)` function.
- `setState` is the only place DOM class changes and element visibility are toggled.
- No state stored outside `currentState` + `localStorage` (mode only).
- localStorage accessed only via four wrapper functions: `getMode()`, `setMode()`, `getFirstRunComplete()`, `setFirstRunComplete()` — never `localStorage.*` directly in other code.
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
- Design tokens as CSS custom properties at `:root` (dark-glass palette — updated from original iOS-light spec during design pivot):
  - `--blue: #0A84FF` (action colour — iOS dark-mode blue)
  - `--red: #FF3B30` (recording / stop)
  - `--green: #30D158` (success / copy flash)
  - `--font: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif`
  - `--bar-radius: 18px`
  - Border/shadow/backdrop tokens (`--border-top`, `--bar-shadow`, `--bar-backdrop`, etc.) defined in index.html `:root`
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
| renderer → main | `generate-raw` | Full custom system prompt passthrough → Claude; returns { success, prompt, error } — added FEATURE-012 |
| renderer → main | `copy-to-clipboard` | Write string to system clipboard |
| renderer → main | `check-claude-path` | Returns resolved claude binary path or error |
| renderer → main | `resize-window` | Resize BrowserWindow height per state (STATE_HEIGHTS) |
| renderer → main | `transcribe-audio` | Send audio ArrayBuffer → Whisper CLI → return transcript string |
| renderer → main | `show-mode-menu` | Open native Electron radio menu for mode selection (BUG-002-D) |
| renderer → main | `set-window-buttons-visible` | Show/hide native traffic light buttons — hidden during RECORDING |
| renderer → main | `splash-done` | Splash complete — hide splashWin, show main win, register shortcut |
| renderer → main | `splash-check-cli` | Check if claudePath resolved — returns `{ ok, path }` |
| renderer → main | `splash-check-whisper` | Check if whisperPath resolved — returns `{ ok, path }` |
| renderer → main | `splash-open-url` | Open install URL in system browser (https:// only) |
| renderer → main | `request-mic` | Reserved for future mic permission IPC (currently no-op) |
| main → renderer | `shortcut-triggered` | Global ⌥Space / ⌃\` fired from outside app |
| main → renderer | `shortcut-conflict` | Primary shortcut taken, fallback active |
| main → renderer | `mode-selected` | Mode key chosen from native menu — sent after show-mode-menu (BUG-002-D) |
| renderer → main | `get-theme` | Returns `{ dark: boolean }` — current macOS appearance |
| main → renderer | `theme-changed` | Sent when macOS appearance changes; payload `{ dark: boolean }` |
| renderer → main | `show-language-menu` | Open native Electron radio menu from passed languages array; sends `language-selected` to renderer on click |
| main → renderer | `language-selected` | Sent from show-language-menu click handler with selected language code |
| renderer → main | `save-file` | Show native save dialog + write file; returns `{ ok, filePath }` — added FEATURE-007 |
| renderer → main | `resize-window-width` | Resize BrowserWindow width only, preserving height — added FEATURE-009 |
| main → renderer | `show-history` | Sent by "History ⌘H" context menu item — added FEATURE-009 |
| renderer → main | `set-window-size` | Set both width and height atomically; updates setMinimumSize/setMaximumSize first — added BUG-011 |

---

## PATH resolution (critical — most common failure point)

**Rule:** Both `claude` and `whisper` binaries MUST be resolved via expanded search at startup, then cached. In packaged `.app` / `.dmg` builds the process environment does not load the user's shell PATH, so a direct `which` call is unreliable.

**Pattern (BUG-012 — 2026-04-20):**
```js
// 1. Check common installation directories first (fs.existsSync — no shell needed)
// 2. Fall back to zsh login shell (loads .zshrc/.zprofile)
// 3. Fall back to bash login shell
// 4. For whisper only: fall back to python3 -m whisper
async function resolveXPath() {
  for (const p of commonPaths) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return new Promise((resolve) => {
    exec('zsh -lc "which X"', (err, stdout) => {
      if (!err && stdout.trim()) { resolve(stdout.trim()); return; }
      exec('bash -lc "which X"', (err2, stdout2) => {
        resolve(stdout2?.trim() || null);
      });
    });
  });
}
```

- Both `resolveClaudePath()` and `resolveWhisperPath()` are `async` functions — `await`ed in `app.whenReady()` before any window is created.
- `whisperPath` may be the string `'python3 -m whisper'` — `transcribe-audio` constructs the exec command accordingly.
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
| Design | `design` | Standalone 12-section design-director prompt; bypasses PROMPT_TEMPLATE |
| Refine | `refine` | Standalone 4-section design feedback prompt (Current state, Problem, Desired outcome, Constraints); purple accent in UI; bypasses PROMPT_TEMPLATE |

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
  > Exception: FEATURE-012 iteration flow — `originalTranscript.current = iterText` is set deliberately after a successful iteration so "You said" and Regenerate reflect the user's latest input. See DECISIONS.md D-ITER-003.

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
| Window title bar | `titleBarStyle: 'hiddenInset'` + `trafficLightPosition` (not `frame: false`) | Traffic lights required per BRIEF.md; hiddenInset hides title bar while preserving traffic lights | 2026-04-18 |
| Waveform animation | `setInterval` + sine wave + noise in renderer | Visual only — Whisper is post-processing, no real-time audio stream available; no Web Audio API needed | 2026-04-18 |

---

## Changelog

> Updated by architect: when decisions change.
> 2026-04-18 — Initial ARCHITECTURE.md created via architect: from BRIEF.md
> 📝 2026-04-18 · Scope change D-003 — speech engine changed from webkitSpeechRecognition to MediaRecorder + Whisper CLI; transcribe-audio IPC channel added
> 📝 2026-04-18 · Scope change D-004 — frame: false → titleBarStyle: hiddenInset + trafficLightPosition; 30-bar waveform pattern added
