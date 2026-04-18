# SPEC_INDEX — Promptly
> Compressed map of SPEC.md. Read each session. Fetch the full section you need.
> Last synced: 2026-04-18 (D-004)

## Overview — macOS floating bar: speak loosely → get tight structured Claude prompt → SPEC.md#overview

## Features — 9 features (v1)
- F1 Floating bar: always-on-top, titleBarStyle: hiddenInset (traffic lights), vibrancy, 30-bar waveform (IDLE static grey / RECORDING animated red) — D-004 → SPEC.md#f1
- F2 Global shortcut: ⌥Space (fallback ⌃\`) from any app → SPEC.md#f2
- F3 Speech recording: MediaRecorder + Whisper CLI, "Recording…" indicator, red dot — D-003 replaced webkitSpeechRecognition → SPEC.md#f3
- F4 Claude CLI + 5 modes: generate-prompt IPC, login-shell PATH, mode right-click → SPEC.md#f4
- F5 Copy: clipboard write, green flash 1.8s → SPEC.md#f5
- F6 Edit: contenteditable, Escape cancels, Done saves → SPEC.md#f6
- F7 Regenerate: always re-uses originalTranscript, not edited text → SPEC.md#f7
- F8 First-run: CLI check + mic permission checklist, skipped after → SPEC.md#f8
- F9 Error states: all in-bar, tap to dismiss, 9 specific messages → SPEC.md#f9

## UI — 1 floating bar · 6 states (FIRST_RUN / IDLE / RECORDING / THINKING / PROMPT_READY / ERROR) → SPEC.md#ui-specification

## Boundaries — Out of scope: dark mode, history, auto-paste, tray icon, multi-language, accounts, custom shortcuts, Windows/Linux → SPEC.md#out-of-scope

## Technical — Stack: Electron v31 + Vanilla JS/HTML/CSS + MediaRecorder + Whisper CLI + claude -p CLI · Data: in-memory vars + localStorage (mode, firstRunComplete) · IPC: 6 channels

## Done condition — Conformance: 12 items → SPEC.md#conformance-checklist

## Backlog — dark mode, prompt history, auto-paste, tray icon, multi-language, cloud sync, custom shortcuts → vibe/backlog/
