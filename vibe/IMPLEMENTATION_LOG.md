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
