# PLAN.md — Promptly
> Created: 2026-04-18 | Source: SPEC.md + ARCHITECTURE.md + BRIEF.md
> ⚠️ The Feature Map (Section 6) is the build order authority for TASKS.md and vibe-add-feature.

---

## 1. Project overview

macOS floating bar (Electron) that records speech via Web Speech API, sends the transcript to `claude -p` CLI with a mode-specific system prompt, and returns a structured Claude prompt ready to copy. Zero configuration for BetaCraft team members already on Claude Code. v1 ships as a universal .dmg — internal distribution only.

**Success metric:** 5+ BetaCraft colleagues actively using after week 1, sticking with it.

---

## 2. Tech stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Shell | Electron v31+ | Native window APIs, .dmg builder |
| Frontend | Vanilla HTML + CSS + JS | Single index.html — no build step |
| Speech | getUserMedia + MediaRecorder + Whisper CLI | Local transcription, no API key — D-003 replaced webkitSpeechRecognition |
| Prompt gen | claude -p via child_process | PATH via zsh login shell |
| IPC | ipcMain + contextBridge preload | Sandboxed renderer |
| Storage | localStorage | mode + firstRunComplete only |
| Distribution | electron-builder universal | arm64 + x64 .dmg |

**Runtime dependencies:** None. Only devDeps: electron, electron-builder.

---

## 3. Architecture

Source: vibe/ARCHITECTURE.md (read in full each session).

Key invariants:
- All UI in `index.html` — no external CSS/JS files
- `main.js` = window config, IPC handlers, PATH resolution, shortcut registration only
- `preload.js` = contextBridge only — exposes `window.electronAPI`
- State machine: `setState(newState, payload)` is the only DOM mutation point
- PATH resolved once at startup via `exec('zsh -lc "which claude"')` — result cached
- `originalTranscript` captured once at recording stop — immutable after

---

## 4. Data model

No database. All data is runtime or localStorage.

**In-memory (index.html module scope):**

| Variable | Description |
|----------|-------------|
| `currentState` | Active state: FIRST_RUN / IDLE / RECORDING / THINKING / PROMPT_READY / ERROR |
| `transcript` | Live/final transcript from current session |
| `originalTranscript` | Frozen at recording stop — regenerate always reads this |
| `generatedPrompt` | Claude output (may be mutated by Edit mode) |

**Cached in main.js:**

| Variable | Description |
|----------|-------------|
| `claudePath` | Resolved binary path — set at `app.ready`, used in every claude call |

**localStorage:**

| Key | Description |
|-----|-------------|
| `mode` | Active prompt mode string (default: `'balanced'`) |
| `firstRunComplete` | Boolean — skip first-run screen after completion |

**Shared data points across features:**
- `originalTranscript` — written by F3 (Speech), read by F4 (Claude) and F7 (Regenerate)
- `claudePath` — written by Phase 1 PATH resolution, read by F4 and F8 (first-run check)
- `mode` in localStorage — written by F4 mode selector, read by F4 (generate) and F7 (regenerate)
- `generatedPrompt` — written by F4 (Claude output), read by F5 (Copy), F6 (Edit), F7 (Regenerate display)
- `currentState` — written by every feature, read by every feature (via setState)

---

## 5. IPC surface

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `generate-prompt` | renderer → main | `{ transcript, mode }` → `{ success, prompt, error }` |
| `copy-to-clipboard` | renderer → main | `{ text }` → `{ success }` |
| `check-claude-path` | renderer → main | — → `{ found, path, error }` |
| `shortcut-triggered` | main → renderer | Global shortcut fired |
| `shortcut-conflict` | main → renderer | Primary shortcut taken, fallback active |

---

## 6. Feature Map — build order

This is the source of truth for Phase 2 ordering in TASKS.md.

```
Phase 1 complete (Electron shell + IPC skeleton + PATH resolution)
    ↓
[F-STATE] State machine + UI skeleton
    — all CSS tokens, all 6 states, setState(), DOM structure
    — no deps · must come first · everything else depends on this
    ↓
[F-FIRST-RUN] First-run setup     [F-SPEECH] Speech recording
    — needs: F-STATE                 — needs: F-STATE
    — parallel with: F-SPEECH        — parallel with: F-FIRST-RUN
    — shares: claudePath (read)      — writes: originalTranscript
    ↓                                ↓
[F-CLAUDE] Claude CLI integration + 5 modes
    — needs: F-SPEECH (originalTranscript), F-FIRST-RUN (claudePath confirmed)
    — writes: generatedPrompt
    ↓
[F-ACTIONS] Copy + Edit + Regenerate
    — needs: F-CLAUDE (generatedPrompt in PROMPT_READY state)
    — reads: generatedPrompt, originalTranscript
```

### Dependency rationale

| Feature | Depends on | Reason |
|---------|-----------|--------|
| F-STATE | Phase 1 only | setState() + DOM must exist before any other feature touches the UI |
| F-FIRST-RUN | F-STATE | Needs FIRST_RUN state and claudePath from Phase 1 PATH resolution |
| F-SPEECH | F-STATE | Needs RECORDING state, setState(), live transcript DOM |
| F-CLAUDE | F-SPEECH + F-FIRST-RUN | Needs originalTranscript (from speech) and claudePath confirmed |
| F-ACTIONS | F-CLAUDE | Needs generatedPrompt in PROMPT_READY state to act on |

### Parallel opportunities

- F-FIRST-RUN and F-SPEECH share no data writes → can run simultaneously after F-STATE

### What Phase 1-3 must NOT hard-code (for v2 compatibility)

- Mode system: string-keyed, not integer-indexed — new modes can be added without schema change
- `firstRunComplete` in localStorage — v2 may want a richer onboarding state (don't use `true`/`false` hardcoded in two places)
- IPC channel names as constants — avoid string literals scattered through code

---

## 7. Phase sketch

### Phase 1 — Foundation (no user-facing features)

Sets up the Electron shell that all UI features depend on.

1. `package.json` — electron + electron-builder config, scripts (start, dist), entitlements ref
2. `entitlements.plist` — microphone entitlement for hardened runtime
3. `main.js` skeleton — BrowserWindow config (frameless, vibrancy, alwaysOnTop, contextIsolation), app lifecycle
4. `preload.js` skeleton — contextBridge with placeholder electronAPI methods
5. `index.html` skeleton — DOCTYPE, meta charset, empty body (not styled yet)
6. PATH resolution — `exec('zsh -lc "which claude"')` at app-ready, cache to `claudePath`
7. Global shortcut — register ⌥Space, fallback ⌃\`, send `shortcut-triggered` to renderer
8. IPC channel stubs — all 5 channels registered in main.js (return null/error for now)
9. Smoke test: `npm start` opens window, console shows claudePath or error, shortcut fires IPC log

### Phase 2 — Core features (ordered by dependency)

Build order from Feature Map above:

1. **F-STATE** ✅ — State machine + full UI skeleton — spec in vibe/features/2026-04-18-state-machine/
2. **F-FIRST-RUN** 🔄 — first-run checklist screen — spec in vibe/features/2026-04-18-first-run/
3. **F-SPEECH** 🔄 (parallel with F-FIRST-RUN) — speech recording — spec in vibe/features/2026-04-18-speech-recording/
4. **F-CLAUDE** 🔄 — Claude CLI integration, 5 prompt modes, mode persistence — spec in vibe/features/2026-04-18-claude-integration/
5. **F-ACTIONS** 🔄 — Copy, Edit, Regenerate actions — spec in vibe/features/2026-04-18-actions/

### Phase 3 — Polish and hardening

- Error state polish — verify all 9 error messages surface correctly
- Manual smoke test — exercise all 6 states, all 5 modes, on both architectures
- Build verification — `npm run dist` produces working universal .dmg
- Distribution prep — upload path + Slack message template
