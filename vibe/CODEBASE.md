# CODEBASE.md — Promptly
> Live codebase snapshot. Updated after every task that adds or modifies a file.
> Agent reads this at session start to understand current state without re-reading all files.
> Last updated: 2026-04-18 (project kit created — no code written yet)

---

## Current state

**Phase:** Phase 1 — in progress (P1-001 done)
**Files written:** 1

---

## File map

*Populated when Phase 1 begins. Each entry added as files are created.*

| File | Purpose | Key exports / functions |
|------|---------|------------------------|
| `package.json` | Electron + electron-builder config, npm scripts, devDeps only | scripts: start, dist, lint |
| `entitlements.plist` | — not yet written — | |
| `main.js` | — not yet written — | |
| `preload.js` | — not yet written — | |
| `index.html` | — not yet written — | |

---

## IPC channels (registered in main.js)

*Populated when P1-008 completes.*

| Channel | Direction | Status |
|---------|-----------|--------|
| `generate-prompt` | renderer → main | — not registered — |
| `copy-to-clipboard` | renderer → main | — not registered — |
| `check-claude-path` | renderer → main | — not registered — |
| `shortcut-triggered` | main → renderer | — not registered — |
| `shortcut-conflict` | main → renderer | — not registered — |

---

## State machine (in index.html)

*Populated when F-STATE feature completes.*

States: FIRST_RUN · IDLE · RECORDING · THINKING · PROMPT_READY · ERROR
setState() function: — not yet written —

---

## Module-scope variables (in index.html)

*Populated when F-STATE feature completes.*

| Variable | Set by | Read by |
|----------|--------|---------|
| `currentState` | setState() | all features |
| `transcript` | F-SPEECH | F-CLAUDE |
| `originalTranscript` | F-SPEECH | F-CLAUDE, F-ACTIONS |
| `generatedPrompt` | F-CLAUDE | F-ACTIONS |

---

## Module-scope variables (in main.js)

*Populated when P1-006 completes.*

| Variable | Set when | Value |
|----------|----------|-------|
| `claudePath` | app-ready PATH resolution | — not resolved — |

---

## CSS design tokens (in index.html)

*Populated when F-STATE completes.*

```css
/* not yet defined */
```

---

## localStorage keys

| Key | Written by | Read by |
|-----|-----------|---------|
| `mode` | setMode() in F-CLAUDE | getMode() in F-CLAUDE, F-ACTIONS |
| `firstRunComplete` | F-FIRST-RUN | F-FIRST-RUN check at startup |

---

## Known issues / watch items

*Populated as issues are discovered during Phase 1-3.*

(none yet)
