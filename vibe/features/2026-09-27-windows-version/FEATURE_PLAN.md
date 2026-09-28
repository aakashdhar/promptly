# FEATURE_PLAN — Promptly for Windows

> Spec: FEATURE_SPEC.md (approved 2026-09-27) · Status: APPROVED 2026-09-28 (owner: "lets start working on the windows version")
> Principle: every Mac path keeps working exactly as today. Windows code lives behind the existing seams
> (`main/platform/`, the helper JSON-lines protocol); shared code only gains a platform switch where it must.

## 1. Impact map

### New files
| Path | What |
|---|---|
| `main/platform/win32.js` | Windows twin of darwin.js: binary candidates (`claude.exe`, `claude.cmd`, `whisper-cli.exe`, `ffmpeg.exe` in `%LOCALAPPDATA%\Programs`, `%APPDATA%\npm`, `%USERPROFILE%\.local\bin`, Scoop/Chocolatey), `PATH_DELIMITER ';'`, `DEFAULT_PATH`, `shellWhich` via `where.exe`, uninstall data paths (`%APPDATA%\Promptly`), no-op `resetMicrophonePermission`, `removeInstalledApp` via the NSIS uninstaller, `SCHEDULE_PATH`, scheduler functions (phase 2) |
| `main/platform/scheduler.js` | One interface over launchd (darwin) and Task Scheduler (win32): `scheduleFile(dir)`, `install({label, dir, run, schedule})`, `remove(label)`; darwin wraps today's `loadLaunchAgent`/plist code |
| `main/keys.js` | Per-platform key names and symbols (`{ mod: '⌘'|'Ctrl', alt: '⌥'|'Alt', ctrl: '⌃'|'Ctrl', shift: '⇧'|'Shift' }`) + `formatHotkey()`; shared by main and renderer via preload |
| `native/helper-win/` (Cargo project: `Cargo.toml`, `src/main.rs`) | Windows helper speaking the same JSON-lines protocol: `WH_KEYBOARD_LL` hook for hold/tap + double-tap Ctrl, `GetForegroundWindow` + `QueryFullProcessImageNameW` for the app, UI Automation `TextPattern.GetSelection` (fallback: simulated Ctrl+C with clipboard restore) for selected text, `SendInput` Ctrl+V for paste; `trusted: true` always |
| `scripts/fetch-whisper.ps1` | Builds whisper.cpp (`whisper-cli.exe`) with CMake/MSVC and downloads the same models into `vendor/whisper/` |
| `scripts/build-helper-win.ps1` | `cargo build --release` → `vendor/helper/promptly-helper.exe` |
| `.github/workflows/windows.yml` | windows-latest: npm ci, lint, unit tests, fetch-whisper.ps1, build-helper-win.ps1, build renderer, electron-builder `--win nsis --x64`; uploads the installer as a workflow artifact. No e2e in CI (owner, 2026-09-28: e2e runs locally only) |
| `e2e/fakes/claude.mjs`, `e2e/fakes/whisper.mjs`, `e2e/fakes/ffmpeg.mjs` + `.cmd` shims on Windows | The bash fakes in e2e/app.spec.mjs rewritten as Node scripts so one fake runs on both OSes |
| `build/icon.ico`, `build/installer.nsh` (if needed) | Windows icon and NSIS tweaks |
| `main/prompts/harness-files-win.txt` (phase 2) | Harness files prompt for PowerShell (`.ps1` scripts; "stuck/finished" toasts via a built-in PowerShell snippet, no extra modules) |

### Files modified
| Path | Change |
|---|---|
| `main/platform/index.js` | `module.exports = require(process.platform === 'win32' ? './win32' : './darwin')` |
| `main/hotkey.js` | `HOTKEY_PRESETS` becomes `{ darwin: [...], win32: [...] }`; `getPreset`/`DEFAULT_HOTKEY` pick by platform; hold/tap state machine unchanged |
| `main/binaries.js` | `.exe`/`.cmd` resolution, `makeClaudeEnv` uses `platform.PATH_DELIMITER` (already) and Windows env vars (`USERPROFILE`, `LOCALAPPDATA`) |
| `main/whisper.js` | binary name from platform; temp paths via `os.tmpdir()` (check no `/tmp` literals) |
| `main/claude-setup.js` | `writeTerminalScript` → platform function: `.command` on Mac, a `.ps1` opened with `powershell -NoExit -File` on Windows; install command `irm https://claude.ai/install.ps1 \| iex`; Git for Windows check |
| `main/helper.js` | binary path per platform (`promptly-helper.exe`); no protocol change |
| `main/tray-icon.js` | Windows tray icons (16/32 px, `.ico` or PNG template off) |
| `main.js` | window options by platform (Windows: `titleBarStyle: 'hidden'` + `titleBarOverlay` with theme colours; no `trafficLightPosition`), tray click opens window on Windows, permission handlers skip Accessibility and open `ms-settings:privacy-microphone`, `x-apple.systempreferences` links only on Mac, schedule handlers call `scheduler` (phase 2), new `get-platform` IPC |
| `preload.js` | `getPlatform()` |
| `src/renderer/utils/keys.js` (new, tiny) + 14 renderer files, `pill.html`, `splash.html` | replace hard-coded ⌘ ⌥ ⌃ with `keys.*` / `formatHotkey` |
| `src/renderer/components/ExpandedTransportBar.jsx` (and title-bar area) | leave room on the right for Windows caption buttons instead of left traffic lights |
| `main/harness.js` (phase 2) | `buildFilesPrompt` picks the Windows prompt on win32; `launchAgentPlist` moves behind `scheduler` |
| `package.json` | `build.win` (`target: nsis`, `arch: x64`, `icon: build/icon.ico`, `artifactName: Promptly-Setup-${version}.exe`), `build.nsis` (`oneClick: false`, `perMachine: false`, `allowToChangeInstallationDirectory: true`), `extraResources` for `vendor/helper/promptly-helper.exe` and `vendor/whisper/*.exe` on win; scripts `fetch-whisper:win`, `build-helper:win` |
| `scripts/publish-release.sh` | also uploads `Promptly-Setup-X.Y.Z.exe` + fixed-name `Promptly-Setup.exe` when present (downloaded from the Windows workflow's artifact) |
| `index.html`, `site/script.js` | download buttons: Mac DMG default; Windows visitors (`navigator.userAgentData.platform` / UA) get `releases/latest/download/Promptly-Setup.exe`; spec line shows both |
| `tests/*.test.js` | platform-parameterised tests for win32.js, hotkey presets, keys, claude-setup script writer |
| `e2e/app.spec.mjs`, `e2e/ui.spec.mjs` | use the Node fakes; skip Mac-only assertions on win32 (Accessibility, launchd) |
| `.github/workflows/preflight.yml` | unchanged (Mac); Windows gets its own workflow |

## 2. Out of scope — must not change
- `native/helper/main.swift` behaviour, `scripts/release.sh` Mac steps, DMG layout, signing identity.
- `main/llm.js` call shape (only binary resolution feeds it), prompts other than harness-files.
- History, config, profile formats. Any Mac UI layout.

## 3. Data / migration
None. New installs on Windows create `%APPDATA%\Promptly\config.json` as usual via `app.getPath('userData')`.

## 4. Main-process changes (by area)
1. **Platform select** (`index.js`) and **win32.js** — contract test asserts darwin.js and win32.js export the same keys.
2. **Binaries** — Claude Code install locations on Windows: native installer (`%USERPROFILE%\.local\bin\claude.exe`),
   npm global (`%APPDATA%\npm\claude.cmd`). `.cmd` files must be spawned with `shell: false` via `cmd.exe /d /s /c`
   argument array (Node refuses to spawn `.cmd` without a shell since the 2024 CVE fix) — handled in `llm.js`'s
   spawn call by resolving to `claude.exe` where possible and wrapping `.cmd` explicitly.
3. **Helper** — Rust binary, same protocol; `main/helper.js` untouched except the path.
4. **Hotkeys** — Windows presets; double-tap detection runs in the helper (as on Mac).
5. **Window + tray + permissions** — as in the impact map.
6. **Claude setup** — PowerShell scripts; detect Git for Windows (`git.exe` via `where`) and link to git-scm.com if missing.
7. **Scheduler** (phase 2) — `schtasks /Create /SC DAILY|WEEKLY|HOURLY /TN <label> /TR "powershell -NoProfile -File …" /ST HH:MM /F` via `execFile` arg array; `/Delete /F` to remove; weekdays via `/SC WEEKLY /D MON,TUE,WED,THU,FRI`.

## 5. Renderer changes
- `getPlatform()` once at startup → `keys` context; every label goes through it.
- Title bar: on Windows, 140 px reserved on the right for caption buttons (`titleBarOverlay` height 56 to match the toolbar).
- No other visual change.

## 6. Conventions to follow (from CLAUDE.md / ARCHITECTURE.md)
- Claude only through `main/llm.js`; `makeClaudeEnv(claudePath)`; prompt on stdin, `--model` always.
- External binaries: `execFile`/`spawn` with argument arrays, never shell strings (PowerShell and `schtasks` included).
- Platform paths only in `main/platform/*`. Modes only in `shared/modes.json`; prompt text only in `main/prompts/`.
- IPC: preload method + `ipcMain.handle`, contract test green.
- Colours via theme tokens; type scale 11–17 px; e2e layout audit must pass.
- Zero runtime npm deps; code and doc commits separate.

## 7. Task breakdown (phases → tasks in FEATURE_TASKS.md)
- **Phase 1A — Foundations (can be built and unit-tested on the Mac):** platform select + win32.js; keys module + renderer labels; hotkey presets per platform; binaries/.cmd handling; claude-setup PowerShell path; window/tray/permissions branching; get-platform IPC.
- **Phase 1B — Native + build (needs Windows CI):** Rust helper; whisper.cpp Windows build; electron-builder NSIS config; Windows CI workflow; Node fakes for e2e.
- **Phase 1C — Ship:** site OS-aware download; release publishing of the installer; docs; manual test pass on the Windows PC.
- **Phase 2 — Parity:** scheduler interface + Task Scheduler; Windows harness prompt; signing.

## 8. Rollback plan
All Windows code is additive behind `process.platform === 'win32'` or new files. Rollback = revert the feature's
commits; the Mac build never loads win32.js or the Rust helper. The site change falls back to the Mac DMG link.

## 9. Testing strategy
- **Unit (runs on Mac and Windows CI):** win32.js candidates and `where` parsing; darwin/win32 export parity;
  hotkey presets per platform; `formatHotkey`; claude-setup script contents; scheduler command args (phase 2);
  harness prompt choice (phase 2).
- **E2E (on the Windows PC, locally — not in CI, per the owner's 2026-09-28 call):** the existing app.spec and ui.spec with Node fakes; layout audit at 100% and 150% scaling.
- **Manual (owner's Windows PC, end of each phase):** checklist in FEATURE_TASKS.md — install, SmartScreen, mic prompt,
  Claude Code install/sign-in, hold and tap hotkeys, dictation into Notepad/VS Code/Chrome/Slack/Word, selection
  context, elevated-window fallback, AltGr layout, 150% scaling, uninstall.
- **Regression:** full Mac unit + e2e suites unchanged and green.

## 10. CODEBASE.md / ARCHITECTURE.md updates
- CODEBASE file map: win32.js, scheduler.js, keys.js, native/helper-win, fetch-whisper.ps1, build-helper-win.ps1,
  windows.yml, e2e fakes.
- ARCHITECTURE: "Platforms" section (seams, what may be platform-specific where); IPC table `get-platform`.
- SPEC.md out-of-scope line and PLAN.md feature map via `change:`.
- DECISIONS: D-WINDOWS (Rust helper, unsigned phase 1, Task Scheduler, PowerShell harness).

## Estimate
~26 tasks. Phase 1 ≈ 2.5–3 weeks of build time (1A ≈ 4–5 days, 1B ≈ 7–9 days, 1C ≈ 2–3 days plus the manual pass);
phase 2 ≈ 1 week plus signing setup.
