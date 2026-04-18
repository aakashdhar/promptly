# TASKS — Promptly
> macOS floating bar that turns speech into structured Claude prompts.
> For BetaCraft team members already on Claude CLI — zero setup, zero friction.
> One file to watch. Updated after every task.

---

## Phase 1 — Foundation
> No user-facing features. Sets up the Electron shell that all UI features depend on.
> Phase 1 exit: run `review: phase 1` when all tasks complete.

- [x] P1-001 · package.json — electron v31+, electron-builder config, start + dist + lint scripts, no runtime deps
- [x] P1-002 · entitlements.plist — microphone entitlement for hardened runtime (required for webkitSpeechRecognition)
- [x] P1-003 · main.js skeleton — BrowserWindow: frameless, vibrancy, alwaysOnTop, contextIsolation, 480px wide
- [x] P1-004 · preload.js skeleton — contextBridge with placeholder electronAPI methods (all 5 IPC channels stubbed)
- [x] P1-005 · index.html skeleton — valid HTML5, empty body, system font applied, window opens without errors
- [x] P1-006 · PATH resolution — exec('zsh -lc "which claude"') at app-ready, cache to claudePath, log result
- [x] P1-007 · Global shortcut — register ⌥Space (fallback ⌃\` if taken), send shortcut-triggered to renderer, log in console
- [x] P1-008 · IPC channel stubs — all 5 channels in ipcMain: generate-prompt, copy-to-clipboard, check-claude-path return placeholder
- [x] P1-009 · Smoke test + CODEBASE.md — npm start opens window, shortcut fires console log, claudePath visible; populate CODEBASE.md

## Phase 1 gate
✅ review: phase 1 — reviewed 2026-04-18 — Score 7.9/10 (B) — 0 P0, 3 P1 fixed inline, 3 P2 logged to backlog

---

## Phase 2 — Core features
> Build order is deliberate — features are sequenced by dependency.
> A feature marked [needs: X] cannot start until X is complete.
> Features marked [parallel with: X] can run simultaneously.
> Phase 2 exit: run `review: phase 2` when all features complete.

⬜ **F-STATE — State machine + full UI skeleton**
   Build order: 1 · No dependencies · Start here after Phase 1 gate passes
   What you can do when done: Bar renders all 6 states on command; transitions are instant and correct
   Shared data: establishes currentState var and setState() used by every subsequent feature
   Spec: run `feature: state-machine` to plan this feature in detail

⬜ **F-FIRST-RUN — First-run setup checklist**
   Build order: 2 · Needs: F-STATE complete
   Parallel with: F-SPEECH (no shared writes)
   What you can do when done: First launch shows CLI check + mic permission steps; completion transitions to IDLE
   Shared data: reads claudePath (Phase 1), writes firstRunComplete to localStorage
   Spec: run `feature: first-run` to plan this feature in detail

⬜ **F-SPEECH — Speech recording**
   Build order: 2 · Needs: F-STATE complete
   Parallel with: F-FIRST-RUN (no shared writes)
   What you can do when done: Press shortcut → bar records speech → live transcript shown → stop → transcript ready
   Shared data: writes originalTranscript (read by F-CLAUDE and F-ACTIONS)
   Spec: run `feature: speech-recording` to plan this feature in detail

⬜ **F-CLAUDE — Claude CLI integration + 5 prompt modes**
   Build order: 3 · Needs: F-SPEECH (originalTranscript) + F-FIRST-RUN (claudePath confirmed) complete
   What you can do when done: Speak → generate → THINKING spinner → PROMPT_READY with structured prompt; right-click to switch modes; mode label in idle bar
   Shared data: reads originalTranscript; writes generatedPrompt (read by F-ACTIONS); reads/writes mode in localStorage
   Spec: run `feature: claude-integration` to plan this feature in detail

⬜ **F-ACTIONS — Copy, Edit, Regenerate**
   Build order: 4 · Needs: F-CLAUDE (generatedPrompt in PROMPT_READY state) complete
   What you can do when done: Copy flashes green 1.8s and writes to clipboard; Edit goes contenteditable with Escape/Done; Regenerate re-runs from originalTranscript
   Shared data: reads generatedPrompt and originalTranscript; copy writes to system clipboard
   Spec: run `feature: actions` to plan this feature in detail

## Phase 2 gate
⬜ review: phase 2 — pending

---

## Phase 3 — Polish and hardening
> Runs after Phase 2 gate passes. No new features.
> Phase 3 exit: run `review: final` — 0 P0 + 0 P1 before distributing.

⬜ Error state audit — verify all 9 error messages surface correctly with right text; all tap-to-dismiss
⬜ Manual smoke test — exercise all 6 states × all 5 modes; check shortcut conflict notice; verify no hangs
⬜ Build verification — npm run dist produces universal .dmg; install and run on Apple Silicon; verify on Intel if available
⬜ Distribution prep — write 5-line Slack message (what it does, download link, two clicks to start, example use case)

## Final gate
⬜ review: final — pending

---

## Phase 4+ — Future (not in current build)
> Planned so Phase 1-3 architecture doesn't foreclose these.
> Run `brainstorm:` when ready to plan the next version.

⬜ Prompt history / library — persist and browse past generated prompts · planned for v2
⬜ Menu bar / tray icon — always-visible quick access · planned for v2
⬜ Auto-paste into active app — copy + switch + paste automation · evaluate after v1 stickiness confirmed
⬜ Dark mode — follow macOS appearance setting · planned for v2
⬜ Custom shortcuts — user-configurable hotkey · planned for v2
⬜ Multi-language speech — non-English webkitSpeechRecognition · planned for v2
⬜ Broader distribution — notarisation, Sparkle auto-update, public landing page · if v1 stickiness confirmed

---

## What just happened
Phase 1 review complete. Score 7.9/10 (B). 3 P1 IPC contract bugs fixed inline (generate-prompt arg shape, check-claude-path missing `found`, window not positioned). 3 P2 findings logged to backlog. Phase 1 gate ✅ passed.

## What's next
⬜ Phase 2 begins — run `feature: state-machine` to plan F-STATE (no dependencies, start here)

Read `CLAUDE.md`, then `vibe/CODEBASE.md`, then `vibe/ARCHITECTURE.md`, then `vibe/SPEC_INDEX.md`, then `vibe/TASKS.md`.
Confirm the first task before writing any code. Say **"next"** after each task.
Run **`review: phase 1`** when all Phase 1 tasks are complete.
