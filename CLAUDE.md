# CLAUDE.md — Promptly
> Promptly is a macOS menu bar app: speak or type what you want and get it done — the finished reply, rewrite or answer (Do it, the default), or a structured prompt, email, image/video prompt or n8n workflow — using the Claude Code CLI. It can use the text you've selected or a screenshot of the window you're in.
> Electron 41 · React 19 + Vite 8 + Tailwind 4 renderer · main process split into `main/` modules · built-in whisper.cpp for transcription · light/dark themes.

---

## Session startup

1. Read this file.
2. Read `vibe/ARCHITECTURE.md` — the rules every change is measured against.
3. Read `vibe/CODEBASE.md` — current file map.
4. Skim the end of `vibe/TASKS.md` for what just happened.
5. Check the Gotchas section of `vibe/CODEBASE.md` before touching an area it mentions.

---

## Project structure

```
promptly/
├── main.js              ← Electron wiring: windows, tray, shortcuts, IPC handlers
├── main/                ← main-process logic, no Electron imports, unit-tested
│   ├── llm.js           ←   every Claude CLI call (stdin prompt, --model, cancel, timeouts)
│   ├── whisper.js       ←   transcription: built-in whisper.cpp (default), Python Whisper fallback
│   ├── claude-setup.js  ←   Claude Code status, install/sign-in via Terminal
│   ├── helper.js        ←   runs native/helper (hold to talk, frontmost app, selected text)
│   ├── hotkey.js        ←   hotkey presets + hold-vs-tap state machine
│   ├── screenshot.js    ←   screenshot of the window you're talking about (Screen Recording)
│   ├── shortcuts.js     ←   globalShortcut fallback registration
│   ├── binaries.js      ←   claude/whisper/ffmpeg lookup, makeClaudeEnv
│   ├── platform/        ←   darwin.js holds every macOS path/command
│   ├── prompts.js       ←   builds prompts from prompts/*.txt + shared/modes.json
│   ├── prompts/         ←   prompt text, one file per standalone mode, template.txt, eval.txt
│   ├── config.js        ←   config.json (atomic writes)
│   ├── log.js           ←   ~/Library/Logs/Promptly/main.log
│   └── tray-icon.js     ←   menu bar icon
├── shared/modes.json    ← the one mode list (main + renderer)
├── preload.js           ← contextBridge → window.electronAPI
├── splash.html          ← setup wizard (vanilla HTML/JS, not React)
├── pill.html            ← floating pill shown while talking from another app
├── native/helper/       ← promptly-helper (Swift): hotkey down/up, frontmost app, selected text
├── src/renderer/        ← React app: App.jsx state machine, hooks/, components/, utils/
├── tests/               ← Vitest unit tests + IPC contract test
├── e2e/                 ← Playwright tests driving the real app with a fake Claude CLI
├── scripts/             ← release, signing, preflight
└── vibe/                ← specs, decisions, reviews, TASKS.md
```

---

## Commands

```bash
npm run fetch-whisper # build whisper.cpp + download the model into vendor/ (once)
npm run build-helper  # build native/helper into vendor/helper (swiftc, universal)
npm run start:react   # build the renderer and run the app
npm run dev           # Vite dev server for the renderer only
npm run lint          # ESLint over the whole repo — must have 0 errors
npm test              # Vitest unit tests
npm run test:e2e      # build + Playwright end-to-end tests (fake Claude/Whisper, throwaway profile)
                      #   includes e2e/ui.spec.mjs: screenshots of every screen in both themes + layout audit
npm run preflight     # local tool + codebase checks (release.sh runs this)
npm run release -- X.Y.Z   # signed DMG (see scripts/release.sh)
```

---

## Architecture rules

1. **AI = Claude Code CLI only.** Everything that needs AI runs `claude -p` through `main/llm.js`. Never add the Anthropic API or SDK, API keys, or a backend proxy — this is a product decision, not a stopgap (see DECISIONS.md D-CLI-ONLY). Claude calls go through `main/llm.js` only. It passes the prompt on stdin, always sends `--model`, and uses `makeClaudeEnv(claudePath)`. Never spawn `claude` anywhere else (preflight CHECK 7 enforces `makeClaudeEnv`).
2. **External binaries** run with `execFile`/`spawn` and an argument array. Never build a shell string containing a path.
3. **Binary paths** resolve at startup via `main/binaries.js`; macOS-specific locations belong in `main/platform/darwin.js`.
4. **Modes** are defined once in `shared/modes.json`. Prompt text lives in `main/prompts/`. Don't hardcode mode lists or prompt text in code.
5. **IPC**: renderer talks to main only through `window.electronAPI` from `preload.js`. Adding a channel means a preload method + an `ipcMain.handle`; `tests/ipc-contract.test.js` fails if they drift.
6. **State**: all renderer state changes go through `transition()` in App.jsx. Use `stateRef.current` (not `currentState`) inside event handlers. Async work tags itself with `opIdRef` so aborted or superseded results are ignored.
7. **Security**: `contextIsolation: true`, `nodeIntegration: false`. No `dangerouslySetInnerHTML` with user or Claude text.
8. **Colours and type**: use theme tokens from `src/renderer/index.css` — `rgba(var(--ink), a)` for lines/fills and primary text (a ≥ 0.75), `var(--text-secondary)`/`var(--text-tertiary)` for quieter text (never a lower ink alpha), `var(--bg)`/`var(--surface)` for backgrounds, `var(--on-accent)` for text on coloured buttons, and `readableColor()` for mode-coloured text. Never hardcode white-on-dark. Type scale 11/12/13/14/15/17 px; nothing under 11 px. `npm run test:e2e` fails if a screen has cut-off text, cramped edges, overlaps or low contrast.
9. **Storage**: localStorage only via `useMode()`, `useTone()`, `utils/history.js`. App settings (paths, model, window bounds) live in `config.json` via `main/config.js`.
10. **Dependencies**: zero runtime npm dependencies in the packaged app. Dev dependencies are fine; new runtime ones need a DECISIONS.md entry.
11. **Packaging**: a new top-level folder the app needs at runtime must be added to `build.files` in package.json.

---

## Code style

- Main process: CommonJS, `'use strict'`. Renderer: ES modules, functional React components, one per file.
- camelCase functions, SCREAMING_SNAKE_CASE constants and state names (`'PROMPT_READY'`), kebab-case IPC channels.
- Inline styles for dynamic values; Tailwind for static layout.
- `WebkitAppRegion: 'no-drag'` on every clickable element inside drag regions.
- Comments explain why, not what.

---

## Before committing

1. `npm run lint` — 0 errors.
2. `npm test` — all passing.
3. `npm run test:e2e` if you touched main.js, preload.js, App.jsx or a hook in the recording/typing/generation path.
4. Code and doc commits are separate. Conventional commit messages (`feat`, `fix`, `refactor`, `test`, `chore`, `docs`).
5. Update `vibe/CODEBASE.md` when you add a file, IPC channel or module; log real design changes in `vibe/DECISIONS.md`.

---

## Known gaps (tracked in the Promptly Roadmap)

- App.jsx still threads refs through ~12 hooks; a reducer/state-machine refactor is planned once e2e covers the expanded view and builders.
- Renderer-side prompts (image/video/workflow builders, iteration, email tone adjust) still live in hooks, not `main/prompts/`.
- Requires Claude Code (by design, D-CLI-ONLY); setup installs or signs in to it from inside the app.
- Self-signed, shared personally: first open needs System Settings → Open Anyway (no Apple Developer account; notarization and auto-update are backlogged).

---

## Execution mode
VIBE_MODE=manual

