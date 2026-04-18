# FEATURE_SPEC.md — F-CLAUDE: Claude CLI Integration + 5 Prompt Modes
> Feature: Claude CLI integration, mode system, PROMPT_READY state
> Folder: vibe/features/2026-04-18-claude-integration/
> Created: 2026-04-18
> Dependencies: F-SPEECH ✅, F-FIRST-RUN ✅

---

## 1. Feature overview

Replace the 1500ms setTimeout stub in `mediaRecorder.onstop` with a real call to `claude -p` via the cached `claudePath`. Five mode-specific system prompts drive the output shape. Mode is selected via right-click context menu on the bar, persisted to localStorage, and always visible as a label in IDLE state. On success the app transitions to PROMPT_READY with the generated prompt text ready for F-ACTIONS.

---

## 2. User stories

- **As a user**, after I stop recording, I want the app to automatically send my transcript to Claude with the right system prompt for my current mode, so I get a structured prompt without any manual steps.
- **As a user**, I want to right-click the bar to switch between 5 prompt modes (Balanced, Detailed, Concise, Chain, Code), so I can tune the output for different use cases.
- **As a user**, I want to see my current mode displayed in the IDLE bar at all times, so I always know what mode I'm in without having to open the menu.

---

## 3. Acceptance criteria

### Claude invocation
- [ ] After `originalTranscript` is captured in `mediaRecorder.onstop`, `generatePrompt(originalTranscript, getMode())` is called (replaces the setTimeout stub)
- [ ] Bar is in THINKING state during the Claude CLI call (already entered before IPC call — no change needed)
- [ ] On success → `generatedPrompt` set, `setState('PROMPT_READY', { prompt: generatedPrompt })`
- [ ] On IPC error → `setState('ERROR', { message: result.error })`
- [ ] If `claudePath` is null when `generate-prompt` fires → `{ success: false, error: 'Claude CLI not found. Install via npm i -g @anthropic-ai/claude-code' }`
- [ ] Claude CLI stderr → `{ success: false, error: <stderr text> }`
- [ ] Claude CLI timeout (30s) → `{ success: false, error: 'Claude took too long — try again' }`
- [ ] Empty stdout → `{ success: false, error: 'Claude returned an empty response — try again' }`

### Mode system
- [ ] `MODES` constant (array of `{ key, label }`) defined in index.html for menu rendering
- [ ] Mode system prompts defined as a constant in main.js — exact strings from SPEC.md F4
- [ ] Right-click anywhere on the bar → shows mode context menu (only when `currentState === 'IDLE'`)
- [ ] Context menu lists 5 modes in order: Balanced · Detailed · Concise · Chain · Code
- [ ] Active mode has a checkmark (✓) prefix in the menu
- [ ] Clicking a mode item → `setMode(key)`, updates `#idle-mode-label`, hides menu
- [ ] Clicking outside menu → hides menu
- [ ] `#idle-mode-label` shows capitalised mode label at all times in IDLE state
- [ ] Mode persists across app restarts (already in localStorage via `getMode()` / `setMode()`)

---

## 4. Scope boundaries

**Included:**
- `generate-prompt` IPC implementation (replacing stub in main.js)
- Replacing the F-CLAUDE setTimeout stub in index.html `mediaRecorder.onstop`
- Mode context menu (right-click, custom HTML overlay)
- Mode label in IDLE bar (already in DOM — needs live update on mode change)
- `generatedPrompt` variable set from IPC result

**Explicitly deferred:**
- Copy, Edit, Regenerate buttons — F-ACTIONS (next feature)
- The `prompt-output` element content is set by setState via payload — already works
- Whisper timeout — already handled in F-SPEECH
- PROMPT_READY → IDLE dismiss (click-outside) — F-ACTIONS concern

---

## 5. Integration points

- **Reads**: `originalTranscript` (set by F-SPEECH in `mediaRecorder.onstop`)
- **Reads**: `claudePath` (set at app-ready in main.js)
- **Reads**: `getMode()` (localStorage wrapper, already defined)
- **Writes**: `generatedPrompt` (module-scope var in index.html; read by F-ACTIONS)
- **IPC**: `generate-prompt` channel — already registered as stub in main.js; already exposed in preload.js as `window.electronAPI.generatePrompt`
- **State transitions**: THINKING → PROMPT_READY (success) or THINKING → ERROR (failure)
- **Spec ref**: SPEC.md#F4 (exact system prompts), SPEC.md#ipc-surface

---

## 6. Data model changes

No new variables. Existing vars used:
- `originalTranscript` — read (immutable after F-SPEECH sets it)
- `generatedPrompt` — written once per generation cycle

New constant in main.js:
```js
const MODE_SYSTEM_PROMPTS = {
  balanced: '...',
  detailed: '...',
  concise: '...',
  chain: '...',
  code: '...',
};
```

New constant in index.html (for menu rendering only — no system prompts):
```js
const MODES = [
  { key: 'balanced', label: 'Balanced' },
  { key: 'detailed', label: 'Detailed' },
  { key: 'concise', label: 'Concise' },
  { key: 'chain', label: 'Chain' },
  { key: 'code', label: 'Code' },
];
```

---

## 7. IPC changes

**`generate-prompt`** (renderer → main) — replace stub:
- Input: `{ transcript: string, mode: string }`
- Output: `{ success: boolean, prompt?: string, error?: string }`
- Implementation: `spawn(claudePath, ['-p', systemPrompt])`, write transcript to stdin, collect stdout, 30s timeout

No new IPC channels needed.

---

## 8. Edge cases and error states

| Condition | Error message |
|-----------|--------------|
| `claudePath` null at invoke time | `'Claude CLI not found. Install via npm i -g @anthropic-ai/claude-code'` |
| Claude CLI exits with stderr | stderr text (trimmed) |
| Claude CLI times out (>30s) | `'Claude took too long — try again'` |
| Claude CLI returns empty stdout | `'Claude returned an empty response — try again'` |
| Unknown mode key | Falls back to `balanced` system prompt |

---

## 9. Non-functional requirements

- **Timeout**: 30 seconds hard limit on `generate-prompt` IPC (matches SPEC.md#F4)
- **Security**: Transcript passed to Claude via stdin (not shell argument) — no shell injection risk
- **No new runtime deps**: `child_process.spawn` is built-in — no npm packages
- **System prompts**: Exact strings from SPEC.md F4 — do not paraphrase or modify

---

## 10. Conformance checklist

- [ ] `generate-prompt` IPC returns `{ success, prompt, error }` shape (not plain string)
- [ ] System prompts in main.js match SPEC.md F4 exactly (all 5 modes)
- [ ] Transcript reaches Claude via stdin — not as shell argument
- [ ] 30-second timeout fires ERROR "Claude took too long — try again"
- [ ] `claudePath` null → ERROR with install instructions
- [ ] `generatedPrompt` set in index.html after successful generation
- [ ] `setState('PROMPT_READY', { prompt: generatedPrompt })` called on success
- [ ] F-CLAUDE setTimeout stub removed from `mediaRecorder.onstop`
- [ ] Right-click on bar in IDLE state shows mode menu
- [ ] Mode menu shows 5 modes in correct order with checkmark on active
- [ ] Mode click → `setMode()` + `#idle-mode-label` update + menu close
- [ ] Mode persists across restarts (localStorage)
- [ ] No new IPC channels
- [ ] No `innerHTML` with dynamic content
- [ ] No `localStorage.*` direct access
- [ ] `npm run lint` passes
- [ ] CODEBASE.md updated
