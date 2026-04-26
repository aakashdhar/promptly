# Toggle — Expand/Collapse between minimized bar and expanded view

## Problem
No affordance exists to switch between the minimized bar and the expanded
full view. Users are locked into one state with no way to toggle.

## Solution
Two changes only:
1. Minimized bar — add expand button top-right + increase height for breathing room
2. Expanded view — add collapse button top-right of transport bar

## IMPORTANT CONSTRAINTS
- Zero logic changes
- Zero IPC changes
- Zero hook changes
- Zero utility changes
- Only files that may change: App.jsx (STATE_HEIGHTS + toggle handler),
  IdleState.jsx (expand button + height), the expanded view component
  (collapse button only)
- The minimized bar content row must look pixel-perfect identical
  to the current screenshot — mic ring, text, type button, mode pill
  all unchanged

## Change 1 — Minimized bar (IdleState.jsx)

### Height change
Current STATE_HEIGHTS.IDLE: 118px
New STATE_HEIGHTS.IDLE: 134px (increase by 16px to give bottom breathing room)
The content row stays exactly as-is — just more vertical space around it

### Expand button
Position: top-right corner, same row as traffic lights
  — traffic lights on the left as normal
  — expand button on the right end of that same row

Button spec:
  width: 22px
  height: 22px
  border-radius: 6px
  background: rgba(255,255,255,0.04)
  border: 0.5px solid rgba(255,255,255,0.09)
  display: flex, align-items: center, justify-content: center
  cursor: pointer
  margin-right: 2px
  WebkitAppRegion: no-drag

Icon — four-corner expand arrows SVG (10x10, viewBox 0 0 12 12):
  <path d="M1 4.5V1.5A0.5 0.5 0 0 1 1.5 1H4.5" stroke="rgba(255,255,255,0.38)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M7.5 1H10.5A0.5 0.5 0 0 1 11 1.5V4.5" stroke="rgba(255,255,255,0.38)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M11 7.5V10.5A0.5 0.5 0 0 1 10.5 11H7.5" stroke="rgba(255,255,255,0.38)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M4.5 11H1.5A0.5 0.5 0 0 1 1 10.5V7.5" stroke="rgba(255,255,255,0.38)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>

### Bottom breathing room
"built using vibe-* skills" position:
  bottom: 10px (was 8px)
This gives the tagline proper clearance from the bottom edge.

### Traffic lights row layout change
Current: h-[28px] w-full drag spacer div
New: flex row, justify-content space-between, align-items center,
     height 28px, padding 0 14px 0 0
Left: invisible flex:1 drag area (macOS traffic lights appear here natively)
Right: expand button (WebkitAppRegion no-drag)

### onClick behaviour
onClick on expand button:
  Call transition(STATES.PROMPT_READY) — pure state change, no new logic

## Change 2 — Expanded view (PromptReadyState.jsx + PolishReadyState.jsx)

### Collapse button
panel-ready div is already position:relative (className="relative z-[1]").
Add a collapse button positioned absolute top-right.

Button spec:
  position: absolute
  top: 14px
  right: 16px
  width: 26px
  height: 26px
  border-radius: 7px
  background: rgba(255,255,255,0.05)
  border: 0.5px solid rgba(255,255,255,0.1)
  display: flex, align-items: center, justify-content: center
  cursor: pointer
  z-index: 10
  WebkitAppRegion: no-drag

Icon — two horizontal lines suggesting compact bar (12x10, viewBox 0 0 14 10):
  <rect x="0" y="1" width="14" height="2" rx="1" fill="rgba(255,255,255,0.45)"/>
  <rect x="0" y="7" width="14" height="2" rx="1" fill="rgba(255,255,255,0.45)"/>

### onClick behaviour
onClick on collapse button:
  Call transition(STATES.IDLE) — resize to IDLE dimensions via existing transition()

### Zero disruption to transport layout
The collapse button is position:absolute so it does not affect
the flex layout of the panel at all.

## Window sizing
transition() already calls resizeWindow(STATE_HEIGHTS[newState]) — no extra calls needed.
