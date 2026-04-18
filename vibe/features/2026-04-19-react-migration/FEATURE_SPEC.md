# FEATURE_SPEC.md — FEATURE-004: React Migration
> Feature: Migrate renderer from vanilla JS/HTML to React + Vite
> Folder: vibe/features/2026-04-19-react-migration/
> Date: 2026-04-19

---

## 1. Feature overview

Migrate Promptly's renderer (currently a single `index.html` with vanilla JS) to a React + Vite build. All 5 states become React components. The Electron main process (`main.js`, `preload.js`, `splash.html`) is unchanged. The React build output (`dist-renderer/`) replaces `index.html` as the loaded file. This migration enables history UI, future features, and maintainable component-level state management.

## 2. User stories

- As a developer, I want the renderer split into components so each state is independently editable and testable.
- As a developer, I want CSS design tokens in a single source-of-truth file so light/dark overrides are co-located.
- As a developer, I want hooks for mode, recording, and window resizing so IPC logic is separated from UI.

## 3. Acceptance criteria

- [ ] `npm run dev` starts Vite + Electron together (Vite on :5173, Electron loads http://localhost:5173)
- [ ] All 5 states render correctly: IDLE, RECORDING, THINKING, PROMPT_READY, ERROR
- [ ] Waveform canvas animates in RECORDING state (red sine wave)
- [ ] Morph canvas animates in THINKING state (blue slow wave)
- [ ] Mode selection via right-click persists in localStorage and updates mode pill
- [ ] ⌥ Space shortcut triggers recording from IDLE; stops from RECORDING
- [ ] Whisper transcription works end to end
- [ ] Prompt generation works end to end (all 6 modes)
- [ ] Copy prompt flashes green 1.8s + writes to clipboard
- [ ] Edit mode works (contentEditable, Escape cancels, Done saves to generatedPrompt)
- [ ] Regenerate uses originalTranscript (useRef), not edited text
- [ ] Splash screen still works independently (vanilla HTML, no React dependency)
- [ ] History saves to localStorage (`promptly_history`) on every PROMPT_READY transition
- [ ] `npm run build:renderer` produces `dist-renderer/` folder
- [ ] `npm run start:react` loads the built renderer correctly
- [ ] Window sizing correct in all states (uses STATE_HEIGHTS via resizeWindow IPC)
- [ ] Glass morphism / vibrancy renders correctly (transparent body + .bar CSS)
- [ ] Light/dark mode theme switching works via nativeTheme IPC
- [ ] No console errors in any state

## 4. Scope boundaries

**Included:**
- React component tree for all 5 UI states
- Vite build tooling (devDep only)
- CSS split into tokens.css, bar.css, states.css
- Hooks: useMode, useWindowResize
- History foundation: saveToHistory() on PROMPT_READY
- main.js renderer loading updated (React build in prod, Vite dev server in dev)

**Explicitly deferred:**
- History UI (browseable history list) — future feature
- History state panel (HISTORY state) — future feature  
- Test framework integration — manual smoke test remains the gate
- TypeScript migration — not in scope

## 5. Integration points

- **main.js**: Change `win.loadFile('index.html')` to detect NODE_ENV and load React build
- **preload.js**: No changes — all `window.electronAPI` methods used as-is
- **splash.html**: No changes — stays vanilla HTML
- **package.json**: Add vite, @vitejs/plugin-react, react, react-dom as devDeps; add new scripts
- **electron-builder `files` config**: Include `dist-renderer/` instead of `index.html`

## 6. New data

`localStorage.promptly_history` — JSON array, up to 100 entries, each:
```json
{ "id": 1234567890, "transcript": "...", "prompt": "...", "mode": "balanced", "timestamp": "2026-04-19T..." }
```

## 7. Edge cases and error states

- If `window.electronAPI` is not available (non-Electron context), components must not crash — guard calls
- Canvas RAF loops must cancel on component unmount (useEffect cleanup)
- `originalTranscript` captured as useRef — never set via useState (avoids stale render loops)
- Edit mode Escape must restore previous generatedPrompt, not clear it
- `onShortcutTriggered` IPC listener registered once via useEffect with stateRef to avoid stale closures

## 8. Non-functional requirements

- Zero runtime npm dependencies added (React/Vite are devDeps — bundled at build time)
- `dist-renderer/` produced by `npm run build:renderer` must be self-contained (no CDN)
- `npm run start:react` must work offline

## 9. Conformance checklist

See Section 3 Acceptance criteria — identical. All 18 items must be ✅ before merging to main.
