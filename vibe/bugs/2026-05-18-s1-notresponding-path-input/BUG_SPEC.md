# BUG_SPEC — s1-notresponding has no manual path override
> Date: 2026-05-18 | ID: BUG-NVM-PATH

## Bug summary
When Claude CLI is found but fails to execute (e.g., "env: node: No such file or directory"), the `s1-notresponding` splash state shows the error with no way to enter a different path — users are completely stuck.

## Files involved
- `splash.html` — `s1-notresponding` div (line 706–719), `runScreen1()` (line 1317), existing `s1UseManualPath()` (line 1252)

## Root cause hypothesis
**Confidence: High — confirmed from code.**

Every Screen 1 failure state was audited after the 2026-04-30 `BUG-ONBOARDING-MANUAL-PATH` fix:
- `s1-notfound` → has "Already installed?" card with `#s1-manual-path` input ✅
- `s1-notloggedin` → path is correct; user needs to log in, not change path ✅ (intentionally no input)
- `s1-notresponding` → NO path input ❌ — this is the gap

`s1-notresponding` fires when `result.found = true && result.working = false`. This is the "env: node: No such file or directory" case: the binary is found at an nvm path, `makeClaudeEnv()` adds its bin dir to PATH, but execution still fails (e.g., the stored path is stale, the version was uninstalled, or a different nvm version is needed). The user sees the error but has zero escape hatch.

`result.path` is already available in `runScreen1()` (used in the working branch at line 1350), so it can pre-populate the override input.

## Blast radius
- Affects only `splash.html` — no main.js, no React renderer changes
- No other failure state is affected
- `s1UseManualPath()` is reused as the save-and-recheck function (new variant reads from the new input ID)

## Fix approach
1. Add "Not the right path?" section to `s1-notresponding` — matching the `s1-notfound` card pattern:
   - Input `#s1-notresponding-path` pre-populated with `result.path`
   - "Use this path →" button → `s1NotrespondingUseManualPath()`
2. Add `s1NotrespondingUseManualPath()` function — same shape as `s1UseManualPath()` but reads `#s1-notresponding-path`
3. In `runScreen1()` when routing to `s1-notresponding`: set `document.getElementById('s1-notresponding-path').value = result.path || ''`

## What NOT to change
- `s1UseManualPath()` — do not modify, it reads `#s1-manual-path` (belongs to `s1-notfound`)
- `makeClaudeEnv()` in main.js — out of scope; it is already correct
- `check-claude` IPC handler — already returns `result.path`; no change needed
- Any Screen 2 or Screen 3/4 states

## Verification plan
1. Manually trigger `s1-notresponding` by temporarily editing `runScreen1()` to force this state
2. Confirm path input is visible and pre-populated with the found path
3. Enter a different (correct) path → click "Use this path →"
4. Verify `savePaths` is called, check reruns, proceeds if path is valid

## Regression test
Visual inspection of `s1-notresponding` HTML — verify `#s1-notresponding-path` input exists inside the `s1-notresponding` div. Grep for `s1NotrespondingUseManualPath` in `splash.html`.
