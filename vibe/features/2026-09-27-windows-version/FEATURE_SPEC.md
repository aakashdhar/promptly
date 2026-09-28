# FEATURE_SPEC — Promptly for Windows

> Folder: vibe/features/2026-09-27-windows-version/ · Drafted: 2026-09-27 · Status: APPROVED 2026-09-27
> **Unplanned addition.** vibe/SPEC.md#out-of-scope lists "Windows / Linux support — macOS only". Approving this
> spec reverses that line (run `change:` on approval to update SPEC.md and PLAN.md).

## 1. Feature overview

Promptly runs on Windows 10 (22H2) and Windows 11, x64, with the same two ways to talk: Dictation types your words
where your cursor is, and Craft turns them into finished work through the user's own Claude Code sign-in. Most of
the app (Electron shell, React renderer, `main/llm.js`, prompts, history, settings) already runs anywhere; the port
replaces the macOS-only pieces behind the seams the codebase already has (`main/platform/`, the helper's JSON-lines
protocol) and adds a Windows build, installer and release.

Delivered in two phases:
- **Phase 1 — usable Windows app:** Dictation, all Craft modes except Harness scheduling, tray icon, hold-to-talk,
  selected-text context, typing into the app you're in, setup (mic + Claude Code), unsigned NSIS installer from CI,
  site download for Windows.
- **Phase 2 — parity:** Harness mode on Windows (PowerShell harness files + Task Scheduler), code signing.

## 2. User stories

- As a Windows user, I install Promptly from the site, open it from the Start menu, and it sits in the system tray.
- As a Windows user, I double-tap Ctrl (or hold my chosen key), talk, and my words are typed into Notepad, Slack, VS Code
  or a browser where my cursor is.
- As a Windows user, I pick a Craft mode (Prompt, Code, Design, Polish, Email, Image, Video, Workflow) and get the same
  result as on a Mac, using my Claude Code sign-in.
- As a Windows user with text selected in another app, Craft and Polish use that selection as context.
- As a first-time Windows user, setup checks the microphone and installs or signs in to Claude Code without me opening
  a terminal myself.
- As a Windows user (phase 2), I describe a recurring job in Harness mode, save the files into my project, and schedule
  it to run on my PC.
- As the owner, one release produces the Mac DMG and the Windows installer, and the site offers each visitor the
  right one.

## 3. Acceptance criteria

### Phase 1
1. `npm run start:react` and the packaged app start on Windows 10 22H2 and Windows 11 x64 without errors in the log.
2. The app shows a system-tray icon with the same menu as the Mac menu-bar icon (open, mode, settings, quit); the idle,
   recording and thinking states are visible in the tray icon.
3. The main window uses a Windows-appropriate frame (custom title bar with minimise/maximise/close on the right, or
   `titleBarOverlay`); no macOS traffic-light spacing remains.
4. Hotkeys on Windows: "Double-tap Ctrl" (default), "Alt + Space", "Hold Right Alt", "Ctrl + Alt + Space",
   "Ctrl + Shift + Space". Hold-to-talk works (key down starts, key up stops); tap-to-toggle works.
   "Fn / Globe" is not offered on Windows.
5. Every place the UI shows ⌘ ⌥ ⌃ (14 renderer files, pill.html, splash.html) shows Ctrl / Alt / Shift on Windows,
   from one shared helper, not per-file conditionals.
6. Dictation types the transcript into the foreground app (via clipboard + Ctrl+V) and restores the previous
   clipboard contents afterwards, as on Mac.
7. With text selected in Notepad, VS Code, Chrome and Word, Craft receives it as selected-text context; when an app
   doesn't expose selection, Promptly proceeds without it (no error).
8. The foreground app's name is reported for destination-aware prompts (e.g. "Code.exe" → "Visual Studio Code").
9. Transcription runs locally with the bundled whisper.cpp (`whisper-cli.exe`, VAD model, base model) and the optional
   "Best accuracy" download; no audio leaves the PC.
10. Claude calls go through `main/llm.js` only, resolving `claude.exe` / `claude.cmd` via `main/platform/win32.js`;
    `makeClaudeEnv` builds a Windows PATH (`;`).
11. Setup: microphone check opens `ms-settings:privacy-microphone` when access is denied; no Accessibility step on
    Windows; "Install Claude Code" and "Sign in" open a PowerShell window running the official commands.
12. Settings → Setup shows Windows tool paths; "Launch at login" uses `app.setLoginItemSettings` on Windows.
13. The splash wizard, pill and expanded view pass the e2e layout audit on Windows at 100% and 150% display scaling.
14. CI (GitHub Actions, windows-latest) builds whisper.cpp, the Windows helper and an NSIS installer
    `Promptly-Setup-X.Y.Z.exe`; unit tests pass on Windows in CI, and the e2e suite passes on the Windows PC
    (e2e runs locally only — owner, 2026-09-28).
15. `publish-release.sh` (or its CI successor) uploads the installer plus a fixed-name `Promptly-Setup.exe` to the
    GitHub Release; the site's download button offers Windows users the `.exe` and Mac users the DMG.
16. The installer is unsigned in phase 1; the site and release notes explain the SmartScreen "More info → Run anyway"
    step, as they do for the Mac "Open Anyway" step.
17. The NSIS uninstaller (Apps & features) removes the app and keeps `%APPDATA%\Promptly`; the tray's
    "Uninstall Promptly…" removes the app and its data, as on the Mac.

### Phase 2
18. Harness mode on Windows: the harness-files prompt writes PowerShell (`.ps1`) harness scripts for Windows (the Mac
    bash version is unchanged); progress notifications use a Windows toast instead of `osascript`.
19. "Schedule it" registers a Windows Task Scheduler task (per project folder, replaced on reschedule) that runs the
    harness command from the project folder; "Remove schedule" deletes it; output goes to `.harness\schedule.log`.
20. The Windows installer and executables are signed (method chosen in §Open decisions); SmartScreen no longer warns
    once the signing reputation is established.

## 4. Scope boundaries

**Included:** everything in §3 for Windows 10 22H2+ and Windows 11 on x64.

**Deferred / not included:**
- Windows on ARM64 (Snapdragon) builds — later; whisper.cpp and the helper would need an arm64 build.
- Linux.
- Microsoft Store / MSIX distribution; winget listing.
- Auto-update (not on Mac either).
- Any change to Mac behaviour. Every Mac path keeps working exactly as today.

## 5. Integration points

- **Platform seam:** `main/platform/index.js` (selects darwin/win32), new `main/platform/win32.js` with the same exports
  as `main/platform/darwin.js` (see vibe/CODEBASE.md#file-map: binaryCandidates, nodeVersionBinDirs, isShim,
  shellWhich, resolveShim, whisperPathDirs, whisperModelCacheDirs, uninstallDataPaths, resetMicrophonePermission,
  removeInstalledApp, SCHEDULE_PATH, launchAgentsDir/loadLaunchAgent/unloadLaunchAgent → generalised to a
  scheduler interface).
- **Helper protocol:** `main/helper.js` spawns the helper and speaks JSON lines: requests `configure {hotkey}`,
  `context`, `paste`, `status`, `requestAccess`; events `hotkey {phase}`, `status/ready {trusted, tap}`. A new
  `native/helper-win/` implements the same protocol. `trusted` is always true on Windows.
- **Hotkeys:** `main/hotkey.js` presets become per-platform lists; the hold-vs-tap state machine is shared.
- **Binaries:** `main/binaries.js` (`resolveBinary`, `makeClaudeEnv`), `main/whisper.js` (binary name `.exe`).
- **Claude setup:** `main/claude-setup.js` (`.command` scripts → PowerShell on Windows).
- **Window/tray:** `main.js` (window options at ~L733, tray at ~L325, permissions ~L989–1072), `main/tray-icon.js`.
- **Renderer labels:** the 14 files listed in FEATURE_PLAN.md + `pill.html`, `splash.html`.
- **Harness (phase 2):** `main/harness.js`, `main/prompts/harness-files.txt`, the `schedule-harness` /
  `unschedule-harness` IPC handlers in `main.js`.
- **Build/release:** `scripts/fetch-whisper.sh`, `scripts/build-helper.sh`, `scripts/release.sh`,
  `scripts/publish-release.sh`, `package.json` `build` config, new `.github/workflows/`.
- **Site:** `index.html` download buttons + `site/script.js` OS detection.

## 6. Data model changes

None to history or config formats. `config.json` gains nothing new; paths already stored per install.
Harness schedules on Windows are Task Scheduler tasks named `Promptly Harness — <folder> (<hash>)` (same label
rule as `agentLabel`).

## 7. IPC / API changes

- New preload method + handler `get-platform` → `{ os: 'darwin' | 'win32', keys: {mod, alt, ctrl, shift} }` so the
  renderer renders key labels from one source. `tests/ipc-contract.test.js` must stay green.
- No other IPC changes; schedule handlers keep their shape, the platform module behind them changes.

## 8. Edge cases and error states

- Claude Code installed via npm (`claude.cmd` shim) vs native installer (`claude.exe`) vs WSL-only — WSL-only is
  treated as "not found" with a clear setup message.
- Claude Code on Windows may require Git for Windows; setup detects its absence and says so with a link.
- Elevated (admin) foreground windows block simulated input from a non-elevated app: Dictation falls back to
  "Copied — press Ctrl+V" (same as Mac's fallback) and says why.
- Right Alt is AltGr on many European layouts; "Hold Right Alt" is offered with a note, not as default.
- Display scaling 125–200% and multiple monitors: pill and window positions use DIPs from `screen`.
- Antivirus/SmartScreen quarantining unsigned `whisper-cli.exe` or the helper: setup checks each binary runs and
  reports which one was blocked.
- Paths with spaces and non-ASCII usernames (`C:\Users\Zoë Smith\…`) for whisper models and temp audio.
- Microphone privacy disabled for desktop apps globally: message points to the exact Windows setting.

## 9. Non-functional requirements

- Architecture rules unchanged: Claude only via `main/llm.js`; external binaries via `execFile`/`spawn` with argument
  arrays (no shell strings — PowerShell launches pass args as arrays too); platform specifics only in
  `main/platform/`.
- Zero new runtime npm dependencies (the helper is a native binary, like the Swift one).
- Installer size within 15% of the Mac DMG size.
- Hold-to-talk latency (key down → recording) under 150 ms on Windows, like Mac. Measured: the helper stamps each
  `hotkey` event with its time (`t`, ms), main logs the gap to the recorder starting, and the Windows PC pass reads
  20 presses from main.log (p95 < 150 ms).
- Privacy unchanged: audio never leaves the machine.

## 10. Conformance checklist

- [ ] All phase-1 acceptance criteria (1–17) pass on a real Windows 11 machine (CI: build + unit tests).
- [ ] Mac e2e and unit suites still pass unchanged.
- [ ] `npm run lint` 0 errors on both platforms.
- [ ] No macOS-specific call outside `main/platform/darwin.js` and `native/helper/`; no Windows call outside
      `main/platform/win32.js` and `native/helper-win/`.
- [ ] Site offers the right download per OS; release publishes both.
- [ ] CODEBASE.md, ARCHITECTURE.md (platform section), SPEC.md (out-of-scope line), DECISIONS.md updated.
- [ ] Phase-2 criteria (18–20) before announcing "full parity".

## Decisions (owner, 2026-09-27)

1. **Hands-on testing:** on a real Windows 10/11 PC (the owner or a tester). CI covers builds and automated tests;
   each phase ends with a manual test pass on that PC using the checklist in FEATURE_TASKS.md.
2. **Signing:** unsigned in phase 1 (SmartScreen "More info → Run anyway" explained on the site and in release
   notes); signing method chosen before phase 2.
3. **Harness:** phase 2, not in the first Windows release.
4. **Helper language:** Rust (small, no runtime, `windows` crate) unless the owner asks for C#.
