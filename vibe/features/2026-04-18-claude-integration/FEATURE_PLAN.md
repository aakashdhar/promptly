# FEATURE_PLAN.md — F-CLAUDE: Claude CLI Integration + 5 Prompt Modes
> Created: 2026-04-18
> Reads: originalTranscript (F-SPEECH), claudePath (Phase 1)
> Writes: generatedPrompt (read by F-ACTIONS)

---

## 1. Impact map

**Files to modify:**

| File | What changes |
|------|-------------|
| `main.js` | Replace `generate-prompt` stub with real `spawn(claudePath, ...)` + MODE_SYSTEM_PROMPTS constant |
| `index.html` | Replace F-CLAUDE setTimeout stub in `mediaRecorder.onstop`; add MODES constant + mode context menu DOM + CSS + event handlers |

**Files explicitly out of scope:**

| File | Reason |
|------|--------|
| `preload.js` | `generatePrompt` already exposed — no change needed |
| `package.json` | No new dependencies |
| `entitlements.plist` | No new permissions |

---

## 2. Backend changes (main.js)

### Replace `generate-prompt` stub

Current stub (lines ~84-87):
```js
ipcMain.handle('generate-prompt', (_event, { transcript, mode }) => {
  console.log('generate-prompt called — transcript:', transcript, 'mode:', mode);
  return '[placeholder — Claude integration coming in F-CLAUDE]';
});
```

Replacement:
```js
const MODE_SYSTEM_PROMPTS = {
  balanced: 'You are a prompt engineering assistant. Given the following description, write a structured Claude prompt with: a clear role, the specific task, concise constraints, and the desired output format. Be direct and precise. Return only the prompt — no explanation.',
  detailed: 'You are a prompt engineering assistant. Given the following description, write a thorough Claude prompt that includes: role, task, detailed constraints, edge cases to handle, output format, and one concrete example of the desired output. Return only the prompt — no explanation.',
  concise: 'You are a prompt engineering assistant. Given the following description, write the shortest possible Claude prompt that captures the core task with only the constraints that are necessary. Strip all scaffolding and fluff. Return only the prompt — no explanation.',
  chain: 'You are a prompt engineering assistant. Given the following description, write a chain-of-thought Claude prompt that breaks the task into explicit numbered steps Claude should work through in sequence before giving a final answer. Return only the prompt — no explanation.',
  code: 'You are a prompt engineering assistant. Given the following description, write a Claude prompt optimised for code generation. Specify: language, function signature or interface, constraints, edge cases to handle, and expected output format. Return only the prompt — no explanation.',
};

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

**Key decisions:**
- `spawn` not `exec` — transcript passed via stdin, not shell argument; avoids any injection risk
- `spawn` destructured inline (not at top of file) to keep diff minimal — only this handler needs it
- Timer cleared on both `close` and `error` paths
- `kill()` on timeout — process is terminated cleanly

---

## 3. Frontend changes (index.html)

### A. Replace F-CLAUDE setTimeout stub in `mediaRecorder.onstop`

Current (inside `startRecording()`):
```js
// F-CLAUDE will replace this stub
setTimeout(() => setState('IDLE'), 1500);
```

Replacement:
```js
const genResult = await window.electronAPI.generatePrompt(originalTranscript, getMode());
if (!genResult.success) {
  setState('ERROR', { message: genResult.error });
  return;
}
generatedPrompt = genResult.prompt;
setState('PROMPT_READY', { prompt: generatedPrompt });
```

### B. MODES constant (add near other module-scope vars)

```js
const MODES = [
  { key: 'balanced', label: 'Balanced' },
  { key: 'detailed', label: 'Detailed' },
  { key: 'concise', label: 'Concise' },
  { key: 'chain', label: 'Chain' },
  { key: 'code', label: 'Code' },
];
```

### C. Mode context menu DOM element (add to body, after #app)

```html
<div id="mode-menu" hidden>
  <!-- items injected by JS -->
</div>
```

### D. Mode context menu CSS

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

### E. Mode context menu logic (in DOMContentLoaded)

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
  const text = document.createElement('span');
  text.textContent = label;
  item.appendChild(check);
  item.appendChild(text);
  item.addEventListener('click', () => {
    setMode(key);
    document.getElementById('idle-mode-label').textContent = label;
    modeMenu.hidden = true;
    document.querySelectorAll('.mode-check').forEach((el) => {
      el.textContent = el.closest('.mode-menu-item').dataset.mode === key ? '✓' : '';
    });
  });
  modeMenu.appendChild(item);
});

// Show on right-click in IDLE state only
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (currentState !== 'IDLE') return;
  modeMenu.hidden = false;
  const x = Math.min(e.clientX, window.innerWidth - 160);
  const y = Math.max(0, e.clientY - modeMenu.offsetHeight - 4);
  modeMenu.style.left = x + 'px';
  modeMenu.style.top = y + 'px';
});

// Hide on click outside
window.addEventListener('click', () => {
  modeMenu.hidden = true;
});
```

---

## 4. Conventions to follow (from ARCHITECTURE.md)

- `setState()` is the only DOM mutation point for state/visibility
- `textContent` for all dynamic text — never `innerHTML` for user/Claude content
- Event listeners set once at DOMContentLoaded
- `getMode()` / `setMode()` for all localStorage mode access
- Zero new IPC channels
- Zero new runtime npm deps

---

## 5. Task breakdown

| Task | Size | File(s) | Depends on |
|------|------|---------|-----------|
| FCL-001 | M | main.js | None |
| FCL-002 | S | index.html | FCL-001 |
| FCL-003 | M | index.html | None (parallel with FCL-001) |
| FCL-004 | S | vibe/CODEBASE.md | FCL-002, FCL-003 |

FCL-001 and FCL-003 can be built in either order. FCL-002 depends on FCL-001 (needs to call the real IPC).

---

## 6. Rollback plan

Each task is a separate commit. To undo:
- FCL-001: `git revert` the main.js commit — reverts to stub (app still runs, just hits IDLE after 1.5s)
- FCL-002: `git revert` the index.html commit — reverts stub replacement
- FCL-003: `git revert` the context menu commit — removes mode menu, label still shows from localStorage

---

## 7. Testing strategy

Manual smoke test after each task:
- FCL-001: In terminal after `npm start`, verify no console errors; DevTools: `window.electronAPI.generatePrompt('test', 'balanced')` should return `{ success: true, prompt: '...' }` (if claudePath resolved) or `{ success: false, error: '...' }` if not
- FCL-002: Speak → stop → THINKING → (wait) → PROMPT_READY with generated text
- FCL-003: Right-click bar in IDLE → menu appears → click Detailed → label updates → right-click again → Detailed has checkmark

---

## 8. CODEBASE.md sections to update (FCL-004)

- Last updated line
- Current state (F-CLAUDE complete → F-ACTIONS next)
- index.html key exports: add `MODES`, `generatePrompt` flow (no new function — onstop logic change)
- main.js: add `MODE_SYSTEM_PROMPTS`
