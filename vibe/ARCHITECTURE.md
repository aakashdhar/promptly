# ARCHITECTURE.md — Promptly
> Created: 2026-04-18 via architect: | Last updated: 2026-09-24
> Source: BRIEF.md + architect: conversation decisions
> ⚠️ This is the agent's constitution. Every code decision is measured against it.

---

## Project type

**Type:** Desktop app (Electron)
**Platform:** macOS only today — always-on-top floating bar. Windows is planned; all OS-specific main-process code lives in `main/platform/darwin.js` so a `win32.js` can slot in.
**Stack (as-built):**
  Shell:    Electron 41, universal binary (arm64 + x64)
  Frontend: React 19 + Vite 8 — `src/renderer/` → built to `dist-renderer/` (devDeps only)
  Styling:  Tailwind v4 for static classes; inline styles for dynamic layout; theme tokens in index.css (light/dark/system)
  Speech:   MediaRecorder → 16 kHz WAV in the renderer → `transcribe-audio` → built-in whisper.cpp (`main/whisper.js`); Python Whisper fallback
  LLM:      Claude Code CLI `claude -p` through `main/llm.js` — prompt on stdin, `--model` always passed
            CLI only by design: no Anthropic API/SDK, no API keys (D-CLI-ONLY)
  IPC:      Electron ipcMain + preload.js contextBridge; contract enforced by `tests/ipc-contract.test.js`
  Storage:  `config.json` in userData (paths, model, window bounds) + localStorage (mode, tone, history)
  Dist:     electron-builder → .dmg (arm64 + x64)
  Backend:  None — Claude CLI is the AI layer

> Runtime npm dependencies: zero — React/Vite/Tailwind are devDeps compiled into dist-renderer/.
> Any new runtime dependency requires a DECISIONS.md entry.
> 📝 2026-09-24 · Stack updated — main process split into main/ modules; shared mode registry; tests + e2e (see D-FOUNDATION in DECISIONS.md)

---

## Folder structure

```
promptly/
├── main.js             # Electron wiring only: windows, tray, shortcuts, IPC handlers
├── main/               # Main-process logic, no Electron imports (unit-testable)
│   ├── llm.js          #   Claude CLI runner — stdin prompt, --model, lean flags, cancel, timeouts
│   ├── whisper.js      #   Whisper transcription + model download
│   ├── binaries.js     #   claude/whisper/ffmpeg path resolution, makeClaudeEnv
│   ├── platform/       #   darwin.js — every macOS path/command; index.js picks the platform
│   ├── prompts.js      #   Builds mode + eval prompts from prompts/*.txt and shared/modes.json
│   ├── prompts/        #   Prompt text, one file per standalone mode + template.txt + eval.txt
│   ├── config.js       #   config.json store with atomic writes
│   ├── log.js          #   ~/Library/Logs/Promptly/main.log with rotation
│   └── tray-icon.js    #   Menu bar microphone icon drawing
├── shared/modes.json   # Single mode registry, read by main and renderer
├── preload.js          # contextBridge — exposes window.electronAPI (sandboxed)
├── splash.html         # Setup wizard / quick-check splash, vanilla HTML/JS
├── src/renderer/       # React app (App.jsx state machine, hooks/, components/, utils/)
├── tests/              # Vitest unit tests (npm test)
├── e2e/                # Playwright tests that drive the real app with a fake Claude CLI (npm run test:e2e)
├── scripts/            # release, signing, preflight checks
├── package.json        # electron-builder config; devDeps only
└── entitlements.plist  # Mic permission for hardened runtime
```

**Rules:**
- All UI lives in `src/renderer/`. One component per file. Functional React components only.
- `main.js` wires Electron (windows, tray, shortcuts, IPC). Logic goes in a `main/` module that does not import Electron, with a unit test.
- macOS-specific paths and commands go in `main/platform/darwin.js`, never inline.
- `preload.js` is the only bridge between renderer and main.
- New files under `main/` or `shared/` are packaged via `build.files` in package.json — check it when adding a top-level folder.

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

**States (18 total — 6 original + SHORTCUTS, HISTORY, PAUSED, ITERATING, TYPING, SETTINGS, IMAGE_BUILDER, IMAGE_BUILDER_DONE, VIDEO_BUILDER, VIDEO_BUILDER_DONE, WORKFLOW_BUILDER, WORKFLOW_BUILDER_DONE, TRANSCRIPTION_ERROR, GENERATION_ERROR, EMAIL_READY added via features):**
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
RECORDING (email mode) → THINKING → EMAIL_READY (FEATURE-EMAIL-MODE)
THINKING (expanded, transcription fail) → TRANSCRIPTION_ERROR (FEATURE-ONBOARDING-WIZARD)
THINKING (expanded, generation fail) → GENERATION_ERROR (FEATURE-ONBOARDING-WIZARD)
```
> 📝 2026-04-29 · State count updated 15→17: TRANSCRIPTION_ERROR + GENERATION_ERROR added via FEATURE-ONBOARDING-WIZARD
> 📝 2026-05-19 · State count updated 17→18: EMAIL_READY added via FEATURE-EMAIL-MODE

**One window (D-ONE-WINDOW, 2026-09-24):**
- App.jsx renders a single `<ExpandedView>` for every state; the compact bar and its per-state components are gone. `isExpandedRef` survives only as a constant `true` for hooks that still read it.
- `ExpandedView` owns: top transport bar (record/stop/pause/waveform), left session-history panel, right state-content panel. All state-driving callbacks (onStart, onStop, onPause, onRegenerate, onReset, onIterate) are passed as props from App.jsx — no new IPC channels.

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

`tests/ipc-contract.test.js` fails if preload and main drift apart (a channel without a handler, a handler not exposed, an event nobody listens for, or a renderer call to a method preload doesn't expose).

| Direction | Channel | Purpose |
|-----------|---------|---------|
| renderer → main | `generate-prompt` | Transcript + mode + options (`tone`, `overrideSystemPrompt`) → Claude. Builder modes pass the transcript through. Stored as the last request for retry |
| renderer → main | `generate-raw` | Full custom prompt → Claude (builders, iteration) |
| renderer → main | `retry-generation` | Replays the last `generate-prompt` request with the same mode and options |
| renderer → main | `cancel-operations` | Kills the Claude/Whisper processes behind the current operation (abort) |
| renderer → main | `evaluate-prompt` | Eval scorecard: raw vs Promptly output → JSON scores. Runs on its own process set, not cancelled by abort |
| renderer → main | `transcribe-audio` | Audio ArrayBuffer → Whisper → transcript. Audio kept only until success or the next recording |
| renderer → main | `retry-transcription` | Re-runs Whisper on the kept audio |
| renderer → main | `copy-to-clipboard` | Write text to the clipboard |
| renderer → main | `save-file` | Native save dialog + write |
| renderer → main | `show-mode-menu` | Native mode menu (right-click / ⌘,) built from shared/modes.json |
| renderer → main | `show-tone-menu` | Native Formal/Casual menu for Polish |
| renderer → main | `update-menubar-state` | App state → menu bar icon, hide-on-blur rules, Option+P registration |
| renderer → main | `set-last-prompt` | Last prompt for the tray "Copy last prompt" item |
| renderer → main | `get-theme` | `{ dark }` |
| renderer → main | `get-stored-paths` | Paths, `claudeModel` and `modelOptions` for Settings |
| renderer → main | `save-paths` | Save any of `claudePath`, `whisperPath`, `ffmpegPath`, `claudeModel` |
| renderer → main | `browse-for-binary` | Native file picker |
| renderer → main | `recheck-paths` | Re-resolve all three binaries |
| renderer → main | `reopen-wizard` | Show the setup wizard again |
| splash → main | `request-microphone` / `open-microphone-settings` | Mic permission status (prompt only when asked) / open the Privacy pane |
| splash → main | `claude-status` / `claude-install` / `claude-login` | Claude Code status; open Terminal with the installer or `claude auth login` |
| renderer → main | `get-theme-setting` / `set-theme-setting` | Appearance: system / light / dark |
| renderer → main | `get-preferences` / `set-preferences` | Hotkey preset, dictionary, auto-copy, launch at login, Accessibility status |
| renderer/splash → main | `request-accessibility` / `accessibility-status` / `open-accessibility-settings` | Hold to talk + selected text permission |
| pill → main, main → renderer | `pill-action` ('make-prompt') / `make-prompt` event | The pill's "Make it a prompt" after a dictation from another app: opens the window and converts it there |
| renderer → main | `record-edit` / `clear-edits` / `learn-style` | It writes like you: log an edit to a result, forget edits, draft "How you write" notes (voiceNotes / aboutMe themselves go through get/set-preferences) |
| renderer → main (send) | `audio-level` / `mode-changed` | Mic level for the pill waveform; current mode label for the pill |
| main → renderer | `hotkey-start` / `hotkey-stop` / `hotkey-cancel` | Hold-to-talk / tap decisions from main |
| main → renderer | `recording-context` | App + selected text captured when a hotkey recording started |
| main → renderer | `generation-delta` | Streaming text while Claude writes |
| main → renderer/splash | `accessibility-changed` | Helper trust/tap status changed |
| main → pill | `pill-state` / `audio-level` | Pill: recording / thinking / copied / hidden, and waveform |
| splash → main | `splash-done` | Hide splash, show bar, register shortcut + tray (once) |
| splash → main | `splash-check-cli` / `splash-check-whisper` | Quick checks (Whisper check honours a custom ffmpeg path) |
| splash → main | `splash-open-url` | Open an https:// install link |
| splash → main | `check-setup-complete` / `set-setup-complete` | `setupComplete` in config.json |
| splash → main | `check-claude` | Version + a real `READY` test through `main/llm.js` |
| splash → main | `check-whisper` / `check-ffmpeg` | Run the binary to verify it works |
| splash → main | `check-whisper-model` / `download-whisper-model` | Model presence (same model transcription uses) and download |
| main → renderer | `shortcut-pause` | Option+P while recording |
| main → renderer | `mode-selected` / `tone-selected` | Native menu choices |
| main → renderer | `show-shortcuts` / `show-history` / `open-settings` | Menu and tray actions |
| main → renderer | `theme-changed` | macOS appearance changed |
| main → renderer | `transcription-slow-warning` / `generation-slow-warning` | Slow-operation banners |
| main → splash | `whisper-download-progress` | Model download progress |

> 📝 2026-09-24 · Removed unused channels: check-claude-path, resize-window-width, reset-setup-complete, uninstall-promptly (tray calls it directly), request-mic, check-mic-status, shortcut-conflict (now a macOS notification). Added cancel-operations.

---

## PATH resolution (critical — most common failure point)

**Rule:** `claude`, `whisper` and `ffmpeg` are resolved at startup and cached, because a packaged `.app` does not inherit the user's shell PATH.

**Where:** `main/binaries.js` (order of lookup) + `main/platform/darwin.js` (the actual locations and shell commands).

**Order:** path saved in Settings → well-known locations → every `~/.nvm/versions/node/*/bin` → login shell (`zsh -lc`, then `bash -lc`, with nvm sourced). Whisper additionally falls back to `python3 -m whisper` and resolves pyenv shims to the real binary.

**Running Claude:** always through `main/llm.js`, which passes `makeClaudeEnv(claudePath)` (adds the binary's own dir and its symlink target dir to PATH so `node` is found for nvm installs) and `--model`. Preflight CHECK 7 fails any Claude spawn/execFile in `main.js` or `main/` without `makeClaudeEnv`.

**Shell scripts rule (BUG-RELEASE-NODE-PATH — 2026-04-28):** `scripts/release.sh` and any script calling `node`/`npx`/`npm` must source nvm first:
```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
command -v node >/dev/null 2>&1 || fail "node not found"
```

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

4. **One normal window, plus the pill** (D-ONE-WINDOW) — the main window is a regular macOS window (not always on top, resizable, opens at 940×600 or where you left it; `windowBounds` in config.json). It doesn't hide when you switch apps. Talking via the shortcut while the window isn't the focused app happens in the floating pill; results made that way stay out of your way (pill: "Copied · Open" or, for dictation, "Typed · Make it a prompt"). Builders and errors bring the window forward.

**Tray quit:** Tray "Quit" item must call `app.quit()` (not `win.destroy()`). `before-quit` sets `isQuitting=true` before the `close` event fires, allowing the window to close normally.

---

## Microphone permission (critical — two separate layers)

**Rule:** Microphone access in Electron on macOS goes through TWO independent layers. Both must be configured. Missing either one causes repeated permission dialogs.

### Layer 1 — macOS TCC (system level)
macOS shows its microphone prompt the first time `getUserMedia` runs (the `NSMicrophoneUsageDescription` string in package.json is what it displays). The TCC entry then persists for the signed app.
> 📝 2026-09-24 · The `request-mic` / `check-mic-status` IPC described here earlier were never called and have been removed.

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
| Email | `email` | Standalone — speak email situation → Claude drafts ready-to-send email (subject + body + tone analysis) as JSON → EMAIL_READY two-column output; always auto-expands (mode-selected IPC triggers handleExpand); output IS the email, no prompt intermediary; teal accent `rgba(20,184,166)` in UI; added FEATURE-EMAIL-MODE |

- The mode list (keys, labels, descriptions, colours, kind) lives in `shared/modes.json` and is read by main (prompt building, native menu) and the renderer (`useMode`, `ModeDropdown`). Add or change a mode there.
- Prompt text lives in `main/prompts/`: `template.txt` for template modes (filled with the registry's `promptName` + `instruction`), `<key>.txt` for standalone modes, `eval.txt` for the scorecard. Placeholders are filled in a single pass (`fillTemplate`).
- Mode is chosen from the mode pill dropdown or right-click / ⌘, (native menu). Persisted in localStorage via `useMode()`.
- Renderer-side prompts (image/video/workflow builders, iteration, email tone adjust) still live in their hooks.
---

## Testing philosophy

| Type | Scope | Command | When |
|------|-------|---------|------|
| Unit | `main/` modules, prompt building, output parsing, renderer utils, IPC contract | `npm test` (Vitest) | Every change; CI |
| End-to-end | The real app driven by Playwright with fake `claude`/`whisper` scripts and Chromium's fake mic: typing, voice, abort, hotkey, hide-on-blur, retry, settings checks | `npm run test:e2e` | Before merging changes to flows or main.js |
| Preflight | Local tool reachability + codebase assertions | `npm run preflight` | Before release (release.sh runs it) |
| Manual smoke | Anything the e2e suite doesn't cover yet (expanded view, builders, history) | Run the app | Before release |

**Rules:**
- New logic in `main/` gets a unit test. New IPC channels are covered automatically by the contract test.
- A flow change gets an e2e test when it can be driven with the fake CLI.
- E2E runs use `PROMPTLY_USER_DATA` (a throwaway profile), never your real config or shortcuts.

---

## Code quality

**Linter:** ESLint 9 flat config over the whole repo (`npm run lint`): main process, preload, `main/`, scripts, tests and the React renderer (eslint-plugin-react + react-hooks: `rules-of-hooks` is an error, `exhaustive-deps` a warning because of the ref-based state design).
- Lint errors block commits; CI runs lint, unit tests and the renderer build.

**Git conventions:**
- Conventional commits: `feat(scope)`, `fix(scope)`, `refactor(scope)`, `test(scope)`, `chore(scope)`, `docs(scope)`
- Branches off `main`: `feature/…`, `fix/…`
- Doc commits separate from code commits

**Dependencies:**
- Zero runtime npm dependencies in the packaged app.
- `npm audit` must show no high/critical issues. Electron and electron-builder are pinned to exact versions.

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
- Run Claude only through `main/llm.js` (cached `claudePath`, `makeClaudeEnv`, `--model`, prompt on stdin)
- Run external binaries with `execFile`/`spawn` and an argument array — never a shell string with a path in it
- All renderer state changes go through `transition()` in App.jsx
- Mode data comes from `shared/modes.json`; prompt text from `main/prompts/`
- Render user-provided or Claude-generated text as JSX text nodes

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
- [ ] Calling the Anthropic API/SDK or storing API keys — all AI goes through the Claude Code CLI (D-CLI-ONLY)
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
| Main process layout | `main.js` wiring + Electron-free `main/` modules | Testable logic; OS code isolated for a Windows port | 2026-09-24 |
| Claude invocation | stdin prompt, `--tools ""`, `--no-session-persistence`, `--strict-mcp-config`, minimal `--system-prompt` | No argv limits, no agent session per prompt, cleaner plain-text output; falls back on older CLIs | 2026-09-24 |
| Testing | Vitest unit + Playwright e2e with a fake CLI | Flows can be verified without a person or real Claude calls | 2026-09-24 |
| Window title bar | `titleBarStyle: 'hiddenInset'` + `trafficLightPosition` (not `frame: false`) | Traffic lights required per BRIEF.md; hiddenInset hides title bar while preserving traffic lights | 2026-04-18 |
| Waveform animation | `setInterval` + sine wave + noise in renderer | Visual only — Whisper is post-processing, no real-time audio stream available; no Web Audio API needed | 2026-04-18 |

---

## Changelog

> Updated by architect: when decisions change.
> 2026-04-18 — Initial ARCHITECTURE.md created via architect: from BRIEF.md
> 📝 2026-04-18 · Scope change D-003 — speech engine changed from webkitSpeechRecognition to MediaRecorder + Whisper CLI; transcribe-audio IPC channel added
> 📝 2026-04-18 · Scope change D-004 — frame: false → titleBarStyle: hiddenInset + trafficLightPosition; 30-bar waveform pattern added
> 📝 2026-09-24 · Foundation pass — main process split into main/, shared mode registry, Claude via stdin, IPC contract + e2e tests, lint over the renderer, dead IPC removed (see DECISIONS.md D-FOUNDATION)
> 📝 2026-09-24 · Built-in whisper.cpp, in-app Claude Code setup, themes (see DECISIONS.md D-INSTALL, D-THEME)
> 📝 2026-09-24 · Hold to talk (native/helper), floating pill, destination-aware prompts, streaming (see DECISIONS.md D-WISPR)
