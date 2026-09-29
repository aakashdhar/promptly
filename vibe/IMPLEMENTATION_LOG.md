# IMPLEMENTATION_LOG — Promptly

> Implementation decisions worth remembering: hard to reverse, chosen among real alternatives, or
> surprising to a future reader. Newest last. Each entry: date · task · decision · why · Touches.
> Spec and scope decisions live in DECISIONS.md.

---
### 2026-09-28 · WIN-002 · Windows lookups use path.win32 and injectable process/file checks
- **Decision**: win32.js builds every path with `path.win32` and lets `shellWhich`, `appBundlePath` and
  `removeInstalledApp` take `{ run, fileExists }` as an optional last argument.
- **Why**: the Windows code is written and unit-tested on the Mac before a Windows machine is involved
  (Stage 1A); `path.win32` makes `C:\Users\Zoë Smith\…` come out identically on both, and the stubs replace
  `where.exe` and the NSIS uninstaller without touching the real system. Callers pass nothing.
- **Alternatives**: mocking `child_process`/`fs` module-wide (brittle across the shared test file).
- **Touches**: main/platform/win32.js (`shellWhich`, `appBundlePath`, `removeInstalledApp`, `binaryCandidates`), tests/main.test.js
---

---
### 2026-09-28 · WIN-003 · Windows .cmd launchers run through an escaped cmd.exe line
- **Decision**: `platform.spawnArgs(file, args, options)` → `[file, args, options]`, spread into every Claude
  spawn/execFile. On Windows a `.cmd`/`.bat` becomes `cmd.exe /d /s /c "<line>"` with `windowsVerbatimArguments`,
  each argument quoted C-runtime style and caret-escaped twice (npm launchers re-read `%*`), as cross-spawn does.
- **Why**: Node refuses `.cmd` without a shell since CVE-2024-27980, and `shell: true` would let cmd.exe interpret
  arguments. Zero runtime deps rules out cross-spawn itself. The prompt never enters the command line (stdin).
- **Alternatives**: `shell: true` (unsafe quoting); resolving the shim to `node cli.js` (brittle across npm versions).
- **Touches**: main/platform/{darwin,win32}.js (`spawnArgs`, `executableNames`, `USER_ENV_VARS`, `paths`),
  main/llm.js (`runOnce`, `version`), main/claude-setup.js (`execJson`, `execText`), main/binaries.js
  (`resolveBinary`, `makeClaudeEnv`), tests/main.test.js
---

---
### 2026-09-28 · WIN-005 · Key names load before the first render
- **Decision**: src/renderer/main.jsx awaits `loadKeys()` (one `get-platform` IPC) before `createRoot().render`,
  and `keys` is a plain module object components read at render time — no React context or state.
- **Why**: key names never change while the app runs, so a context/re-render path adds nothing; loading first means
  Windows never flashes ⌘ before Ctrl. A failed call keeps the Mac set, so a Mac can't regress.
- **Alternatives**: React context with a post-mount update (label flicker, every consumer re-renders); passing the
  platform on the URL/query (would need BrowserWindow changes in main.js for three windows).
- **Touches**: src/renderer/main.jsx, src/renderer/utils/keys.js (`keys`, `loadKeys`, `combo`), main/keys.js, main.js (`get-platform`), preload.js (`getPlatform`)
---

---
### 2026-09-28 · WIN-008 · Setup blockers come from a new setup-info channel, detected by "did it start"
- **Decision**: a new `setup-info` IPC (not extra fields on `claude-status`) carries the install command, terminal
  name, `gitMissing` and `blocked`. A binary counts as blocked when it fails to start (string error code), not when it
  exits non-zero or times out.
- **Why**: keeps every existing response shape as it is (Ask-first rule). Quarantine and SmartScreen blocks surface
  as spawn failures, while a working whisper-cli/helper may legitimately exit non-zero for `--help`/`--version`.
- **Alternatives**: extending `claude-status` (shape change); checking Windows Defender's history via PowerShell
  (slow, needs parsing, only covers Defender).
- **Touches**: main.js (`setup-info`, claude-install/login via `platform.openSetupScript`, HELPER_PATH),
  preload.js (`setupInfo`), splash.html (`applySetupInfo`), main/platform/{darwin,win32}.js, main/claude-setup.js
---

---
### 2026-09-28 · Wave 1 · WIN-009 · Windows tray Uninstall runs a generated PowerShell script after Promptly exits
- **Decision**: `platform.uninstallLaunch` writes a temp .ps1 run by hidden `powershell.exe -File` (pid, install dir, data paths as separate args); it waits for exit, runs `Uninstall Promptly.exe /S _?=<dir>`, then deletes the install folder and %APPDATA%/%LOCALAPPDATA%\Promptly. Windows setup skips Accessibility through `accessibility-status` `available: false`.
- **Why**: same rule as the Mac freeze fix — nothing deleted while Promptly runs; NSIS keeps user data and `_?=` stops it returning before it's done. Reusing `available: false` needed no splash change.
- **Touches**: main/platform/{darwin,win32}.js (`uninstallLaunch`, `UNINSTALL_TEXT`, `windowChrome`, `TRAY_CLICK_BLURS`, `microphoneAccess`), main.js (`handleUninstall`, `createWindow`, tray click, `accessibility-status`, `request-microphone`)
---
### 2026-09-28 · Wave 1 · WIN-012 · Windows helper: platform-independent engine, thin Win32 hook
- **Decision**: hotkey timing lives in engine.rs (no Windows calls, `cargo test` on the Mac); hook.rs only adapts WH_KEYBOARD_LL events. AltGr counts as right Alt (its fake left Ctrl, scan 0x21D, is dropped); VK 0xE8 is tapped after a swallowed Alt/Win so menus/Start don't open; stdout goes through one writer thread so the hook never blocks (Windows silently removes hooks that time out). Static CRT; deps windows-sys + serde_json only.
- **Alternatives**: a single cfg(windows) file (untestable off Windows); the `windows` crate (larger); writing stdout from the hook (can stall typing system-wide).
- **Touches**: native/helper-win/src/{engine,hook,output,protocol}.rs, .cargo/config.toml, Cargo.toml
---
### 2026-09-28 · Wave 1 · WIN-015 · fetch-whisper.ps1 reads its pins from fetch-whisper.sh
- **Decision**: the PowerShell script parses the .sh's `NAME="..."` pins (tag, commit, model URLs, SHA-256s, cmake version) at run time; builds with the static MSVC runtime and GGML_OPENMP=OFF.
- **Why**: one source of truth for every pin; a whisper-cli.exe that needs no VC++ redistributable or vcomp140.dll, so the installer ships just the exe and models.
- **Touches**: scripts/fetch-whisper.ps1, scripts/fetch-whisper.sh (its top-level format is now load-bearing)
---
### 2026-09-28 · Wave 1 · WIN-016 · e2e fakes start through a generated launcher running the test runner's Node
- **Decision**: `installFake` writes a /bin/sh `exec` shim (Mac) or `.cmd` (Windows) at the path the app expects, running `process.execPath` on the .mjs.
- **Why**: tests delete/relocate fakes per run; makeClaudeEnv rewrites PATH so `node` may not be found; `exec` keeps cancel's SIGTERM reaching the fake; `.cmd` lets spawnArgs start it on Windows.
- **Touches**: e2e/fakes/install.mjs, e2e/app.spec.mjs, e2e/ui.spec.mjs
---

---
### 2026-09-28 · Wave 2 · WIN-013 · Selection via UI Automation, then a guarded, clipboard-exact Ctrl+C
- **Decision**: read selected text through UI Automation (the `windows` crate, COM only); fall back to Ctrl+C only for fields with no text pattern that are known not to be passwords, aren't terminals, with Alt/Shift/Win up. Save every clipboard format in full (≤200 ms, ≤64 MB) or don't copy; restore exactly, even after a late copy; mark the restored item not for Win+V history/cloud.
- **Why**: Ctrl+C in a terminal stops the running command, with Shift/Alt it becomes another shortcut; the owner's rule is that the clipboard always comes back. Hand-written COM vtables for UIA would be untestable on the Mac.
- **Touches**: native/helper-win/src/{context,uia,clipboard,apps,keys,paste}.rs, Cargo.toml
---
### 2026-09-28 · Wave 2 · WIN-011 · Windows tray states are coloured discs, not a status dot
- **Decision**: at 16 px a Mac-style dot can't be read, so each state is a coloured disc with a light mic that shows on light and dark taskbars; `platform.TRAY_TEMPLATE_ICONS` picks the drawing in main.js. The .ico is built from build/icon.png by a package-free PNG decoder/ICO writer.
- **Touches**: main/tray-icon.js (`drawWinTrayIcons`), main.js (`createMicIcon`), scripts/generate-icon.js, build/icon.ico
---
### 2026-09-28 · Wave 2 · setup-info split into instant wording and slow checks
- **Decision**: `setup-info` returns only wording; `setup-checks` starts the binaries (antivirus check) and looks for Git.
- **Why**: the checks can take up to 5 s; with one channel the Windows welcome screen showed Mac wording until they finished.
- **Touches**: main.js, preload.js (`setupChecks`), splash.html (`applySetupInfo`)
---
---
### 2026-09-29 · D-LOGO · Icons rendered from one SVG through Playwright's Chromium
- **Decision**: generate-icon.js now builds the mark as SVG and rasterises each size in headless Chromium (already a dev dependency for e2e) instead of drawing with the `canvas` package; each size is rendered directly, not downscaled, so 16/32 px get their own cuts. The ICO writer keeps its package-free BMP/PNG entries.
- **Why**: one source of truth for every icon file, and crisp small sizes; the old path needed a native `canvas` build and could only downscale one 1024 px image.
- **Touches**: scripts/generate-icon.js, main/tray-icon.js (`drawMicIconPng` now strokes the mark with coverage-based anti-aliasing; Windows discs use the same shapes on a 32-unit grid), tests/main.test.js (pinned menu bar hash updated)
---
