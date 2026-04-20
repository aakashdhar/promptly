# BUG_PLAN.md — BUG-012: PATH resolution fails in packaged DMG

## 1. Exact files to modify
- `main.js`

## 2. Files NOT to touch
- `preload.js`
- `splash.html`
- `src/renderer/**`
- `package.json`
- `entitlements.plist`
- `vite.config.js`

## 3. Change description

### main.js — Change 1: Replace resolveClaudePath()
Replace the current single-exec function with common-path checks first, then zsh → bash fallback:

```js
async function resolveClaudePath() {
  const commonPaths = [
    '/usr/local/bin/claude',
    '/usr/bin/claude',
    path.join(os.homedir(), '.local/bin/claude'),
    path.join(os.homedir(), '.npm-global/bin/claude'),
    path.join(os.homedir(), 'node_modules/.bin/claude'),
    '/opt/homebrew/bin/claude',
    '/opt/local/bin/claude',
  ]
  for (const p of commonPaths) {
    try { if (fs.existsSync(p)) return p } catch { /* ignore */ }
  }
  return new Promise((resolve) => {
    exec('zsh -lc "which claude"', (err, stdout) => {
      if (!err && stdout.trim()) { resolve(stdout.trim()); return }
      exec('bash -lc "which claude"', (err2, stdout2) => {
        if (!err2 && stdout2.trim()) { resolve(stdout2.trim()); return }
        resolve(null)
      })
    })
  })
}
```

### main.js — Change 2: Add resolveWhisperPath()
New function following identical pattern, placed after resolveClaudePath():

```js
async function resolveWhisperPath() {
  const commonPaths = [
    '/usr/local/bin/whisper',
    '/usr/bin/whisper',
    path.join(os.homedir(), '.local/bin/whisper'),
    path.join(os.homedir(), '.local/pipx/venvs/openai-whisper/bin/whisper'),
    path.join(os.homedir(), 'Library/Python/3.9/bin/whisper'),
    path.join(os.homedir(), 'Library/Python/3.10/bin/whisper'),
    path.join(os.homedir(), 'Library/Python/3.11/bin/whisper'),
    path.join(os.homedir(), 'Library/Python/3.12/bin/whisper'),
    '/opt/homebrew/bin/whisper',
    '/opt/local/bin/whisper',
    '/usr/local/lib/python3.9/site-packages/whisper',
  ]
  for (const p of commonPaths) {
    try { if (fs.existsSync(p)) return p } catch { /* ignore */ }
  }
  return new Promise((resolve) => {
    exec('zsh -lc "which whisper"', (err, stdout) => {
      if (!err && stdout.trim()) { resolve(stdout.trim()); return }
      exec('bash -lc "which whisper"', (err2, stdout2) => {
        if (!err2 && stdout2.trim()) { resolve(stdout2.trim()); return }
        exec('zsh -lc "python3 -m whisper --help > /dev/null 2>&1 && echo python3"', (err3, stdout3) => {
          if (!err3 && stdout3.trim()) { resolve('python3 -m whisper'); return }
          resolve(null)
        })
      })
    })
  })
}
```

### main.js — Change 3: app.whenReady() — await both resolutions
Replace the fire-and-forget whisper exec with `await resolveWhisperPath()`:

```js
app.whenReady().then(async () => {
  claudePath = await resolveClaudePath();
  whisperPath = await resolveWhisperPath();
  // ... rest unchanged
```

### main.js — Change 4: transcribe-audio — handle python3 -m whisper
In the `transcribe-audio` IPC handler, construct the exec command to handle the multi-word case:

```js
const whisperCmd = whisperPath === 'python3 -m whisper'
  ? `python3 -m whisper "${tmpFile}" --model tiny --language en --output_format txt --output_dir "${outDir}"`
  : `"${whisperPath}" "${tmpFile}" --model tiny --language en --output_format txt --output_dir "${outDir}"`;
exec(whisperCmd, { timeout: 60000 }, ...)
```

## 4. Conventions to follow
- `os` and `fs` already imported at top of main.js — no changes needed
- Function naming: camelCase `resolveWhisperPath()` — consistent with `resolveClaudePath()`
- Cached module-scope vars `claudePath` and `whisperPath` — unchanged
- `splash-check-cli` and `splash-check-whisper` already return cached paths — no change needed

## 5. Side effects check
- Startup takes slightly longer (await both resolutions before creating windows) — acceptable; splash shows immediately after
- `resolveWhisperPath()` may take up to ~3s on slow systems where shell exec is needed — splash covers this
- Existing behaviour for users where `which claude` works is unchanged (common paths checked first, same result)

## 6. Test plan
Manual smoke checklist (packaged DMG):
- [ ] `npm run dist:unsigned` builds without error
- [ ] Open DMG, install, right-click → Open
- [ ] Splash: Claude CLI check — green ✅
- [ ] Splash: Whisper check — green ✅
- [ ] Recording + transcription works
- [ ] Prompt generation works

## 7. Rollback plan
`git revert` the commit — reverts both function replacements atomically.

## 8. CODEBASE.md update needed?
Yes — update the `whisperPath` row in "Module-scope variables (in main.js)" table to reflect `resolveWhisperPath()` instead of inline exec.

## 9. ARCHITECTURE.md update needed?
Yes — update the "PATH resolution" section to document the expanded search pattern (common paths → zsh → bash fallback).
