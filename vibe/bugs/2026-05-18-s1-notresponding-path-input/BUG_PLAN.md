# BUG_PLAN — s1-notresponding path override
> Date: 2026-05-18

## 1. Files to modify
- `splash.html` — all changes live here

## 2. Files NOT to touch
- `main.js` — `check-claude` already returns `result.path`; `makeClaudeEnv` already handles PATH
- `preload.js` — no new IPC needed
- Any React renderer file

## 3. Change description

### `splash.html` — three changes

**Change A — HTML: add "Not the right path?" card inside `#s1-notresponding`**

After the `<div class="wz-note">` (current last child of `s1-notresponding`), insert a styled card:
```html
<div style="background:rgba(10,132,255,0.06);border:0.5px solid rgba(10,132,255,0.2);border-radius:8px;padding:10px 12px;margin-top:10px">
  <div style="font-size:11px;font-weight:500;color:rgba(255,189,46,0.85);margin-bottom:4px">Not the right path?</div>
  <div style="font-size:10.5px;color:rgba(255,255,255,0.35);margin-bottom:8px;line-height:1.4">If claude is installed at a different location, paste the full path below and click <strong style="color:rgba(10,132,255,0.8)">Use this path →</strong></div>
  <div style="display:flex;gap:6px;margin-top:4px">
    <input id="s1-notresponding-path" type="text" placeholder="/Users/you/.nvm/versions/node/.../bin/claude"
      style="flex:1;height:30px;background:rgba(255,255,255,0.06);border:0.5px solid rgba(10,132,255,0.25);border-radius:7px;padding:0 8px;font-size:11px;color:rgba(255,255,255,0.75);font-family:monospace;outline:none;box-sizing:border-box;-webkit-app-region:no-drag"/>
    <button onclick="s1NotrespondingUseManualPath()" style="height:30px;padding:0 12px;background:rgba(10,132,255,0.2);border:0.5px solid rgba(10,132,255,0.4);border-radius:7px;font-size:11px;font-weight:500;color:rgba(10,132,255,0.95);cursor:pointer;font-family:inherit;-webkit-app-region:no-drag;white-space:nowrap;outline:none">Use this path →</button>
  </div>
</div>
```

**Change B — JS: add `s1NotrespondingUseManualPath()` function**

Add immediately after `s1UseManualPath()` (around line 1258):
```js
async function s1NotrespondingUseManualPath() {
  const val = document.getElementById('s1-notresponding-path').value.trim();
  if (!val) return;
  const stored = await window.electronAPI.getStoredPaths();
  await window.electronAPI.savePaths({ claudePath: val, whisperPath: stored.whisperPath || '', ffmpegPath: stored.ffmpegPath || '' });
  runScreen1();
}
```

**Change C — JS: pre-populate input in `runScreen1()`**

In the `!result.working` branch (around line 1341), set the input value before calling `s1ShowError`:
```js
if (!result.working) {
  document.getElementById('s1-error-output').textContent = result.error || 'Unknown error';
  document.getElementById('s1-notresponding-path').value = result.path || '';  // ← add this
  s1ShowError('s1-notresponding', false);
  return;
}
```

## 4. Conventions to follow
- `-webkit-app-region: no-drag` on all inputs and buttons (existing pattern, critical for Electron)
- `font-family:inherit` on buttons (existing pattern)
- Amber title `rgba(255,189,46,0.85)` — matches existing "Already installed?" card colour in `s1-notfound`
- Blue tint card: `rgba(10,132,255,0.06)` bg + `rgba(10,132,255,0.2)` border — matches existing cards

## 5. Side effects check
- Only `s1-notresponding` is affected
- The new input is pre-populated but editable — user can correct the path before clicking
- If `result.path` is null (unlikely when working=false), input is blank — user can still type manually
- `runScreen1()` is called after savePaths, same as all other "Use path →" flows

## 6. Test plan
- Visual: `s1-notresponding` shows the "Not the right path?" card with pre-populated input
- Functional: enter a correct path → "Use this path →" → check reruns and passes
- Functional: leave input blank → button does nothing (guard: `if (!val) return`)
- Regression: `s1-notfound` "Already installed?" card still present and unchanged

## 7. Rollback plan
Revert the three HTML/JS changes. No config.json or main.js changes to roll back.

## 8. CODEBASE.md update needed?
Yes — update the `splash.html` row:
- Add `s1NotrespondingUseManualPath()` to the listed JS functions
- Update description: `s1-notresponding` now also has path override

## 9. ARCHITECTURE.md update needed?
No — existing "escape hatch path input" pattern is already documented via prior bugs.
