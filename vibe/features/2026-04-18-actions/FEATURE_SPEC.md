# FEATURE_SPEC.md — F-ACTIONS: Copy, Edit, Regenerate
> Feature: Action buttons in PROMPT_READY state
> Folder: vibe/features/2026-04-18-actions/
> Created: 2026-04-18
> Depends on: F-CLAUDE (generatedPrompt in PROMPT_READY state) ✅

---

## 1. Feature overview

F-ACTIONS wires the three action buttons that appear in PROMPT_READY state: Copy writes the generated prompt to the system clipboard with a 1.8-second green flash; Edit makes the prompt contenteditable so the user can tweak it before copying; Regenerate re-runs Claude CLI from the original speech transcript (ignoring any edits). All three operate on `generatedPrompt` and `originalTranscript` — variables already set by F-CLAUDE.

---

## 2. User stories

- As a user, I want to one-click copy the generated prompt to my clipboard so I can paste it into Claude without selecting text.
- As a user, I want to edit the generated prompt inline before copying, with a clear way to cancel back to the original.
- As a user, I want to regenerate from my original speech if the prompt isn't quite right, without re-recording.

---

## 3. Acceptance criteria

### Copy (F5)
- [ ] Clicking Copy calls `window.electronAPI.copyToClipboard(generatedPrompt)`
- [ ] Button background flashes green (`--color-success`) for exactly 1.8 seconds
- [ ] Button text changes to "Copied!" during flash, returns to "Copy" after
- [ ] Prompt text remains visible during and after flash (not dismissed)
- [ ] If IPC returns `{ success: false }` → no flash, button stays "Copy" (silent failure acceptable for v1)

### Edit (F6)
- [ ] Clicking Edit sets `contenteditable="true"` on `#prompt-output` and focuses it
- [ ] Edit button hidden while editing; Done button shown
- [ ] Pressing Escape cancels: restores `#prompt-output` textContent to `generatedPrompt`, removes contenteditable, hides Done, shows Edit
- [ ] Clicking Done: saves `#prompt-output.textContent` to `generatedPrompt`, removes contenteditable, hides Done, shows Edit
- [ ] `originalTranscript` is never modified by Edit — regenerate always uses the speech original
- [ ] Edit mode does not affect Copy or Regenerate while active (they still work)

### Regenerate (F7)
- [ ] Clicking Regenerate calls `window.electronAPI.generatePrompt(originalTranscript, getMode())`
- [ ] Transitions to THINKING state immediately
- [ ] On success → `generatedPrompt = genResult.prompt`, `setState('PROMPT_READY', { prompt: generatedPrompt })`
- [ ] On failure → `setState('ERROR', { message: genResult.error })`
- [ ] Uses `originalTranscript` (frozen at recording stop), NOT current `generatedPrompt`
- [ ] Uses current active mode at time of click (not the mode used for original generation)

---

## 4. Scope boundaries

**Included:**
- Copy button flash + clipboard IPC
- Edit contenteditable with Escape/Done
- Regenerate re-calling generatePrompt IPC with originalTranscript

**Explicitly deferred:**
- Keyboard shortcut for copy (Cmd+C works natively in contenteditable; dedicated shortcut = v2)
- "Click outside PROMPT_READY to dismiss" — not in this feature
- Any persistence of generated prompts — v2

---

## 5. Integration points

- `generatedPrompt` — module-scope string in index.html, written by F-CLAUDE, read and written (Edit/Done) by F-ACTIONS
- `originalTranscript` — module-scope string in index.html, written by F-SPEECH, read (never written) by F-ACTIONS
- `window.electronAPI.copyToClipboard(text)` — preload.js, IPC already live in main.js
- `window.electronAPI.generatePrompt(transcript, mode)` — preload.js, IPC already live in main.js
- `setState('THINKING')`, `setState('PROMPT_READY', { prompt })`, `setState('ERROR', { message })` — all exist
- `getMode()` — localStorage wrapper, already declared in index.html
- DOM IDs: `#action-copy`, `#action-edit`, `#action-done`, `#action-regenerate`, `#prompt-output`
- CSS: `.btn-action`, `.btn-secondary`, `.btn-done` — all existing classes; no new styles needed except copy flash

---

## 6. New data model changes

None. All variables (`generatedPrompt`, `originalTranscript`) already declared.

---

## 7. New API endpoints / IPC channels

None. `copy-to-clipboard` and `generate-prompt` are already registered.

---

## 8. Edge cases and error states

| Scenario | Behaviour |
|----------|-----------|
| Copy fails (IPC error) | Silent — no flash, button stays "Copy" (acceptable v1) |
| Edit → Escape → Copy | Copies original `generatedPrompt`, not the partially edited DOM text |
| Edit → Done → Regenerate | Regenerate uses `originalTranscript`, not the edited `generatedPrompt` |
| Regenerate while editing | Exits edit mode (setState('THINKING') hides PROMPT_READY panel entirely) |
| Regenerate fails (Claude timeout) | ERROR state shown — user must tap to dismiss, returning to IDLE |
| Empty generatedPrompt at Copy | Copies empty string — acceptable v1, not a reachable state under normal flow |

---

## 9. Non-functional requirements

- Copy flash must be exactly 1.8s (per SPEC.md F5) — use `setTimeout(1800)`
- `contenteditable` must remove `outline` when not in edit mode (CSS `.prompt-output:focus` already handles this)
- No innerHTML — all DOM writes via `textContent`

---

## 10. Conformance checklist

- [ ] Copy flashes green 1.8s, text "Copied!", returns to "Copy"
- [ ] Copy writes `generatedPrompt` to clipboard via IPC
- [ ] Edit makes `#prompt-output` contenteditable, shows Done, hides Edit
- [ ] Escape cancels edit, restores `generatedPrompt`, hides Done, shows Edit
- [ ] Done saves `#prompt-output.textContent` to `generatedPrompt`, exits edit mode
- [ ] `originalTranscript` never mutated by any action
- [ ] Regenerate uses `originalTranscript` (not `generatedPrompt`)
- [ ] Regenerate uses current active mode
- [ ] Regenerate transitions THINKING → PROMPT_READY (success) or ERROR (failure)
- [ ] No new IPC channels
- [ ] No `innerHTML` with dynamic content
- [ ] No direct `localStorage.*` access
- [ ] `npm run lint` passes
- [ ] CODEBASE.md updated
