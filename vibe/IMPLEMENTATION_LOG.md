# IMPLEMENTATION_LOG — Promptly

> Implementation decisions worth remembering: hard to reverse, chosen among real alternatives, or
> surprising to a future reader. Newest last. Each entry: date · task · decision · why · Touches.
> Spec and scope decisions live in DECISIONS.md.

---
### 2026-09-28 · WIN-002 · Windows lookups use path.win32 and injectable process/file checks
- **Decision**: win32.js builds every path with `path.win32` and lets `shellWhich`, `appBundlePath` and
  `removeInstalledApp` take `{ run, fileExists }` as an optional last argument.
- **Why**: the Windows code is written and unit-tested on the Mac before a Windows machine is involved
  (Stage 1A); `path.win32` makes `C:\\Users\\Zoë Smith\\…` come out identically on both, and the stubs replace
  `where.exe` and the NSIS uninstaller without touching the real system. Callers pass nothing.
- **Alternatives**: mocking `child_process`/`fs` module-wide (brittle across the shared test file).
- **Touches**: main/platform/win32.js (`shellWhich`, `appBundlePath`, `removeInstalledApp`, `binaryCandidates`), tests/main.test.js
---
