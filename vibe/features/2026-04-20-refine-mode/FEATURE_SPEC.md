# FEATURE_SPEC.md — FEATURE-010: Refine Mode
> Created: 2026-04-20 | Status: In progress
> Folder: vibe/features/2026-04-20-refine-mode/

---

## 1. Feature overview

Add a 7th prompt mode (`refine`) to the existing mode system. Refine is for structured design and product feedback — when active, it transforms spoken feedback about an existing element into a four-section actionable prompt (Current state, Problem, Desired outcome, Constraints). Purple visual accent throughout the UI distinguishes it from the blue default.

---

## 2. User stories

- As a designer, I want to speak feedback about an existing UI element and receive a structured, unambiguous prompt that a developer can act on immediately.
- As a user, I want visual confirmation that I'm in Refine mode (purple pill, purple ring) so I know how my transcript will be processed.

---

## 3. Acceptance criteria

- [ ] `refine` key present in MODE_CONFIG in main.js with `standalone: true` and the exact system prompt
- [ ] `refine` entry in show-mode-menu modes array — appears in right-click menu with radio checkmark
- [ ] `refine: 'Refine'` in useMode.js MODE_LABELS — mode pill shows 'Refine'
- [ ] Mode persists in localStorage via existing `mode` key — no new keys
- [ ] IdleState: mode pill shows purple colors when mode === 'refine'
- [ ] IdleState: pulse ring uses purple background/border/shadow when mode === 'refine'
- [ ] IdleState: mic SVG stroke uses rgba(200,160,255,0.8) when mode === 'refine'
- [ ] IdleState: subtitle reads 'Describe what exists, what's wrong, and what you want' when mode === 'refine'
- [ ] PromptReadyState: status line reads 'Refinement prompt ready' when mode === 'refine'
- [ ] PromptReadyState: section labels render in rgba(168,85,247,0.7) when mode === 'refine'
- [ ] PromptReadyState: Copy prompt button uses purple gradient + purple shadow when mode === 'refine' (non-copied state)
- [ ] Output contains all four sections: Current state, Problem, Desired outcome, Constraints

---

## 4. Scope boundaries

**Included:**
- New mode entry in MODE_CONFIG (main.js)
- New mode entry in show-mode-menu array (main.js)
- New label in MODE_LABELS (useMode.js)
- Purple accent: mode pill, pulse ring, mic stroke, subtitle (IdleState.jsx)
- Purple accent: status line, section labels, copy button (PromptReadyState.jsx)

**Explicitly deferred:**
- Refine-specific keyboard shortcut
- Recording or thinking state visual changes (not required)
- ShortcutsPanel mode list (confirmed: ShortcutsPanel has no mode list)

---

## 5. Integration points

- `main.js` `MODE_CONFIG` constant — add `refine` alongside existing 6 modes
- `main.js` `show-mode-menu` IPC handler — modes array, add `{ key: 'refine', label: 'Refine' }` after `design`
- `src/renderer/hooks/useMode.js` `MODE_LABELS` — add `refine: 'Refine'`
- `src/renderer/components/IdleState.jsx` — conditional purple styles based on `mode` prop (already passed)
- `src/renderer/components/PromptReadyState.jsx` — `renderPromptOutput` label color param + conditional status/button styles

No new IPC channels. No new localStorage keys. No new React hooks.

---

## 6. Data model changes

None. `mode` localStorage key already accepts any string — `'refine'` persists with no code change to storage layer.

---

## 7. Edge cases and error states

- If Whisper returns empty transcript in Refine mode — same error path as all other modes (ERROR state)
- If Claude CLI returns empty in Refine mode — same error path ("Claude returned an empty response")
- If output doesn't contain all 4 section labels — renderPromptOutput still renders correctly (labels are detected by regex, missing ones just don't appear)

---

## 8. Non-functional requirements

- No runtime npm dependencies added
- No new IPC channels
- No new localStorage keys
- Purple palette: rgba(168,85,247,*) — consistent throughout all refine UI touches

---

## 9. Conformance checklist

- [ ] All acceptance criteria above ticked
- [ ] `npm run lint` passes (0 errors)
- [ ] Manual smoke test: Refine mode selected → purple UI → record → prompt ready → four sections → copy
- [ ] Mode persists after app restart
- [ ] Other modes unaffected (blue accent, normal subtitles)
- [ ] CODEBASE.md updated
- [ ] DECISIONS.md updated
