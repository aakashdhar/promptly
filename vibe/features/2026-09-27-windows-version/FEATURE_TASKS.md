# FEATURE_TASKS — Promptly for Windows

> Spec: FEATURE_SPEC.md (approved 2026-09-27) · Plan: FEATURE_PLAN.md (approved 2026-09-28)
> **Estimated effort:** 26 tasks — S: 10 (<2hrs), M: 14 (2-4hrs), L: 2 (4+hrs) — approx. 69 hours total
> Stages: **1A** foundations (buildable and unit-tested on the Mac) → **1B** native + build (needs a
> Windows machine or the Windows CI build) → **1C** ship → **2** parity (Harness scheduling, signing).
> Every Mac path keeps working exactly as today; Windows code sits behind `process.platform === 'win32'`,
> `main/platform/win32.js` or `native/helper-win/`. E2E runs locally only (on the Windows PC for Windows).

---

## Stage 1A — Foundations (on the Mac)

---
### WIN-001 · Platform selector and a win32 module with the same shape as darwin
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#5-integration-points
- **Dependencies**: None
- **Touches**: main/platform/index.js, main/platform/win32.js (new), tests/main.test.js

**What to do**: `index.js` picks `./win32` when `process.platform === 'win32'`, else `./darwin` (update its
comment). Create `win32.js` exporting every key darwin.js exports (PRIVACY_SETTINGS, SCHEDULE_PATH,
launchAgentsDir, loadLaunchAgent, unloadLaunchAgent, harnessLaunchAgents, PATH_DELIMITER, DEFAULT_PATH,
SSL_ENV, binaryCandidates, nodeVersionBinDirs, isShim, shellWhich, resolveShim, hasPythonWhisperModule,
whisperPathDirs, whisperModelCacheDirs, uninstallDataPaths, resetMicrophonePermission, appBundlePath,
removeInstalledApp) as safe stubs: `PATH_DELIMITER ';'`, empty lists, `null`/`{ ok: false, error: 'Not on
Windows yet' }` results. Real bodies land in WIN-002 and WIN-024.

**Acceptance criteria**:
- [x] `require('./main/platform')` still returns darwin on macOS (no Mac behaviour change)
- [x] darwin.js and win32.js export the same set of keys, with matching types (function vs value)

**Self-verify**: Re-read FEATURE_SPEC.md#5. Tick every criterion.
**Test requirement**: contract test in tests/main.test.js: `Object.keys(darwin)` equals `Object.keys(win32)` and each pair has the same `typeof`.
**⚠️ Boundaries**: Never change darwin.js behaviour here.
**CODEBASE.md update?**: Yes — win32.js row; platform/index.js description.
**Architecture compliance**: platform specifics only in main/platform/*.

**Decisions**:
> Filled in by agent after completing.
- win32.js also mirrors `uninstallScriptPath` (added to darwin.js after the plan). Async darwin functions stay async in win32 so callers await the same way; `unloadLaunchAgent` answers ok (nothing scheduled), `PRIVACY_SETTINGS.accessibility` is null (Windows has no such permission) — WIN-009 guards the caller.
---

---
### WIN-002 · Find Claude, Whisper and ffmpeg on Windows
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (10, 11, 17), #8-edge-cases-and-error-states
- **Dependencies**: WIN-001
- **Touches**: main/platform/win32.js, tests/main.test.js

**What to do**: Implement the lookup half of win32.js: `binaryCandidates(home)` for `claude.exe`/`claude.cmd`
(`%USERPROFILE%\.local\bin`, `%APPDATA%\npm`, `%LOCALAPPDATA%\Programs`, Scoop `~\scoop\shims`, Chocolatey
`C:\ProgramData\chocolatey\bin`), `whisper-cli.exe`, `ffmpeg.exe`; `DEFAULT_PATH` (System32, Windows, PowerShell);
`shellWhich(name)` via `execFile('where.exe', [name], { timeout: 5000 })` taking the first line that exists;
`nodeVersionBinDirs` for nvm-windows (`%APPDATA%\nvm\v*`); `whisperPathDirs`, `whisperModelCacheDirs`;
`uninstallDataPaths(home)` → `%APPDATA%\Promptly`, `%LOCALAPPDATA%\Promptly`; `resetMicrophonePermission` →
resolves `{ ok: true }` (nothing to reset); `appBundlePath(exe)` → install folder when it contains
`Uninstall Promptly.exe`, else null; `removeInstalledApp` → run the NSIS uninstaller with `/S` via execFile;
`PRIVACY_SETTINGS = { microphone: 'ms-settings:privacy-microphone', accessibility: null }`. A WSL-only Claude
is not found (never look inside `\\wsl$`).

**Acceptance criteria**:
- [ ] Candidates cover native installer, npm global, Scoop and Chocolatey locations
- [ ] `where.exe` output with several lines or a CRLF resolves to the first existing file
- [ ] Paths with spaces and non-ASCII user names (`C:\Users\Zoë Smith`) are kept intact

**Self-verify**: Re-read FEATURE_SPEC.md#8. Tick every criterion.
**Test requirement**: unit tests with `path.win32` paths and a stubbed `execFile` for `where.exe` (CRLF, missing, multiple results).
**⚠️ Boundaries**: execFile with argument arrays only — no `cmd /c "…"` strings.
**CODEBASE.md update?**: Yes — win32.js row lists what it resolves.
**Architecture compliance**: rule 2 (external binaries), rule 3 (platform paths).

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-003 · Run Claude's `.cmd` shim safely and build a Windows PATH
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (10), #8
- **Dependencies**: WIN-002
- **Touches**: main/binaries.js, main/llm.js, tests/main.test.js

**What to do**: Node refuses to spawn `.cmd`/`.bat` without a shell (CVE-2024-27980). Add
`platform.spawnArgs(binPath, args)` (darwin: identity; win32: for `.cmd`/`.bat` return
`['cmd.exe', ['/d', '/s', '/c', binPath, ...args]]` with each arg quoted per cmd rules, else identity) and use it
in llm.js `runOnce`/`version` and claude-setup's exec helpers. `makeClaudeEnv` already uses `PATH_DELIMITER`;
also carry `USERPROFILE`, `APPDATA`, `LOCALAPPDATA` and set `USERNAME` when missing on win32. Prefer `claude.exe`
over `claude.cmd` when both exist.

**Acceptance criteria**:
- [ ] On macOS the spawn arguments are byte-for-byte what they are today
- [ ] A `.cmd` path is run through `cmd.exe /d /s /c` with the prompt still on stdin, never on the command line
- [ ] preflight CHECK 7 (makeClaudeEnv everywhere) still passes

**Self-verify**: Re-read FEATURE_SPEC.md#9 (architecture rules). Tick every criterion.
**Test requirement**: unit tests for spawnArgs on both platforms (inject platform) and for makeClaudeEnv with `;` PATHs.
**⚠️ Boundaries**: Ask first before changing llm.js's call shape beyond the spawn target.
**CODEBASE.md update?**: Yes — binaries.js/llm.js rows.
**Architecture compliance**: rule 1 (Claude only via llm.js, makeClaudeEnv), rule 2.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-004 · Whisper binary name and temp paths from the platform
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (9)
- **Dependencies**: WIN-001
- **Touches**: main/whisper.js, main/platform/{darwin,win32}.js, tests/speech.test.js

**What to do**: Add `platform.WHISPER_CLI` (`whisper-cli` / `whisper-cli.exe`) and use it in `findBundledEngine`.
Audit whisper.js and main.js for `/tmp` or `/`-joined paths; everything goes through `path.join` and
`os.tmpdir()`. Python-whisper fallback stays Mac-only (win32 `hasPythonWhisperModule` → false).

**Acceptance criteria**:
- [ ] The bundled engine is found as `whisper-cli.exe` on Windows and unchanged on Mac
- [ ] No hard-coded POSIX temp paths remain in main/

**Self-verify**: Re-read FEATURE_SPEC.md#3 (9). Tick every criterion.
**Test requirement**: findBundledEngine test with a fake `.exe` engine dir under an injected win32 platform.
**⚠️ Boundaries**: Never change the Mac engine lookup order.
**CODEBASE.md update?**: No — logic only (note in whisper.js row if the export list changes).
**Architecture compliance**: rule 3.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-005 · One source for key names (⌘ vs Ctrl) and a get-platform IPC
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#7-ipc--api-changes, #3 (5)
- **Dependencies**: None
- **Touches**: main/keys.js (new), main.js, preload.js, src/renderer/utils/keys.js (new), tests/main.test.js, tests/ipc-contract.test.js

**What to do**: `main/keys.js`: `keysFor(platform)` → `{ os, mod, alt, ctrl, shift, enter }` (darwin: ⌘ ⌥ ⌃ ⇧ ↩;
win32: Ctrl Alt Ctrl Shift Enter) and `formatCombo(parts, platform)` (Mac joins symbols without `+`, Windows joins
words with `+`). `ipcMain.handle('get-platform')` returns `keysFor(process.platform)`; preload `getPlatform()`.
Renderer `utils/keys.js` loads it once at startup (default: the Mac set, so first paint is unchanged on Mac)
and exposes `keys` + `combo(...)`.

**Acceptance criteria**:
- [ ] On macOS every value equals the symbols used today
- [ ] IPC contract test passes with the new channel

**Self-verify**: Re-read FEATURE_SPEC.md#7. Tick every criterion.
**Test requirement**: unit tests for keysFor/formatCombo on both platforms.
**⚠️ Boundaries**: Adding a channel = preload method + handler (rule 5).
**CODEBASE.md update?**: Yes — keys.js rows, IPC table `get-platform`.
**Architecture compliance**: rule 5 (IPC).

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-006 · Show Ctrl / Alt / Shift on Windows everywhere a key is named
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (5)
- **Dependencies**: WIN-005
- **Touches**: src/renderer/components/{ExpandedDetailPanel,ExpandedHistoryList,ExpandedTransportBar,ExpandedTypingContent,ExpandedView,ModeDropdown,SettingsPanel,ShortcutsPanel,WorkflowBuilderDoneState}.jsx, src/renderer/hooks/{useDictation,useHotkeyWords,useKeyboardShortcuts,useWindowLayout}.js, pill.html, splash.html

**What to do**: Replace every literal ⌘ ⌥ ⌃ ⇧ in labels, hints and aria text with `keys.*` / `combo(...)`
(pill.html and splash.html call `electronAPI.getPlatform()` once). Keyboard handling itself already accepts
`metaKey || ctrlKey`; leave it. No per-file `process.platform` checks.

**Acceptance criteria**:
- [ ] `grep -r "⌘\|⌥\|⌃" src/renderer pill.html splash.html` finds only keys.js
- [ ] Mac screenshots (ui.spec) are unchanged

**Self-verify**: Re-read FEATURE_SPEC.md#3 (5). Tick every criterion.
**Test requirement**: run `npm run test:e2e` on the Mac (layout audit + screenshots unchanged).
**⚠️ Boundaries**: Ask first if a shared component needs more than a label change.
**CODEBASE.md update?**: No — logic only.
**Architecture compliance**: rule 8 (theme/type unchanged), one component per file.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-007 · Windows hotkey presets
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (4)
- **Dependencies**: WIN-005
- **Touches**: main/hotkey.js, main.js, tests/main.test.js

**What to do**: `HOTKEY_PRESETS` becomes per platform. win32: `double-control` (default), `alt-space`,
`right-alt` (hold; note AltGr on some layouts), `ctrl-alt-space`, `ctrl-shift-space`; no `fn`. Each has
`label/short/action` in Windows words, an Electron `accelerator` where one exists, and a `helper` descriptor with
Windows virtual-key codes. `getPreset`/`DEFAULT_HOTKEY`/`hotkeyWords` pick by platform (injectable for tests).
A stored Mac-only preset on Windows falls back to the default. The hold/tap state machine is unchanged.

**Acceptance criteria**:
- [ ] macOS presets, labels and default are identical to today
- [ ] Windows offers exactly the five presets above, default double-tap Ctrl

**Self-verify**: Re-read FEATURE_SPEC.md#3 (4). Tick every criterion.
**Test requirement**: extend the "Double-tap Control" tests with win32 preset/default/fallback cases.
**⚠️ Boundaries**: Never modify the existing hold-to-talk tests; add new ones.
**CODEBASE.md update?**: Yes — hotkey.js row.
**Architecture compliance**: logic in main/ with unit tests.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-008 · Claude Code install and sign-in through PowerShell
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (11), #8
- **Dependencies**: WIN-002, WIN-003
- **Touches**: main/claude-setup.js, main/platform/{darwin,win32}.js, main.js, tests/main.test.js

**What to do**: Move "write a script and open it in a terminal" behind the platform: darwin keeps the `.command`
file opened in Terminal; win32 writes a `.ps1` to userData and runs `execFile('powershell.exe', ['-NoProfile',
'-ExecutionPolicy', 'Bypass', '-NoExit', '-File', script])` in a new window. Install command on Windows:
`irm https://claude.ai/install.ps1 | iex`. Detect Git for Windows (`where.exe git`) and return
`{ gitMissing: true }` so setup can link to git-scm.com. `INSTALL_COMMAND` shown in the wizard comes from the platform.
Antivirus/SmartScreen check: at setup, run `whisper-cli.exe --help` and ask the helper for `status` once; if either
fails to start (blocked or quarantined), the wizard names the file that was blocked and says to allow it. Mac: no-op.

**Acceptance criteria**:
- [ ] Mac install/sign-in scripts are byte-for-byte unchanged
- [ ] The Windows script contains the official PowerShell install line and is launched without a shell string
- [ ] A missing Git for Windows is reported, not a crash
- [ ] A blocked whisper-cli.exe or promptly-helper.exe is named in setup

**Self-verify**: Re-read FEATURE_SPEC.md#3 (11). Tick every criterion.
**Test requirement**: unit tests for the Windows script contents and launch arguments (stubbed execFile).
**⚠️ Boundaries**: Never run PowerShell with a composed command string.
**CODEBASE.md update?**: Yes — claude-setup.js row.
**Architecture compliance**: rules 2 and 3.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-009 · Window, tray and permissions that behave like Windows
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (2, 3, 11, 12, 17)
- **Dependencies**: WIN-001, WIN-005
- **Touches**: main.js, main/platform/{darwin,win32}.js

**What to do**: Window options come from `platform.windowChrome(theme)`: darwin keeps `hiddenInset` +
`trafficLightPosition`; win32 uses `titleBarStyle: 'hidden'` + `titleBarOverlay: { color, symbolColor,
height: 56 }` following the theme. Tray: left-click toggles the window on Windows (menu on right-click). Setup
skips the Accessibility step on Windows; "open microphone settings" uses `platform.PRIVACY_SETTINGS.microphone`.
"Launch at login" uses `app.setLoginItemSettings` (works on both). Uninstall on Windows keeps
`%APPDATA%\Promptly` (NSIS uninstaller); the tray's "Uninstall Promptly…" removes the app and its data, as on the Mac.

**Acceptance criteria**:
- [ ] Mac window, tray and permission flows are unchanged (e2e green on the Mac)
- [ ] No `x-apple.systempreferences` or `trafficLightPosition` is used on win32

**Self-verify**: Re-read FEATURE_SPEC.md#3 (2, 3, 11). Tick every criterion.
**Test requirement**: unit test for windowChrome on both platforms; Mac e2e suite green.
**⚠️ Boundaries**: Ask first before changing any Mac window option.
**CODEBASE.md update?**: Yes — main.js notes, darwin/win32 rows.
**Architecture compliance**: main.js wires only; logic in main/platform.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-010 · Leave room for the Windows caption buttons in the toolbar
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (3), FEATURE_PLAN.md#5
- **Dependencies**: WIN-005, WIN-009
- **Touches**: src/renderer/components/ExpandedTransportBar.jsx, src/renderer/components/SettingsPanel.jsx

**What to do**: Toolbars reserve 96 px on the left on Mac (traffic lights). On Windows reserve 0 px left and 140 px
right (caption buttons) instead, from `keys.os`. Every clickable item stays `no-drag`.

**Acceptance criteria**:
- [ ] Mac padding unchanged (screenshots identical)
- [ ] On Windows nothing sits under the minimise/maximise/close buttons

**Self-verify**: Re-read FEATURE_SPEC.md#3 (3). Tick every criterion.
**Test requirement**: Mac e2e layout audit green; Windows check in WIN-023.
**⚠️ Boundaries**: Label/padding only — no other visual change.
**CODEBASE.md update?**: No.
**Architecture compliance**: `WebkitAppRegion: 'no-drag'` on clickables; theme tokens.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-011 · Windows tray and app icons
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (2)
- **Dependencies**: WIN-001
- **Touches**: main/tray-icon.js, scripts/generate-icon.js, build/icon.ico (new), tests/main.test.js

**What to do**: tray-icon.js draws coloured (non-template) 16/32 px icons on win32 for idle, recording, thinking
and ready, since Windows has no template images. generate-icon.js also writes `build/icon.ico` (16–256 px).

**Acceptance criteria**:
- [ ] Mac tray icons are unchanged (template images)
- [ ] Windows gets a visible icon per state and an .ico for the installer

**Self-verify**: Re-read FEATURE_SPEC.md#3 (2). Tick every criterion.
**Test requirement**: extend the tray-icon tests: win32 states are not template images and have 16 and 32 px sizes.
**⚠️ Boundaries**: Never change the Mac icon drawing.
**CODEBASE.md update?**: Yes — tray-icon.js row, build/ assets.
**Architecture compliance**: no Electron imports in main/tray-icon.js.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

## Stage 1B — Native helper and build (needs Windows)

---
### WIN-012 · Windows helper: protocol, status and hotkeys (Rust)
- **Status**: `[ ]`
- **Size**: L
- **Spec ref**: FEATURE_SPEC.md#5 (helper protocol), #3 (4), #9 (latency)
- **Dependencies**: WIN-007
- **Touches**: native/helper-win/Cargo.toml (new), native/helper-win/src/main.rs (new)

**What to do**: A console-less Rust binary using the `windows` crate that speaks the same JSON lines as
native/helper/main.swift: requests `configure {hotkey}`, `status`, `requestAccess`; events `ready`,
`status {trusted: true, tap}`, `hotkey {phase: down|up|cancel}`. A `WH_KEYBOARD_LL` hook on its own thread with a
message loop implements modifier-only holds, double-tap Ctrl (same timing as Swift) and combos; injected events
(`LLKHF_INJECTED`) are ignored. Each `hotkey` event carries `t` (ms since start) so main can log the delay to
recording (latency NFR). stdout is flushed per line; stdin EOF exits.

**Acceptance criteria**:
- [ ] Same messages and fields as the Swift helper for configure/status/hotkey
- [ ] Hold-to-talk key down → `hotkey down` in under 150 ms
- [ ] Double-tap Ctrl, hold Right Alt, Alt+Space all work

**Self-verify**: Re-read FEATURE_SPEC.md#5. Tick every criterion.
**Test requirement**: Rust unit tests for the tap/double-tap timing logic; main/helper.js tests pass unchanged against the protocol.
**⚠️ Boundaries**: Never change the JSON protocol (both helpers must match).
**CODEBASE.md update?**: Yes — native/helper-win row.
**Architecture compliance**: native helper is the only place with OS input code.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-013 · Windows helper: front app, selected text and paste
- **Status**: `[ ]`
- **Size**: L
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (6, 7, 8), #8
- **Dependencies**: WIN-012
- **Touches**: native/helper-win/src/main.rs (+ modules)

**What to do**: `context` → `{ app: { name, bundleId: exe path, pid }, selectedText }`: `GetForegroundWindow` +
`QueryFullProcessImageNameW` (friendly name from the exe's FileDescription), selection via UI Automation
`TextPattern.GetSelection` with a 500 ms budget; if the app doesn't expose it (Chrome, Slack, most Electron apps),
fall back to: save the clipboard (all formats), send Ctrl+C, read the text within 300 ms, restore the clipboard exactly.
Skip the fallback when a password field has focus (UIA `IsPassword`). `paste` → `SendInput` Ctrl+V; if the foreground window is elevated and we are
not, return `{ ok: false, reason: 'elevated' }` so main falls back to "Copied — press Ctrl+V".

**Acceptance criteria**:
- [ ] Selection is read in Notepad, VS Code, Chrome and Word (UIA or the Ctrl+C fallback); apps with nothing selected return none, no error
- [ ] After the fallback the clipboard holds exactly what it held before; password fields are never copied
- [ ] "Code.exe" reports as Visual Studio Code
- [ ] Paste into an elevated window falls back with the reason shown

**Self-verify**: Re-read FEATURE_SPEC.md#3 (6–8). Tick every criterion.
**Test requirement**: manual checks in WIN-023; unit tests for the exe → name mapping.
**⚠️ Boundaries**: The only clipboard use is the fallback's save → copy → restore; it must always restore, even on timeout.
**CODEBASE.md update?**: Yes — native/helper-win row.
**Architecture compliance**: same protocol as Swift.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-014 · Build the Windows helper and point main at it
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_PLAN.md#1 (scripts)
- **Dependencies**: WIN-012
- **Touches**: scripts/build-helper-win.ps1 (new), main.js (HELPER_PATH), package.json (scripts)

**What to do**: `build-helper-win.ps1`: `cargo build --release --manifest-path native/helper-win/Cargo.toml`,
copy to `vendor/helper/promptly-helper.exe`, skip when up to date. `HELPER_PATH` uses the platform's helper file
name. npm script `build-helper:win`.

**Acceptance criteria**:
- [ ] `npm run build-helper:win` produces vendor/helper/promptly-helper.exe
- [ ] Mac helper path and build unchanged

**Self-verify**: Tick every criterion.
**Test requirement**: build on the Windows PC / Windows CI.
**⚠️ Boundaries**: Never change scripts/build-helper.sh.
**CODEBASE.md update?**: Yes — scripts rows.
**Architecture compliance**: rule 11 (packaging).

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-015 · Build whisper.cpp and fetch the models on Windows
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (9)
- **Dependencies**: WIN-004
- **Touches**: scripts/fetch-whisper.ps1 (new), package.json

**What to do**: Same pins as fetch-whisper.sh (WHISPER_TAG, WHISPER_COMMIT, model SHA-256s): clone, verify the
commit, build `whisper-cli.exe` with CMake + MSVC (`-DBUILD_SHARED_LIBS=OFF`, CPU; Vulkan off in phase 1),
download base + VAD models and verify their checksums into vendor/whisper/. npm script `fetch-whisper:win`.

**Acceptance criteria**:
- [ ] Refuses to build a commit other than WHISPER_COMMIT; refuses a model with the wrong checksum
- [ ] vendor/whisper/whisper-cli.exe transcribes a sample WAV

**Self-verify**: Tick every criterion.
**Test requirement**: run on the Windows PC / Windows CI.
**⚠️ Boundaries**: Pins come from one place — read them from fetch-whisper.sh, don't copy numbers.
**CODEBASE.md update?**: Yes — scripts rows.
**Architecture compliance**: supply-chain pins (D-AUDIT-MODERATE).

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-016 · Node fakes so the e2e suite runs on both systems
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_PLAN.md#9
- **Dependencies**: WIN-003, WIN-004
- **Touches**: e2e/fakes/{claude,whisper,ffmpeg,helper}.mjs (new), e2e/app.spec.mjs, e2e/ui.spec.mjs

**What to do**: Port the bash fakes written by `writeFakeTools`/`writeFakeClaude` to Node scripts with the same
behaviour (args/stdin logging, FAKE_DIR switches, delays, stream-json). On macOS write a tiny shebang wrapper;
on Windows a `.cmd` shim calling `node`. The specs call one helper that returns the right paths.

**Acceptance criteria**:
- [ ] The Mac e2e suite passes with the Node fakes (48/48)
- [ ] No bash-only syntax left in the fakes

**Self-verify**: Tick every criterion.
**Test requirement**: `npm run test:e2e` on the Mac green; later on the Windows PC.
**⚠️ Boundaries**: Never weaken an assertion to make a fake easier.
**CODEBASE.md update?**: Yes — e2e rows.
**Architecture compliance**: tests only.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-017 · Windows installer (NSIS) configuration
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (1, 14, 16, 17)
- **Dependencies**: WIN-011, WIN-014, WIN-015
- **Touches**: package.json (build.win, build.nsis, extraResources), build/installer.nsh (if needed)

**What to do**: `build.win`: target nsis, arch x64, icon build/icon.ico, `artifactName:
Promptly-Setup-${version}.exe`. `build.nsis`: oneClick false, perMachine false,
allowToChangeInstallationDirectory true, deleteAppDataOnUninstall false. extraResources for win:
vendor/helper/promptly-helper.exe → helper/, vendor/whisper/*.exe + models → whisper/. Unsigned in phase 1.
npm script `dist:win`.

**Acceptance criteria**:
- [ ] `npm run dist:win` on Windows produces an installer that installs, starts and uninstalls
- [ ] Mac `build` config and DMG unchanged; installer within 15% of the DMG size

**Self-verify**: Re-read FEATURE_SPEC.md#3 (14). Tick every criterion.
**Test requirement**: install/uninstall on the Windows PC (WIN-023).
**⚠️ Boundaries**: Never change build.mac or build.dmg.
**CODEBASE.md update?**: Yes — packaging notes.
**Architecture compliance**: rule 10 (no runtime deps), rule 11 (packaging).

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-018 · Windows build in CI (no e2e)
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (14)
- **Dependencies**: WIN-014, WIN-015, WIN-017
- **Touches**: .github/workflows/windows.yml (new)

**What to do**: windows-latest, SHA-pinned actions: npm ci, lint, unit tests, fetch-whisper:win, build-helper:win
(with the Rust toolchain), build:renderer, `electron-builder --win nsis --x64`; upload the installer as an artifact.
No e2e (owner, 2026-09-28).

**Acceptance criteria**:
- [ ] A push produces a downloadable `Promptly-Setup-X.Y.Z.exe` artifact
- [ ] Unit tests and lint pass on Windows

**Self-verify**: Tick every criterion.
**Test requirement**: the workflow run itself.
**⚠️ Boundaries**: Don't touch .github/workflows/preflight.yml (Mac).
**CODEBASE.md update?**: Yes — CI row.
**Architecture compliance**: SHA-pinned actions (D-AUDIT-MODERATE).

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-019 · Make the e2e specs Windows-aware
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (13)
- **Dependencies**: WIN-016
- **Touches**: e2e/app.spec.mjs, e2e/ui.spec.mjs

**What to do**: Skip Mac-only assertions on win32 with a stated reason (Accessibility step, launchd plist,
pbpaste/pbcopy → PowerShell `Get-Clipboard`/`Set-Clipboard` equivalents). ui.spec's layout audit also runs at
150% device scale factor on Windows.

**Acceptance criteria**:
- [ ] Every skip names why; no test is silently skipped on the Mac
- [ ] Layout audit passes at 100% and 150% on the Windows PC

**Self-verify**: Re-read FEATURE_SPEC.md#3 (13). Tick every criterion.
**Test requirement**: Mac e2e unchanged (48/48); Windows run in WIN-023.
**⚠️ Boundaries**: Never modify an existing Mac assertion.
**CODEBASE.md update?**: No.
**Architecture compliance**: tests only.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

## Stage 1C — Ship

---
### WIN-020 · Publish the Windows installer with each release
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (15)
- **Dependencies**: WIN-017
- **Touches**: scripts/publish-release.sh

**What to do**: When `dist/Promptly-Setup-X.Y.Z.exe` is present (downloaded from the Windows build), upload it and a
fixed-name `Promptly-Setup.exe` to the same GitHub Release, and check
`releases/latest/download/Promptly-Setup.exe` redirects to the new version (same check as the DMG).

**Acceptance criteria**:
- [ ] Mac-only releases work exactly as today when no installer is present
- [ ] Both links point at the new version after a release with the installer

**Self-verify**: Tick every criterion.
**Test requirement**: dry run with a stub gh; real run at the first Windows release.
**⚠️ Boundaries**: Never change the DMG upload.
**CODEBASE.md update?**: Yes — publish-release row.
**Architecture compliance**: strict mode kept.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-021 · The site offers each visitor the right download
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (15, 16)
- **Dependencies**: WIN-020
- **Touches**: index.html, site/script.js, scripts/release.sh (version line only if needed)

**What to do**: Default buttons stay the Mac DMG. On Windows (`navigator.userAgentData?.platform` or UA),
script.js swaps href and label to `Promptly-Setup.exe` / "Download for Windows". The download note mentions
SmartScreen's "More info → Run anyway" for Windows alongside Mac's Open Anyway.

**Acceptance criteria**:
- [ ] Mac and no-JS visitors still get the DMG
- [ ] Windows visitors get the .exe link and the SmartScreen note

**Self-verify**: Tick every criterion.
**Test requirement**: load the page with a Windows UA in the browser pane.
**⚠️ Boundaries**: No visual redesign of the site.
**CODEBASE.md update?**: Yes — site row.
**Architecture compliance**: site is not packaged (index.html, site/).

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-022 · Docs for the two-platform codebase
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#10-conformance-checklist
- **Dependencies**: WIN-001..WIN-021
- **Touches**: vibe/CODEBASE.md, vibe/ARCHITECTURE.md, vibe/SPEC.md, vibe/PLAN.md, vibe/DECISIONS.md, CLAUDE.md

**What to do**: ARCHITECTURE: a "Platforms" section (what may be platform-specific and where) and `get-platform` in
the IPC table. SPEC.md's out-of-scope line becomes "Linux" only. CLAUDE.md commands for the Windows scripts.
D-WINDOWS decision entry.

**Acceptance criteria**:
- [ ] A fresh session can find every platform seam from CODEBASE.md alone

**Self-verify**: Re-read FEATURE_SPEC.md#10. Tick every criterion.
**Test requirement**: none (docs).
**⚠️ Boundaries**: Docs commit separate from code.
**CODEBASE.md update?**: Yes.
**Architecture compliance**: —

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-023 · Hands-on test pass on the Windows PC (phase 1)
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (1–17), #8
- **Dependencies**: WIN-001..WIN-022
- **Touches**: none (records results in this file)

**What to do**: On Windows 11 (and 10 22H2 if available), with the CI installer: install (SmartScreen), mic
prompt, Claude Code install/sign-in, each hotkey hold + tap, dictation into Notepad / VS Code / Chrome / Slack /
Word, selection context, elevated-window fallback, AltGr layout, 100% and 150% scaling, multi-monitor pill
position, local e2e suite, uninstall (NSIS keeps data; tray Uninstall removes it), hold-to-talk latency from
main.log over 20 presses (p95 < 150 ms). Log each result here; bugs go through `bug:`.

**Acceptance criteria**:
- [ ] Every item passes or has a filed, triaged bug

**Self-verify**: Tick every criterion.
**Test requirement**: this checklist.
**⚠️ Boundaries**: —
**CODEBASE.md update?**: No.
**Architecture compliance**: —

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

## Stage 2 — Parity

---
### WIN-024 · One scheduler interface: launchd and Task Scheduler
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (19)
- **Dependencies**: WIN-023
- **Touches**: main/platform/scheduler.js (new), main/platform/{darwin,win32}.js, main/harness.js, main.js, tests/harness.test.js

**What to do**: `scheduler.install({ label, dir, run, schedule, pathEnv })`, `remove(label)`, `list()` — darwin wraps
today's plist + launchctl code unchanged; win32 uses `schtasks /Create /SC DAILY|WEEKLY|HOURLY /D MON..FRI /ST HH:MM
/TN "Promptly Harness — <folder> (<hash>)" /TR "powershell -NoProfile -File …" /F` and `/Delete /F`, via execFile
argument arrays, logging to `.harness\schedule.log`. The IPC handlers keep their shape.

**Acceptance criteria**:
- [ ] Mac scheduling unchanged (harness e2e green)
- [ ] Windows schedule/replace/remove works and logs

**Self-verify**: Re-read FEATURE_SPEC.md#3 (19). Tick every criterion.
**Test requirement**: unit tests for the schtasks argument arrays per schedule kind.
**⚠️ Boundaries**: Never change the IPC response shapes.
**CODEBASE.md update?**: Yes — scheduler.js row.
**Architecture compliance**: rule 2 (no shell strings).

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-025 · Harness files for PowerShell
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (18)
- **Dependencies**: WIN-024
- **Touches**: main/prompts/harness-files-win.txt (new), main/harness.js, tests/harness.test.js

**What to do**: A Windows variant of the files prompt: `.ps1` scripts, `pwsh`/`powershell` run line, progress
toasts through a built-in PowerShell snippet (no extra modules). `buildFilesPrompt` picks it on win32; parseFiles
is unchanged. `.ps1` files are not chmod'ed.

**Acceptance criteria**:
- [ ] Mac prompt and output unchanged
- [ ] A Windows harness saves and runs from PowerShell

**Self-verify**: Re-read FEATURE_SPEC.md#3 (18). Tick every criterion.
**Test requirement**: unit test that win32 picks the Windows prompt and the Mac prompt is untouched.
**⚠️ Boundaries**: Prompt text only in main/prompts/.
**CODEBASE.md update?**: Yes — prompts list.
**Architecture compliance**: rule 4 (prompt text in main/prompts).

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
### WIN-026 · Code signing for Windows, and the phase-2 test pass
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (20), Decisions (2)
- **Dependencies**: WIN-025, owner's choice of signing method
- **Touches**: package.json (build.win signing), .github/workflows/windows.yml, docs

**What to do**: Once the owner picks a method (e.g. Azure Trusted Signing or an OV certificate), sign the installer
and executables in the Windows build; then repeat the WIN-023 checklist plus Harness scheduling on the PC.

**Acceptance criteria**:
- [ ] Installer and exes are signed; SmartScreen stops warning once reputation builds
- [ ] Phase-2 criteria 18–20 pass on the PC

**Self-verify**: Re-read FEATURE_SPEC.md#3 (18–20). Tick every criterion.
**Test requirement**: signature check (`signtool verify /pa`) in the workflow.
**⚠️ Boundaries**: Ask first — signing costs money and needs the owner's accounts.
**CODEBASE.md update?**: Yes — build notes.
**Architecture compliance**: —

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

---
#### Conformance: Promptly for Windows
> Tick after every task. All items ✅ before feature is shippable.
- [ ] 1. The app starts on Windows 10 22H2 and 11 x64 without errors in the log
- [ ] 2. System-tray icon with the Mac menu's items and idle/recording/thinking states
- [ ] 3. Windows frame with caption buttons on the right; no traffic-light spacing
- [ ] 4. Windows hotkeys (double-tap Ctrl default, Alt+Space, Right Alt, Ctrl+Alt+Space, Ctrl+Shift+Space); hold and tap work; no Fn
- [ ] 5. Every key label shows Ctrl/Alt/Shift on Windows from one shared helper
- [ ] 6. Dictation types into the foreground app and restores the clipboard
- [ ] 7. Selected text reaches Craft from Notepad, VS Code, Chrome, Word; no error when unavailable
- [ ] 8. Foreground app name reported (Code.exe → Visual Studio Code)
- [ ] 9. Local transcription with the bundled whisper-cli.exe and optional Best accuracy
- [ ] 10. Claude only via main/llm.js resolving claude.exe/claude.cmd; `;` PATH
- [ ] 11. Setup: mic settings link, no Accessibility step, PowerShell install/sign-in
- [ ] 12. Settings shows Windows tool paths; Launch at login works
- [ ] 13. Layout audit passes on Windows at 100% and 150%
- [ ] 14. CI builds whisper, the helper and the NSIS installer; unit tests pass on Windows; e2e passes on the Windows PC
- [ ] 15. Releases carry the installer + Promptly-Setup.exe; the site offers the right download per OS
- [ ] 16. SmartScreen step explained on the site and in release notes
- [ ] 17. NSIS uninstall keeps %APPDATA%\Promptly; the tray's Uninstall removes app and data
- [ ] 18. (Phase 2) Harness writes PowerShell files; Windows toasts
- [ ] 19. (Phase 2) Schedule/remove through Task Scheduler with a log
- [ ] 20. (Phase 2) Signed installer and executables
- [ ] All new tests pass
- [ ] All existing tests still pass (Mac unit + e2e unchanged)
- [ ] Linter clean
- [ ] No regressions in related features
- [ ] CODEBASE.md updated for structural changes this feature introduced
- [ ] ARCHITECTURE.md updated if new patterns were established (Platforms section)
- [ ] DESIGN_SYSTEM.md updated if design: added new tokens for this feature (n/a — no new tokens)
---
