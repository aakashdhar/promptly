# SPEC.md — Promptly
> Created: 2026-04-18 | Source: BRIEF.md + architect: decisions
> Living document — changes only via `change:` command. Strikethrough for removed items.
> ⚠️ Last updated: 2026-04-18 · Scope change D-004: traffic lights (titleBarStyle: hiddenInset) + 30-bar visual waveform added to F1/IDLE/RECORDING · Build stage: Between tasks

---

## Overview

Promptly is a macOS floating bar that turns spoken words into structured Claude prompts. Users press a global shortcut, speak loosely about what they want Claude to do, and receive a tight, role+task+constraints+format prompt they can copy and use immediately. It runs as an always-on-top Electron app with zero configuration for BetaCraft team members already using Claude CLI.

---

## Target users

**Primary:** BetaCraft developers and PMs who use Claude daily via Claude Code, Claude Desktop, and claude.ai. Already authenticated with Claude CLI. Technically comfortable. Usage pattern: quick, frequent interactions throughout the workday — zero-friction required.

**v2+ (if distributes):** Any knowledge worker who uses Claude regularly and wants better prompt output without prompt-engineering overhead.

---

## Core features

### F1 — Floating bar window
**What:** Always-on-top window at bottom-centre of screen with macOS vibrancy frosted-glass effect, native traffic lights, and a 30-bar visual waveform.

> ~~Original: `frame: false` — no native title bar~~
> Changed 2026-04-18 (D-004): `titleBarStyle: 'hiddenInset'` + `trafficLightPosition: { x: 12, y: 10 }` — traffic lights were in BRIEF.md and omitted from spec at planning time.
> Added 2026-04-18 (D-004): 30-bar animated waveform centred in IDLE and RECORDING states.

**Acceptance criteria:**
- [ ] Window is always-on-top (Electron `alwaysOnTop: true`)
- [ ] `titleBarStyle: 'hiddenInset'` — traffic lights visible, inset into window content
- [ ] `trafficLightPosition: { x: 12, y: 10 }` — traffic lights positioned in top-left
- [ ] Bar content has left padding (~70px) so content does not overlap traffic light area
- [ ] Vibrancy: `vibrancy: 'fullscreen-ui'` (changed from `'sidebar'` in BUG-006 — more reliable on Electron v31+) with `transparent: true` and `backgroundColor: '#00000000'`
- [ ] `transparent: true` on BrowserWindow so vibrancy + rounded corners render correctly
- [ ] Window radius: 18px (changed from 14px in dark-glass design pivot)
- [ ] System font only: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif`
- [ ] Window opens centred horizontally near bottom of screen
- [ ] Electron `contextIsolation: true`, `nodeIntegration: false` enforced
- [ ] 30-bar waveform centred in IDLE bar — static grey bars, no animation
- [ ] 30-bar waveform centred in RECORDING bar — animated red bars driven by sine wave + noise via `setInterval`
- [ ] Waveform animation starts when `setState('RECORDING')` is called; stops when recording ends
- [ ] Waveform is visual only — not driven by actual audio data (Whisper is post-processing only)

### F2 — Global shortcut
**What:** ⌥Space activates the bar from anywhere on the system. Falls back to ⌃` if taken.

**Acceptance criteria:**
- [ ] ⌥Space registered globally via Electron `globalShortcut`
- [ ] If ⌥Space is taken (returns false), register ⌃` instead
- [ ] In-bar notice shown if fallback is active: "Shortcut ⌥Space taken — using ⌃`"
- [ ] Shortcut hint visible in IDLE state at all times

### F3 — Speech recording
**What:** Tap shortcut → bar enters RECORDING state. Audio recorded locally via MediaRecorder. Tap again → stops, audio sent to Whisper CLI for transcription, transcript returned as `originalTranscript`.

> ~~Original: webkitSpeechRecognition, live transcript~~
> Changed 2026-04-18 (D-003): MediaRecorder + Whisper CLI — webkitSpeechRecognition fails in Electron with network error (no bundled Google API key)

**Acceptance criteria:**
- [ ] `getUserMedia({ audio: true })` opens mic stream at recording start
- [ ] `MediaRecorder` records audio chunks into `audioChunks` array
- [ ] RECORDING state shows "Recording…" — no live transcript (Whisper is post-processing only)
- [ ] Recording indicator dot shown (red `--color-recording`)
- [ ] Stops on second tap of shortcut
- [ ] On stop: audio blob sent via `transcribe-audio` IPC → Whisper CLI transcribes → result set as `originalTranscript`
- [ ] `originalTranscript` captured once at stop — never mutated after
- [ ] If mic permission denied → ERROR state with message "Microphone access denied"
- [ ] If Whisper returns empty transcript → ERROR "No speech detected — try again"
- [ ] If Whisper CLI not found → ERROR "Whisper not found — install via pip install openai-whisper"

### F4 — Claude CLI integration + 5 prompt modes
**What:** Speech transcript sent to `claude -p` with a mode-specific system prompt. Returns a structured prompt.

**Acceptance criteria:**
- [ ] `claude` binary resolved via `exec('zsh -lc "which claude"')` at startup, result cached
- [ ] If resolution fails at startup → ERROR state: "Claude CLI not found. Install via npm i -g @anthropic-ai/claude-code"
- [ ] 5 modes with distinct system prompts: Balanced, Detailed, Concise, Chain, Code
- [ ] Right-click context menu shows mode list in this order: Balanced · Detailed · Concise · Chain · Code — active mode has a checkmark
- [ ] Mode selected via right-click context menu on bar
- [ ] Active mode persisted to localStorage via `getMode()` / `setMode()`
- [ ] Mode label visible in IDLE bar next to shortcut hint at all times
- [ ] Bar enters THINKING state while `claude -p` runs (spinner shown)
- [ ] On success → PROMPT_READY state, generated prompt rendered
- [ ] On failure → ERROR state with message from stderr
- [ ] Timeout after 60 seconds → ERROR state: "Claude took too long — try again" (extended from 30s — complex prompts need more time)

**Mode system prompts (exact `claude -p` system prompt for each mode):**

| Mode | Label | System prompt sent to `claude -p` |
|------|-------|-----------------------------------|
| Balanced | `Balanced` | `You are a prompt engineering assistant. Given the following description, write a structured Claude prompt with: a clear role, the specific task, concise constraints, and the desired output format. Be direct and precise. Return only the prompt — no explanation.` |
| Detailed | `Detailed` | `You are a prompt engineering assistant. Given the following description, write a thorough Claude prompt that includes: role, task, detailed constraints, edge cases to handle, output format, and one concrete example of the desired output. Return only the prompt — no explanation.` |
| Concise | `Concise` | `You are a prompt engineering assistant. Given the following description, write the shortest possible Claude prompt that captures the core task with only the constraints that are necessary. Strip all scaffolding and fluff. Return only the prompt — no explanation.` |
| Chain | `Chain` | `You are a prompt engineering assistant. Given the following description, write a chain-of-thought Claude prompt that breaks the task into explicit numbered steps Claude should work through in sequence before giving a final answer. Return only the prompt — no explanation.` |
| Code | `Code` | `You are a prompt engineering assistant. Given the following description, write a Claude prompt optimised for code generation. Specify: language, function signature or interface, constraints, edge cases to handle, and expected output format. Return only the prompt — no explanation.` |

The user's speech transcript is appended after the system prompt as the user message.

### F5 — Copy action
**What:** One-click copy of the generated prompt to clipboard.

**Acceptance criteria:**
- [ ] Copy button visible in PROMPT_READY state
- [ ] On click → `clipboard.writeText()` via IPC
- [ ] Button flashes green (`--color-success`) for 1.8 seconds, text changes to "Copied!"
- [ ] After flash → returns to normal state (still shows prompt)

### F6 — Edit mode
**What:** User can edit the generated prompt before copying.

**Acceptance criteria:**
- [ ] Edit button visible in PROMPT_READY state
- [ ] Click → prompt output becomes `contenteditable`
- [ ] Escape → cancels edit, restores original `generatedPrompt` (no mutation)
- [ ] Done button → saves edited text to `generatedPrompt`, exits contenteditable
- [ ] Edit does NOT overwrite `originalTranscript` — regenerate always uses speech original

### F7 — Regenerate
**What:** Re-runs Claude CLI with the same original speech transcript (not any edited text).

**Acceptance criteria:**
- [ ] Regenerate button visible in PROMPT_READY state
- [ ] Click → uses `originalTranscript` (not `generatedPrompt`, not edited content)
- [ ] Re-enters THINKING state, then PROMPT_READY on success
- [ ] Mode used is current active mode at time of regenerate (not the mode used for original)

### F8 — Launch-time checks (splash screen)
**What:** On every launch, a separate frosted-glass splash window runs CLI + mic checks before showing the main bar. Replaces original in-bar first-run flow (FEATURE-001, 2026-04-18).

> ~~Original: In-bar FIRST_RUN state, only shown on first launch, stored `firstRunComplete` in localStorage~~
> Changed 2026-04-18 (FEATURE-001): Separate `splashWin` BrowserWindow (`splash.html`) — runs every launch, auto-proceeds when all checks pass.

**Acceptance criteria:**
- [ ] Separate `splashWin` BrowserWindow shown before main window on every launch
- [ ] Two check items: "Claude CLI" + "Microphone"
- [ ] CLI check: green ✓ if `claudePath` resolved, red ✗ + "Install Claude CLI" button if not
- [ ] Mic check: `getUserMedia({ audio: true })` — green ✓ on success, red ✗ on deny
- [ ] If CLI missing: shows install button that opens `https://claude.ai/code` — no auto-proceed
- [ ] If mic denied: shows error message — no auto-proceed
- [ ] On all-clear: "All checks passed — launching" → 600ms → splash hides, main bar shows
- [ ] Main bar hidden until `splash-done` IPC fires

### F9 — Error states (in-bar)
**What:** All errors shown inline in the bar — no separate windows, no crashes.

**Acceptance criteria:**
- [ ] ERROR state displays message text and dismiss tap area
- [ ] Tap anywhere on error bar → returns to IDLE
- [ ] Error never leaves bar in a broken/hung state
- [ ] Specific messages for: CLI not found, mic denied, CLI timeout, CLI stderr output

---

## Out of scope (v1)

- ~~Dark mode~~ — deferred; design direction is light-only
- ~~Prompt history / library~~ — adds persistence complexity
- ~~Auto-paste into active app~~ — Wispr Flow territory
- ~~Menu bar / tray icon~~ — not critical for v1
- ~~Multi-language speech~~ — out of scope
- ~~User accounts / cloud sync~~ — out of scope
- ~~Custom shortcuts~~ — out of scope
- ~~Windows / Linux support~~ — macOS only

---

## Tech stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Shell | Electron v31+ | Native macOS window APIs, .dmg distribution |
| Frontend | Vanilla HTML + CSS + JS, single `index.html` | Zero build step, zero runtime deps |
| Speech | `getUserMedia` + `MediaRecorder` + Whisper CLI | Local transcription, offline, no API key — webkitSpeechRecognition requires Google API key not bundled in Electron |
| Prompt gen | `claude -p` via `child_process` | Zero setup for Claude Code users |
| IPC | Electron ipcMain + preload.js contextBridge | Sandboxed renderer → main |
| Storage | localStorage | Mode only — nothing sensitive |
| Distribution | electron-builder → .dmg (arm64 + x64) | Universal binary |

---

## Data model

No database. All data is in-memory or localStorage.

**In-memory (module-scope vars in index.html):**
| Variable | Type | Description |
|----------|------|-------------|
| `currentState` | string | One of: FIRST_RUN, IDLE, RECORDING, THINKING, PROMPT_READY, ERROR |
| `transcript` | string | Live/final transcript from current recording session |
| `originalTranscript` | string | Captured once at recording stop — never mutated |
| `generatedPrompt` | string | Current output from Claude CLI (may be edited by user) |

**Cached in main.js (module scope):**
| Variable | Type | Description |
|----------|------|-------------|
| `claudePath` | string\|null | Resolved path to claude binary, set at app ready |

**localStorage:**
| Key | Type | Description |
|-----|------|-------------|
| `mode` | string | Active prompt mode — default: `'balanced'` |
| `firstRunComplete` | boolean | Whether first-run checklist has been completed |

---

## IPC surface

| Direction | Channel | Payload | Return |
|-----------|---------|---------|--------|
| renderer → main | `generate-prompt` | `{ transcript, mode }` | `{ success, prompt, error }` |
| renderer → main | `copy-to-clipboard` | `{ text }` | `{ success }` |
| renderer → main | `check-claude-path` | — | `{ found, path, error }` |
| renderer → main | `transcribe-audio` | `{ audioData: ArrayBuffer }` | `{ success, transcript, error }` |
| main → renderer | `shortcut-triggered` | — | — |
| main → renderer | `shortcut-conflict` | `{ fallback }` | — |

---

## Non-functional requirements

- **Startup time:** App must be interactive (IDLE or FIRST_RUN state) within 2 seconds of launch
- **Claude response time:** Spinner shown immediately; 30-second timeout surfaces ERROR
- **Shortcut latency:** Global shortcut response < 100ms
- **Distribution:** Universal .dmg — must run natively on Apple Silicon and Intel
- **Security:** `contextIsolation: true`, `nodeIntegration: false`, no sensitive data stored
- **No internet:** Fully functional offline except for `claude` CLI calls

---

## Conformance checklist

What must be true for v1 to be complete:

- [ ] App opens as floating bar, always on top, with vibrancy
- [ ] Global shortcut ⌥Space works from any app; falls back to ⌃` with notice
- [ ] Speech recording works with live transcript
- [ ] All 5 prompt modes produce distinct output from Claude CLI
- [ ] Mode visible in idle bar; persists across app restarts
- [ ] Copy flashes green 1.8s and writes to clipboard
- [ ] Edit mode works: Escape cancels, Done saves, regenerate ignores edits
- [ ] Regenerate uses original speech transcript, not edited text
- [ ] First-run checklist shown on first launch; skipped thereafter
- [ ] All error conditions from F3/F4/F9 surface in-bar with correct message and tap-to-dismiss: CLI not found at startup, mic permission denied, CLI timeout (30s), CLI stderr output
- [ ] Universal .dmg builds and installs cleanly on Apple Silicon and Intel
- [ ] Manual smoke test checklist passes on both architectures

---

## UI Specification

### Design direction
Native macOS utility aesthetic — looks like it ships with macOS, not like a wrapped web app. Compact, non-distracting, always available. Reference: Wispr Flow floating bar.

### Component library
None — vanilla CSS with CSS custom properties for design tokens.

### Navigation structure
No navigation — single persistent floating bar. UI is driven entirely by a 6-state machine. No routing.

### Screens / States

#### FIRST_RUN state
- **Purpose:** Guide user through CLI check and mic permission before first use
- **Layout:** Two-row checklist inside the bar; slightly taller than normal bar
- **Key components:** Status dot (✓/✗) for CLI, "Grant Access" button for mic, progress indicator
- **User interactions:** Click "Grant Access" → triggers mic permission prompt
- **States:** Waiting, CLI ok / mic pending, both ok → auto-transition to IDLE

#### IDLE state
- **Purpose:** Rest state — app is ready
- **Layout:** Single bar row: traffic lights (left, inset) · mode label · 30-bar static waveform (centred) · shortcut hint
- **Key components:** Mode label pill, 30 static grey bars, shortcut hint text
- **User interactions:** Press shortcut → RECORDING; right-click → mode context menu
- **States:** Normal, shortcut-conflict notice overlay

#### RECORDING state
- **Purpose:** Actively recording speech
- **Layout:** Bar expands slightly; traffic lights (left) · red blinking dot · 30-bar animated waveform (centred) · stop hint
- **Key components:** Red blinking dot, 30 animated red bars (sine + noise), stop hint text
- **User interactions:** Press shortcut again → stop recording → THINKING
- **States:** Waveform animating

#### THINKING state
- **Purpose:** Claude CLI is running — waiting for response
- **Layout:** Spinner centred in bar; "Generating prompt…" text
- **Key components:** Spinner animation, status text
- **User interactions:** None (no cancel in v1)
- **States:** Running, timeout (→ ERROR after 30s)

#### PROMPT_READY state
- **Purpose:** Show generated prompt; offer copy, edit, regenerate
- **Layout:** Bar expands to show full prompt text; action row below
- **Key components:** Prompt text (scrollable if long), Copy button, Edit button, Regenerate button
- **User interactions:** Copy (green flash), Edit (contenteditable), Regenerate (→ THINKING), click outside → IDLE
- **States:** Normal, edit mode active, copy flash

#### ERROR state
- **Purpose:** Display any error in-bar without crashing or hanging
- **Layout:** Single bar row; error icon (left) · error message · tap-to-dismiss hint
- **Key components:** Error icon, message text, dismiss affordance
- **User interactions:** Tap anywhere → IDLE
- **States:** One state — always dismissible

### Responsive behaviour
macOS desktop only. Fixed-width floating bar (480px wide). Height varies by state (44px idle, ~120px recording/prompt-ready). No responsive/mobile behaviour needed.
