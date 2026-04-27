# Toggle Tasks

- [x] TOG-001 — IdleState.jsx expand button + breathing room
- [x] TOG-002 — App.jsx STATE_HEIGHTS + onExpand/onCollapse handlers
- [x] TOG-003 — expanded view collapse button (PromptReadyState + PolishReadyState)
- [x] TOG-005 — lint + smoke test

---

## TOG-001 — IdleState.jsx: expand button + breathing room

**Done when:**
✅ Traffic lights row is a flex container with `justifyContent: flex-end`, `alignItems: center`, `height: 28px`, `WebkitAppRegion: drag`
✅ Expand button visible at top-right of that row, `width: 22px`, `height: 22px`, `borderRadius: 6px`, `marginRight: 14px`, `WebkitAppRegion: no-drag`
✅ Expand button dimmed (`opacity: 0.35`, `cursor: default`) when `generatedPrompt` is empty; active (`opacity: 1`, `cursor: pointer`) when non-empty
✅ Hover state: `onMouseEnter` → `background: rgba(255,255,255,0.10)`, `onMouseLeave` → restore `rgba(255,255,255,0.04)`
✅ "built using vibe-* skills" tagline positioned at `bottom: 10px`
✅ IdleState height div reads 134px (not 118px)
✅ Content row (mic ring, transcript text, type button, mode pill) is pixel-identical to before

---

## TOG-002 — App.jsx: STATE_HEIGHTS + handlers

**Done when:**
✅ `STATE_HEIGHTS.IDLE` equals 134 in App.jsx
✅ `onExpand` prop on `<IdleState>` evaluates to `() => transition(STATES.PROMPT_READY)` when `generatedPrompt` is non-empty, or `null` when empty
✅ `onCollapse` prop on `<PromptReadyState>` evaluates to `() => transition(STATES.IDLE)`
✅ `onCollapse` prop on `<PolishReadyState>` evaluates to `() => transition(STATES.IDLE)`
✅ No new IPC channels, no new hooks, no new utility functions introduced

---

## TOG-003 — PromptReadyState.jsx + PolishReadyState.jsx: collapse button

**Done when:**
✅ Collapse button visible at `position: absolute`, `top: 14px`, `right: 16px` in both components
✅ Button is `width: 26px`, `height: 26px`, `borderRadius: 7px`, `zIndex: 10`, `WebkitAppRegion: no-drag`
✅ Hover state: `onMouseEnter` → `background: rgba(255,255,255,0.12)`, `onMouseLeave` → restore `rgba(255,255,255,0.05)`
✅ PolishReadyState outer div has `position: relative` (required to anchor absolute collapse button)
✅ Transport bar flex layout completely unaffected (button is `position:absolute`, not in flow)
✅ Clicking collapse button calls `onCollapse` → `transition(STATES.IDLE)` → window resizes to 134px automatically via `transition()`
✅ Clicking expand button calls `onExpand` → `transition(STATES.PROMPT_READY)` → window resizes to 560px automatically via `transition()`

---

## TOG-005 — Lint + smoke test

**Done when:**
✅ `npm run lint` passes with 0 errors, 0 warnings
✅ `npm run build:renderer` succeeds
✅ Branch is `feat/toggle-expand-collapse` — all commits on this branch, not main

## Smoke Checklist

- [ ] Minimized bar content row pixel-identical — mic ring, transcript text, type button, mode pill all unchanged
- [ ] Expand button visible top-right of traffic lights row at 28px height
- [ ] Expand button dimmed when no prompt has been generated (opacity 0.35)
- [ ] Expand button becomes active after a prompt is generated (opacity 1)
- [ ] Expand button click opens PROMPT_READY view (560px height)
- [ ] Bottom of minimized bar has 10px clearance for "built using vibe-*" tagline
- [ ] Collapse button visible top-right of PROMPT_READY panel at top:14px right:16px
- [ ] Collapse button click returns to IDLE at 134px height
- [ ] Collapse button visible in PolishReadyState and works identically
- [ ] Transport bar centred layout completely unaffected by collapse button
- [ ] WebkitAppRegion no-drag on both buttons — they are clickable inside the drag region
