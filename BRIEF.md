# BRIEF.md — Promptly

---

## Problem

Speaking is faster and more expressive than typing prompts. People know what they want but writing Claude prompts that make Claude execute intent precisely is genuinely hard — the gap between what you mean and what you write costs output quality every time.

People currently either type prompts from scratch (slow, imprecise), copy-paste templates (generic), or just send rough messages and iterate (wasteful).

**Cost of the problem:** Every vague Claude prompt is a failed output, a re-run, and lost time. For a team using Claude as core daily infrastructure, this compounds fast.

---

## Primary User

BetaCraft team members — developers and PMs who use Claude daily via Claude Code, Claude Desktop, and claude.ai. Technically comfortable. Already authenticated with Claude CLI. Use Claude for PRDs, code generation, analysis, writing, planning.

**Usage pattern:** Quick, frequent interactions throughout the day. The tool needs to be zero-friction — no context switching, no setup per-use.

**v2+ user (if distributes):** Any knowledge worker who uses Claude regularly and wants better prompt output without prompt-engineering overhead.

---

## Core Value

**Speak loosely → get a tight, structured prompt you can trust Claude to execute on.**

Not dictation (Wispr Flow does that). Not autocomplete. Prompt engineering from speech — the emphasis, constraints, and output format all correctly specified, without the user having to think about prompt structure.

A user should be able to say "I need Claude to write a PRD for a freelancer expense tracker, make the user stories really specific and include edge cases" and get back a fully structured prompt with role, task, constraints, and output format already set.

---

## Success Metric (v1 — internal)

**5+ BetaCraft colleagues actively using it after the first week, getting noticeably better Claude outputs, and sticking with it.**

Stickiness signals: they open it instead of typing prompts directly, they mention it in Slack, they ask for features.

Failure signal: they try it once, it breaks or produces generic output, they don't come back.

**v2 success (if distributes):** Tool is good enough that colleagues would recommend it to people outside BetaCraft without prompting.

---

## Platform

macOS desktop. Always-on-top floating bar. Electron v31+. Universal binary — Apple Silicon + Intel.

Not web, not mobile, not cross-platform for v1.

---

## Features — v1 (locked)

| Feature | Priority | Notes |
|---|---|---|
| Floating bar, always on top, vibrancy, traffic lights | Must | macOS-native feel — `titleBarStyle: hiddenInset` with traffic lights at `{ x: 12, y: 10 }` |
| 30-bar visual waveform (IDLE + RECORDING) | Must | Static grey in IDLE, animated red in RECORDING — sine+noise, not real audio data |
| Speech recording via Web Speech API | Must | Live transcript with blinking cursor |
| Claude CLI integration (`claude -p`) | Must | PATH resolved via login shell, not bare exec |
| 5 prompt modes | Must | Balanced, Detailed, Concise, Chain, Code — right-click menu |
| Mode visible in idle bar | Must | Tiny label next to shortcut hint — critical for adoption |
| Copy prompt (one click) | Must | Flash green 1.8s |
| Edit prompt before copying | Must | contenteditable, Escape cancels, Done saves |
| Regenerate from original transcript | Must | Always re-uses speech, not edited text |
| First-run setup checklist | Must | CLI check + mic permission in one screen |
| Global shortcut ⌥ Space + fallback | Must | Falls back to ⌃` if taken, shows in-bar notice |
| All error states handled in-bar | Must | Tap to dismiss, never crash or hang |

## Features — deferred

| Feature | Reason deferred |
|---|---|
| Dark mode | Out of scope v1 per design direction |
| Prompt history / library | Adds persistence complexity, not needed for v1 stickiness |
| Auto-paste into active app | Wispr Flow territory — out of scope |
| Menu bar / tray icon | Nice to have, not critical |
| Multi-language speech | Out of scope v1 |
| User accounts / cloud sync | Out of scope v1 |
| Custom shortcuts | Out of scope v1 |

---

## UI Direction

**Feel:** Native macOS utility. Should look like it ships with macOS, not like a wrapped web app.

**Reference:** Wispr Flow's floating bar aesthetic — compact, non-distracting, always available.

**Constraints (hard):**
- System font only: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif`
- Actions: `#007AFF` (iOS blue)
- Recording: `#FF3B30` (iOS red)
- Copy success: `#34C759` (iOS green)
- Background: `rgba(255,255,255,0.85)` over vibrancy frosted glass
- No dark backgrounds, no custom design system, no gradients, no Google Fonts
- Window radius: 14px · Inner elements: 8px · Borders: hairline `rgba(0,0,0,0.08)`
- Transitions: opacity fade 150ms only — no bounces, no slides

**States:** 6 total — First Run → Idle → Recording → Thinking → Prompt Ready → Error

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Shell | Electron v31+ | Native macOS window APIs, ships as .dmg |
| Frontend | Vanilla HTML + CSS + JS | Single index.html, no build step, no framework |
| Speech | Web Speech API (webkitSpeechRecognition) | Native macOS engine, no API key, private |
| Prompt gen | `claude -p` CLI via `child_process` | Zero setup for Claude Code users — already authed |
| IPC | Electron ipcMain + preload.js contextBridge | Sandboxed renderer → main process |
| Storage | localStorage | Mode only — nothing sensitive |
| Distribution | electron-builder → .dmg (arm64 + x64) | Universal binary |

**Critical implementation note:** `claude` binary must be resolved via the user's login shell at startup — `exec('zsh -lc "which claude"')` — and the full path cached. Never use bare `exec('claude ...')`. This is the most common failure point in Electron + CLI apps.

---

## Files

```
promptly/
├── main.js            # Window config, IPC handlers, PATH resolution, shortcut
├── preload.js         # contextBridge — exposes electronAPI to renderer
├── index.html         # Entire UI, state machine, waveform, mode system
├── package.json       # Electron + electron-builder config
└── entitlements.plist # Mic permission for hardened runtime
```

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| PATH not found in Electron exec | High | Resolve via `zsh -lc "which claude"` at startup — spec'd in detail |
| ⌥ Space taken by Raycast/Alfred | Medium | Graceful fallback to ⌃` — show in-bar notice |
| webkitSpeechRecognition in hardened runtime | Medium | Correct entitlements.plist + test on Sonoma + Ventura |
| Edit mode undefined behaviour | Medium | Spec'd: Escape cancels, Done saves in-memory, Regen ignores edits |
| Vibrancy inconsistency across macOS versions | Low | Test on both, rgba fallback already in spec |
| CLI version flag changes | Low | Version check on launch, surface in error state |

---

## Constraints

- No API keys stored in the app — Claude CLI handles auth
- No npm runtime dependencies — only Electron + electron-builder (devDep)
- No internet required after install (except claude CLI calls)
- Must distribute as .dmg — colleagues are not developers, no `npm install`
- First-run experience must handle two prerequisites silently: CLI presence + mic permission

---

## Distribution Plan (v1 — internal)

1. Build universal .dmg via `npm run dist`
2. Upload to shared BetaCraft drive or Notion page
3. Write a 5-line Slack message: what it does, download link, two things to click, start with Balanced mode, one example use case from real work
4. Collect feedback in Slack thread for 1 week
5. If stickiness confirmed → evaluate broader distribution

---

## Open Questions (resolved before build)

All critical questions resolved. No open items blocking build start.

- ✅ Path: internal first, distribute if stickiness confirmed
- ✅ Success metric: 5+ colleagues actively using after week 1
- ✅ PATH resolution: login shell approach spec'd
- ✅ Edit mode: Escape/Done/Regen behaviour spec'd
- ✅ Shortcut conflict: fallback to ⌃` with in-bar notice
- ✅ First-run: two-step checklist replaces blocking error screen
- ✅ Mode visibility: label in idle bar next to shortcut hint

---

- Scope change 2026-04-18: Traffic lights added via titleBarStyle: hiddenInset (was in original intent, omitted from SPEC.md F1); 30-bar visual waveform added to IDLE/RECORDING (was referenced in files list, never specced)

## Architecture decisions
> Decided during architect: — 2026-04-18
> Full detail in ARCHITECTURE.md

- Project type: macOS Desktop app (Electron)
- Frontend structure: Single index.html — all UI, styles, and JS in one file (no build step)
- State management: In-memory state machine, single `setState()` function, 6 states
- localStorage: Wrapped in `getMode()` / `setMode()` only — never accessed directly
- TypeScript: Not used — vanilla JS mandate, build complexity outweighs benefit at this size
- Testing: Manual smoke checklist for v1; Playwright + Electron driver for v2 if distributes
- IPC: contextBridge + preload.js — nodeIntegration always false
- PATH resolution: Login shell (`zsh -lc "which claude"`) at startup, result cached globally
- CSS: Inline in index.html with CSS custom properties for all design tokens
- Dependencies: Zero runtime npm deps — only `electron` + `electron-builder` as devDeps