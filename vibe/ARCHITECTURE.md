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
├── main.js             # Window config, global shortcut, IPC handlers, PATH resolution
├── preload.js          # contextBridge — exposes electronAPI to renderer (sandboxed)
├── splash.html         # Splash screen BrowserWindow — CLI + mic check, vanilla HTML
├── package.json        # Electron + electron-builder config, devDeps only
├── entitlements.plist  # Mic permission for hardened runtime (required for notarisation)
├── vite.config.js      # Vite build config — root: src/renderer, outDir: dist-renderer/
├── eslint.config.js    # ESLint 9 flat config for main.js + preload.js
└── src/
    └── renderer/
        ├── index.html  # Vite HTML entry point — <div id="root">
        ├── index.css   # Tailwind v4 entry — @theme tokens, @keyframes, body reset
        ├── main.jsx    # React root — ReactDOM.createRoot().render(<App />)
        ├── App.jsx     # State machine root — transition(), all states, IPC wiring
        ├── hooks/      # useMode, useRecording, useKeyboardShortcuts, usePolishMode, useWindowResize, useTone
        ├── components/ # One per state: IdleState, RecordingState, ThinkingState, PromptReadyState, …
        └── utils/      # history.js — all localStorage history access
```

**Rules:**
- All UI lives in `src/renderer/`. One component per file. Components are functional React components.
- `main.js` handles only: window creation, IPC, PATH resolution, global shortcut registration.
- `preload.js` is the only bridge between renderer and main. It exposes `window.electronAPI` exclusively.
- No new top-level files without a DECISIONS.md entry explaining why.
- React/Vite/Tailwind are devDeps only — not bundled into the packaged .app.

> 📝 2026-04-19 · Folder structure updated — FEATURE-004 React migration mainlined (see D-FCR in DECISIONS.md)

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

**Approach:** React `useState` + `useRef` state machine in `App.jsx`. Single `currentState` (useState) mirrors `stateRef` (useRef) for stale-closure-safe IPC callbacks.

**States (17 total — 6 original + SHORTCUTS, HISTORY, PAUSED, ITERATING, TYPING, SETTINGS, IMAGE_BUILDER, IMAGE_BUILDER_DONE, VIDEO_BUILDER, VIDEO_BUILDER_DONE, WORKFLOW_BUILDER, WORKFLOW_BUILDER_DONE, TRANSCRIPTION_ERROR, GENERATION_ERROR added via features):**
```
FIRST_RUN → IDLE → RECORDING → THINKING → PROMPT_READY → ERROR
                 ↕ PAUSED (FEATURE-011)
                 → ITERATING (FEATURE-012)
                 → TYPING (FEATURE-014)
IDLE / PROMPT_READY → SHORTCUTS (FEATURE-006)
IDLE / PROMPT_READY → HISTORY (FEATURE-009)
IDLE / PROMPT_READY → SETTINGS (FEATURE-013)
RECORDING (image mode) → THINKING → IMAGE_BUILDER → THINKING → IMAGE_BUILDER_DONE (FEATURE-IMAGE-BUILDER)
RECORDING (video mode) → THINKING → VIDEO_BUILDER → THINKING → VIDEO_BUILDER_DONE (FEATURE-VIDEO-BUILDER)
RECORDING (workflow mode) → THINKING → WORKFLOW_BUILDER → THINKING → WORKFLOW_BUILDER_DONE (FEATURE-WORKFLOW-BUILDER)
THINKING (expanded, transcription fail) → TRANSCRIPTION_ERROR (FEATURE-ONBOARDING-WIZARD)
THINKING (expanded, generation fail) → GENERATION_ERROR (FEATURE-ONBOARDING-WIZARD)
```
> 📝 2026-04-29 · State count updated 15→17: TRANSCRIPTION_ERROR + GENERATION_ERROR added via FEATURE-ONBOARDING-WIZARD

**`isExpanded` — layout mode flag (POLISH-TOGGLE / BUG-TOGGLE-002):**
- `isExpanded` (useState boolean, mirrored as `isExpandedRef`) is NOT a state machine state — it is a layout mode.
- When `isExpanded=true`, App.jsx renders a single `<ExpandedView>` component that covers all states.
- When `isExpanded=false`, App.jsx renders the existing per-state components normally.
- `handleExpand()`: sets `isExpanded=true`, calls `setWindowSize(1100, 860)` (BUG-TOGGLE-005). `transition()` skips `resizeWindow` while expanded (guarded by `isExpandedRef.current`).
- `handleCollapse()`: sets `isExpanded=false`, resets state to IDLE, calls `setWindowSize(520, IDLE_HEIGHT)`.
- `ExpandedView` owns: top transport bar (record/stop/pause/waveform), left session-history panel, right state-content panel. All state-driving callbacks (onStart, onStop, onPause, onRegenerate, onReset, onIterate) are passed as props from App.jsx — no new IPC channels.
- `STATE_HEIGHTS.EXPANDED = 860` — window height in expanded mode. Window width: 1100px (scaled from 760×580 to 1100×860 in BUG-TOGGLE-005 for Claude-app-scale layout).

**Rules:**
- All state transitions go through a single `transition(newState, payload)` function in App.jsx.
- `transition` is the only function that calls `resizeWindow`, `setWindowButtonsVisible`, `updateMenuBarState`, and `animateToState` — always in sync.
- No state stored outside React state/refs + `localStorage` (mode, history, tone only).
- localStorage accessed only via hook wrappers: `useMode()`, `useTone()`, `utils/history.js` — never `localStorage.*` directly in components.
- `originalTranscript` is a `useRef` — set once in `stopRecording` onstop, never mutated after (exception: iteration flow, see D-ITER-003).
- `generatedPrompt` is a `useState` + mirrored `generatedPromptRef` (useRef) for stale-closure-safe ⌘C handler.

---

## Frontend patterns

**React component rules:**
- One component per file in `src/renderer/components/`. Functional components only.
- IPC event listeners registered in `useEffect` with empty dep array — mount once, clean up on unmount.
- No `dangerouslySetInnerHTML` with user/Claude content — use JSX text nodes (equivalent to `textContent`).
- All dynamic text via JSX text nodes. HTML structure via JSX only.
- Stable refs (e.g. `transitionRef`, `handleGenerateResultRef`) keep callbacks accessible in IPC onstop handlers without stale closures.

**Styling:**
- Tailwind v4 utility classes for static layout; inline styles for dynamic/stateful values (e.g. colour from state, conditional dimensions).
- `index.css` owns all `@theme` design tokens, `@keyframes`, and global body reset. Component files must not redefine tokens.
- Design tokens as CSS custom properties at `@theme` (dark-glass palette — updated from original iOS-light spec during design pivot):
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
| renderer → main | `generate-prompt` | Send transcript + mode + optional `options` (e.g. `{ tone }` for polish), returns Claude output |
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
| renderer → main | `show-tone-menu` | Open native Electron radio menu for Formal/Casual tone selection in polish mode; sends `tone-selected` to renderer on click |
| main → renderer | `tone-selected` | Sent from show-tone-menu click handler with selected tone key |
| renderer → main | `check-mic-status` | Check microphone permission via systemPreferences.askForMediaAccess; returns { granted: boolean } |
| main → renderer | `open-settings` | Sent by tray "Path configuration..." item and ⌘, shortcut; triggers SETTINGS state in renderer |
| renderer → main | `save-file` | Show native save dialog + write file; returns `{ ok, filePath }` — added FEATURE-007 |
| renderer → main | `resize-window-width` | Resize BrowserWindow width only, preserving height — added FEATURE-009 |
| main → renderer | `show-history` | Sent by "History ⌘H" context menu item — added FEATURE-009 |
| renderer → main | `set-window-size` | Set both width and height atomically; updates setMinimumSize/setMaximumSize first — added BUG-011 |
| main → renderer | `show-shortcuts` | Sent by ⌘? global shortcut or "Keyboard shortcuts ⌘?" context menu item — triggers SHORTCUTS state |
| main → renderer | `shortcut-pause` | Sent by Alt+P global shortcut — toggles pause/resume in RECORDING/PAUSED states |
| renderer → main | `update-menubar-state` | Maps STATES enum string → icon state (idle/recording/thinking/ready); drives menubar dot-pulse animation |
| renderer → main | `uninstall-promptly` | Shows native confirmation dialog, removes all data dirs + TCC entry, quits app |
| renderer → main | `get-stored-paths` | Returns `{ claudePath, whisperPath }` from `config.json` in userData — used by SettingsPanel |
| renderer → main | `save-paths` | Saves `{ claudePath, whisperPath }` to `config.json` and updates runtime vars — used by SettingsPanel |
| renderer → main | `browse-for-binary` | Opens macOS file picker (openFile); returns `{ path }` or `{ path: null }` — used by SettingsPanel |
| renderer → main | `recheck-paths` | Reruns `resolveClaudePath` + `resolveWhisperPath`; returns `{ claude: { ok, path }, whisper: { ok, path } }` |

---

## PATH resolution (critical — most common failure point)

**Rule:** Both `claude` and `whisper` binaries MUST be resolved via expanded search at startup, then cached. In packaged `.app` / `.dmg` builds the process environment does not load the user's shell PATH, so a direct `which` call is unreliable.

**Shell scripts rule (BUG-RELEASE-NODE-PATH — 2026-04-28):** `scripts/release.sh` (and any future dev scripts that call `node`/`npx`/`npm`) MUST source nvm at the top before any node calls. Running `bash <script>` skips `.zshrc`/`.bashrc`, so nvm's shim directory is not in PATH. Pattern:
```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
command -v node >/dev/null 2>&1 || fail "node not found"
```

**Pattern (BUG-012 + BUG-017 — 2026-04-23):**
```js
// 1. Check static common paths (fs.existsSync — no shell needed)
//    Includes: /usr/local/bin, /opt/homebrew/bin, ~/.local/bin, ~/.npm-global/bin,
//              ~/.volta/bin, ~/n/bin (node version managers)
// 2. Dynamic nvm scan — enumerate ~/.nvm/versions/node/*/bin/{binary}
//    Required because nvm installs under a version-keyed path not in any static list
// 3. Shell fallback with explicit NVM_DIR initialization
//    Plain `zsh -lc "which X"` silently fails for nvm users in packaged apps;
//    must source nvm.sh explicitly so nvm's PATH entries are present
// 4. For whisper only: fall back to python3 -m whisper
async function resolveXPath() {
  const home = os.homedir();
  for (const p of commonPaths) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  const nvmDir = path.join(home, '.nvm', 'versions', 'node');
  try {
    if (fs.existsSync(nvmDir)) {
      for (const version of fs.readdirSync(nvmDir)) {
        const bin = path.join(nvmDir, version, 'bin', 'X');
        try { if (fs.existsSync(bin)) return bin; } catch {}
      }
    }
  } catch {}
  return new Promise((resolve) => {
    const nvmInit = `export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; which X`;
    exec(`zsh -lc '${nvmInit}'`, (err, stdout) => {
      if (!err && stdout.trim()) { resolve(stdout.trim()); return; }
      exec(`bash -lc '${nvmInit}'`, (err2, stdout2) => {
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

## Window lifecycle (BUG-018 — 2026-04-23)

**Rule:** The app window must never be destroyed when the user closes it — it must hide instead. A single-instance lock prevents multiple app copies.

### Four required patterns (all in `main.js`):

1. **`isQuitting` flag** — module-scope boolean, default `false`.
   ```js
   let isQuitting = false
   app.on('before-quit', () => { isQuitting = true })
   ```

2. **`win.on('close')` hide-intercept** — in `createWindow()`, after `win` is created:
   ```js
   win.on('close', (e) => {
     if (!isQuitting) { e.preventDefault(); win.hide() }
   })
   ```
   Without this, clicking ✕ destroys `win` and crashes on the next tray-icon click.

3. **Single-instance lock** — before `app.whenReady()`:
   ```js
   if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0) }
   app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus() } })
   ```

4. **`win.on('blur')` auto-hide** — hides the floating bar when user clicks outside it:
   ```js
   win.on('blur', () => { if (!isQuitting && win && !win.isDestroyed()) win.hide() })
   ```

**Tray quit:** Tray "Quit" item must call `app.quit()` (not `win.destroy()`). `before-quit` sets `isQuitting=true` before the `close` event fires, allowing the window to close normally.

---

## Microphone permission (critical — two separate layers)

**Rule:** Microphone access in Electron on macOS goes through TWO independent layers. Both must be configured. Missing either one causes repeated permission dialogs.

### Layer 1 — macOS TCC (system level)
`systemPreferences.askForMediaAccess('microphone')` — native macOS API. Creates a persistent TCC entry for the app. Returns `true` immediately if already granted (safe to call before every recording).
- Called in **splash** (`check-mic-status` IPC) — user sees the dialog once at a controlled time.
- Called in **`request-mic` IPC** — `startRecording()` and `handleIterate()` in App.jsx call this before every `getUserMedia` to ensure TCC is current.

### Layer 2 — Electron/Chromium (renderer level)
`getUserMedia` in the renderer goes through Chromium's own permission system before reaching macOS. Two handlers must BOTH be set in `app.whenReady()`:

```js
// Step 1 — check: "do I already have this?" — must return true to skip re-prompting
session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
  return permission === 'media';
});
// Step 2 — request: handles any fresh request that still comes through
session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
  callback(permission === 'media');
});
```

**If only `setPermissionRequestHandler` is set** (without the check handler), Chromium treats every `getUserMedia` call as a new request and re-prompts — even in the same session.

### Unsigned build rule
`dist:unsigned` must pass `--config.mac.hardenedRuntime=false`. Hardened runtime entitlements (`com.apple.security.device.audio-input`) only apply to signed builds. An unsigned build with `hardenedRuntime: true` runs under hardened runtime restrictions *without* the entitlements that would lift them — causing TCC entries to not persist between launches.

> See DECISIONS.md D-BUG-013 for full diagnosis.

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
| Polish | `polish` | Standalone — clean polished prose + change notes; bypasses PROMPT_TEMPLATE; `{TONE}` replaced via `options.tone`; green accent in UI |
| Image | `image` | Three-phase flow (v2 — 2026-04-30): generate-prompt passthrough → Phase 1 generate-raw (Claude pre-fills nested 5-tab schema: subject/lighting/camera/style/technical → imageDefaults) → IMAGE_BUILDER review screen; Phase 1.5 generates 3 prompt variations in background (no await); Phase 2 generate-raw (selected variation + confirmed params → assembled natural-language prompt + Nano Banana `--ar --stylize --chaos` flags) → IMAGE_BUILDER_DONE; purple accent in UI |
| Video | `video` | Two-phase flow: Phase 1 generate-raw (Claude pre-selects video params as JSON) → VIDEO_BUILDER review screen → Phase 2 generate-raw (Claude assembles Veo 3.1 natural-language prompt) → VIDEO_BUILDER_DONE; orange accent in UI |
| Workflow | `workflow` | Two-phase flow: Phase 1 generate-raw (Claude maps spoken idea to n8n nodes as JSON → workflowAnalysis) → WORKFLOW_BUILDER review/fill screen → Phase 2 generate-raw (Claude outputs complete n8n workflow JSON) → WORKFLOW_BUILDER_DONE; green accent in UI |

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

- [ ] Adding runtime npm dependencies — zero runtime deps in the packaged .app is a hard constraint (React, Vite, Tailwind are devDeps that are compiled out; new runtime deps require a DECISIONS.md entry)
- [ ] Using `nodeIntegration: true` — always use contextBridge/preload instead
- [ ] Using `dangerouslySetInnerHTML` with any user-provided or Claude-generated text — use JSX text nodes
- [ ] Calling `exec('claude ...')` without the cached login-shell-resolved path
- [ ] Storing any sensitive data (API keys, tokens) — Claude CLI handles auth, nothing in app
- [ ] Accessing `localStorage` directly outside the hook wrappers (`useMode`, `useTone`, `utils/history.js`)
- [ ] Mutating `originalTranscript.current` after it is captured in `stopRecording` — regenerate must always use original
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
