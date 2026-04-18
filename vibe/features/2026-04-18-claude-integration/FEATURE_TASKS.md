# FEATURE_TASKS.md — F-CLAUDE: Claude CLI Integration + 5 Prompt Modes
> Feature: Claude CLI integration, mode system, PROMPT_READY
> Folder: vibe/features/2026-04-18-claude-integration/
> Created: 2026-04-18

> **Estimated effort:** 4 tasks — S: 2, M: 2 — approx. 5-6 hours total

---

### FCL-001 · `generate-prompt` IPC — replace stub with real spawn call
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#7, SPEC.md#F4
- **Dependencies**: None
- **Touches**: `main.js`

**What to do**:

0. **Verify claude CLI interface first** — before writing any spawn code, run:
   ```
   "<resolved_claudePath>" --help
   ```
   Identify: (1) the flag for non-interactive/print mode, (2) the flag for system prompt (if separate from user message), (3) whether user message is passed as a positional argument or via stdin.

   The spawn call shown below assumes `-p <systemPrompt>` sets the system prompt and transcript is sent via stdin. **Adjust the spawn args to match the actual CLI interface if it differs.** Common alternatives:
   - `spawn(claudePath, ['--system', systemPrompt, '-p', transcript])` — system + message both as args
   - `spawn(claudePath, ['-p', systemPrompt + '\n\n' + transcript])` — concatenated single arg
   - `spawn(claudePath, ['--print', '--system', systemPrompt])` + stdin — fully stdin-driven

   Do not proceed to the code steps until you have confirmed the correct invocation.

1. Add `MODE_SYSTEM_PROMPTS` constant just before the `generate-prompt` handler (exact strings from SPEC.md F4 — do not alter):

```js
const MODE_SYSTEM_PROMPTS = {
  balanced: 'You are a prompt engineering assistant. Given the following description, write a structured Claude prompt with: a clear role, the specific task, concise constraints, and the desired output format. Be direct and precise. Return only the prompt — no explanation.',
  detailed: 'You are a prompt engineering assistant. Given the following description, write a thorough Claude prompt that includes: role, task, detailed constraints, edge cases to handle, output format, and one concrete example of the desired output. Return only the prompt — no explanation.',
  concise: 'You are a prompt engineering assistant. Given the following description, write the shortest possible Claude prompt that captures the core task with only the constraints that are necessary. Strip all scaffolding and fluff. Return only the prompt — no explanation.',
  chain: 'You are a prompt engineering assistant. Given the following description, write a chain-of-thought Claude prompt that breaks the task into explicit numbered steps Claude should work through in sequence before giving a final answer. Return only the prompt — no explanation.',
  code: 'You are a prompt engineering assistant. Given the following description, write a Claude prompt optimised for code generation. Specify: language, function signature or interface, constraints, edge cases to handle, and expected output format. Return only the prompt — no explanation.',
};
```

2. Replace the entire `ipcMain.handle('generate-prompt', ...)` stub:

```js
ipcMain.handle('generate-prompt', (_event, { transcript, mode }) => {
  return new Promise((resolve) => {
    if (!claudePath) {
      resolve({ success: false, error: 'Claude CLI not found. Install via npm i -g @anthropic-ai/claude-code' });
      return;
    }
    const systemPrompt = MODE_SYSTEM_PROMPTS[mode] || MODE_SYSTEM_PROMPTS.balanced;
    const { spawn } = require('child_process');
    const child = spawn(claudePath, ['-p', systemPrompt]);
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ success: false, error: 'Claude took too long — try again' });
    }, 30000);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.stdin.write(transcript);
    child.stdin.end();
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ success: false, error: stderr.trim() || 'Claude CLI error' });
        return;
      }
      const prompt = stdout.trim();
      if (!prompt) {
        resolve({ success: false, error: 'Claude returned an empty response — try again' });
        return;
      }
      resolve({ success: true, prompt });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, error: err.message || 'Claude CLI error' });
    });
  });
});
```

**Why `spawn` not `exec`:** Transcript is passed via stdin, not as a shell argument. This eliminates any shell injection risk from transcript content and handles transcripts with special characters correctly.

**Acceptance criteria**:
- [ ] `MODE_SYSTEM_PROMPTS` constant declared in main.js with all 5 mode strings matching SPEC.md F4 exactly
- [ ] `generate-prompt` handler returns `{ success: true, prompt }` on successful Claude output
- [ ] If `claudePath` is null → `{ success: false, error: 'Claude CLI not found. Install via npm i -g @anthropic-ai/claude-code' }`
- [ ] 30-second timeout fires → `{ success: false, error: 'Claude took too long — try again' }`
- [ ] Non-zero exit code → `{ success: false, error: <stderr> }`
- [ ] Empty stdout → `{ success: false, error: 'Claude returned an empty response — try again' }`
- [ ] Transcript passed via stdin — not as shell argument
- [ ] Unknown mode key falls back to `balanced` system prompt
- [ ] `npm run lint` passes

**Self-verify**: `npm start` → DevTools console: `await window.electronAPI.generatePrompt('write a function that reverses a string', 'balanced')` → should return `{ success: true, prompt: '...' }` with a structured prompt, or a clear error object if claudePath not resolved.
**Test requirement**: Manual DevTools console test — generatePrompt IPC returns correct shape.
**⚠️ Boundaries**: Do not change `claudePath`, `whisperPath`, or any other IPC handler. Only the `generate-prompt` stub changes.
**CODEBASE.md update?**: No — wait for FCL-004.
**Architecture compliance**: Uses cached `claudePath` (ARCHITECTURE.md PATH resolution rule). No new IPC channels. No runtime deps.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FCL-002 · Replace F-CLAUDE setTimeout stub in `mediaRecorder.onstop`
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3, FEATURE_SPEC.md#5
- **Dependencies**: FCL-001
- **Touches**: `index.html`

**What to do**:

In `startRecording()` inside `mediaRecorder.onstop`, find and replace the F-CLAUDE stub:

```js
// F-CLAUDE will replace this stub
setTimeout(() => setState('IDLE'), 1500);
```

Replace with:

```js
const genResult = await window.electronAPI.generatePrompt(originalTranscript, getMode());
if (!genResult.success) {
  setState('ERROR', { message: genResult.error });
  return;
}
generatedPrompt = genResult.prompt;
setState('PROMPT_READY', { prompt: generatedPrompt });
```

No other changes. The `onstop` handler is already `async`, already sets `setState('THINKING')` before the transcript IPC call, and `originalTranscript` is already set from F-SPEECH.

**Acceptance criteria**:
- [ ] The `// F-CLAUDE will replace this stub` comment and `setTimeout` are removed
- [ ] `window.electronAPI.generatePrompt(originalTranscript, getMode())` called after `originalTranscript` is set
- [ ] On `genResult.success === false` → `setState('ERROR', { message: genResult.error })`
- [ ] On `genResult.success === true` → `generatedPrompt = genResult.prompt` then `setState('PROMPT_READY', { prompt: generatedPrompt })`
- [ ] `originalTranscript` is never mutated here (read-only)
- [ ] `npm run lint` passes (no index.html lint — manual check)

**Self-verify**: `npm start` → speak → stop → THINKING state appears → (Whisper transcribes) → (Claude generates) → PROMPT_READY state with generated prompt visible. Check terminal for no errors.
**Test requirement**: Full end-to-end smoke: speak → stop → THINKING → PROMPT_READY.
**⚠️ Boundaries**: Do not touch any other part of `mediaRecorder.onstop`. Do not mutate `originalTranscript`.
**CODEBASE.md update?**: No — wait for FCL-004.
**Architecture compliance**: `setState()` for all transitions. `textContent` already used in setState payload handling. `generatedPrompt` written once per generation.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FCL-003 · Mode context menu — right-click to switch modes
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3 (mode system), SPEC.md#F4
- **Dependencies**: None (parallel with FCL-001)
- **Touches**: `index.html`

**What to do**:

1. Add `MODES` constant after `STATE_HEIGHTS` declaration (module scope):

```js
const MODES = [
  { key: 'balanced', label: 'Balanced' },
  { key: 'detailed', label: 'Detailed' },
  { key: 'concise', label: 'Concise' },
  { key: 'chain', label: 'Chain' },
  { key: 'code', label: 'Code' },
];
```

2. Add CSS for mode menu in `<style>` block (after existing styles):

```css
#mode-menu {
  position: fixed;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: var(--radius-inner);
  padding: 4px 0;
  min-width: 140px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}
.mode-menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  color: #1a1a1a;
  cursor: pointer;
  user-select: none;
}
.mode-menu-item:hover {
  background: rgba(0, 122, 255, 0.08);
}
.mode-check {
  width: 12px;
  color: var(--color-action);
  font-size: 11px;
}
```

3. Add `<div id="mode-menu" hidden></div>` to the `<body>`, as a sibling after `<div id="app">`.

4. In `DOMContentLoaded`, after the existing `Set mode label from localStorage` block, add the context menu setup:

```js
// Build mode menu items
const modeMenu = document.getElementById('mode-menu');
MODES.forEach(({ key, label }) => {
  const item = document.createElement('div');
  item.className = 'mode-menu-item';
  item.dataset.mode = key;
  const check = document.createElement('span');
  check.className = 'mode-check';
  check.textContent = getMode() === key ? '✓' : '';
  const txt = document.createElement('span');
  txt.textContent = label;
  item.appendChild(check);
  item.appendChild(txt);
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    setMode(key);
    document.getElementById('idle-mode-label').textContent = label;
    document.querySelectorAll('.mode-check').forEach((el) => {
      el.textContent = el.closest('.mode-menu-item').dataset.mode === key ? '✓' : '';
    });
    modeMenu.hidden = true;
  });
  modeMenu.appendChild(item);
});

// Show on right-click in IDLE only
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (currentState !== 'IDLE') return;
  modeMenu.hidden = false;
  const x = Math.min(e.clientX, window.innerWidth - 160);
  const y = Math.max(0, e.clientY - modeMenu.offsetHeight - 4);
  modeMenu.style.left = x + 'px';
  modeMenu.style.top = y + 'px';
});

// Hide on any click outside menu
window.addEventListener('click', () => {
  modeMenu.hidden = true;
});
```

**Acceptance criteria**:
- [ ] `MODES` constant defined as module-scope array of `{ key, label }` with 5 entries in spec order
- [ ] `#mode-menu` DOM element exists in body (sibling of `#app`)
- [ ] Mode menu items built from `MODES` — labels use `textContent` not `innerHTML`
- [ ] Right-click on bar in IDLE state → menu appears; right-click in any other state → no menu
- [ ] Active mode has `✓` prefix in menu on open
- [ ] Clicking a mode → `setMode(key)` called, `#idle-mode-label` updated, menu hidden
- [ ] After mode change, re-opening menu shows new active mode's checkmark
- [ ] Click outside menu → menu hidden
- [ ] Menu CSS uses only design tokens (`--color-action`, `--radius-inner`)
- [ ] `textContent` used for all dynamic text (mode labels, checkmarks)
- [ ] `npm run lint` passes (no index.html lint — manual check)

**Self-verify**: `npm start` → IDLE state → right-click → 5-item menu appears, active mode has ✓ → click Detailed → label updates to "Detailed" → right-click again → Detailed has ✓ → press ⌘R (reload) → label still shows Detailed (persisted in localStorage).
**Test requirement**: Manual smoke: right-click → menu → select mode → label update → reload → persists.
**⚠️ Boundaries**: System prompts stay in main.js — index.html only needs keys and labels. No `innerHTML` for dynamic text.
**CODEBASE.md update?**: No — wait for FCL-004.
**Architecture compliance**: `textContent` only. Event listeners set once at DOMContentLoaded. `getMode()` / `setMode()` wrappers only. `contextmenu` listener guards `currentState === 'IDLE'`.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FCL-004 · CODEBASE.md update
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#10 (conformance: CODEBASE.md updated)
- **Dependencies**: FCL-002, FCL-003
- **Touches**: `vibe/CODEBASE.md`

**What to do**:

1. Update "Last updated" line:
   ```
   > Last updated: 2026-04-18 (FCL-004 — F-CLAUDE complete: generate-prompt IPC, mode menu, PROMPT_READY)
   ```

2. Update "Current state":
   ```
   **Phase:** Phase 2 in progress — F-STATE ✅ — F-FIRST-RUN ✅ — F-SPEECH ✅ — F-CLAUDE ✅ — F-ACTIONS next
   ```

3. Add `MODE_SYSTEM_PROMPTS` to main.js variables table:
   ```
   | `MODE_SYSTEM_PROMPTS` | object constant | Declared at module scope | `generate-prompt` handler |
   ```

4. Add `MODES` to index.html key exports column.

5. Add `generatedPrompt` flow note: written by `generate-prompt` IPC result in `mediaRecorder.onstop`.

6. Update IPC channel row for `generate-prompt`: change from `✅ stubbed` to `✅ registered — spawn(claudePath, ['-p', systemPrompt]), transcript via stdin, returns { success, prompt, error }`.

**Acceptance criteria**:
- [ ] "Last updated" line updated to FCL-004
- [ ] "Current state" reflects F-CLAUDE complete, F-ACTIONS next
- [ ] `MODE_SYSTEM_PROMPTS` in main.js module-scope vars table
- [ ] `MODES` in index.html key exports
- [ ] `generate-prompt` IPC row updated from stub to live implementation description

**Self-verify**: Read CODEBASE.md, verify all 5 changes are accurate.
**Test requirement**: No code changes — CODEBASE.md only.
**⚠️ Boundaries**: Only CODEBASE.md changes. Do not touch source files.
**CODEBASE.md update?**: Yes — this is the CODEBASE.md update task.
**Architecture compliance**: N/A — documentation only.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: F-CLAUDE
> Tick after every task. All items ✅ before feature is shippable.
- [ ] `generate-prompt` IPC returns `{ success, prompt, error }` shape
- [ ] All 5 mode system prompts match SPEC.md F4 exactly
- [ ] Transcript reaches Claude via stdin (not shell argument)
- [ ] 30-second timeout → ERROR "Claude took too long — try again"
- [ ] `claudePath` null → ERROR with install instructions
- [ ] F-CLAUDE setTimeout stub removed from `mediaRecorder.onstop`
- [ ] `generatedPrompt` set from successful IPC result
- [ ] `setState('PROMPT_READY', { prompt: generatedPrompt })` called on success
- [ ] Right-click in IDLE → mode menu appears with 5 items
- [ ] Mode checkmark reflects active mode on open
- [ ] Mode click → `setMode()` + label update + menu close
- [ ] Mode persists across restarts
- [ ] No new IPC channels added
- [ ] No `innerHTML` with dynamic content
- [ ] No `localStorage.*` direct access
- [ ] `npm run lint` passes
- [ ] CODEBASE.md updated
