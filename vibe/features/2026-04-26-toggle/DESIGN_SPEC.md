# DESIGN_SPEC — POLISH-TOGGLE (Expand/Collapse)
> Feature: expand/collapse toggle between minimized bar and full three-zone expanded view.
> Branch: feat/toggle-expand-collapse | Added: 2026-04-26

> **Note**: Initial implementation was incorrect (BUG-TOGGLE-002). `ExpandedIdleView.jsx` was created as a generic centred mic screen instead of the three-zone layout. It has been replaced with `ExpandedView.jsx` covering all states. See DECISIONS.md D-BUG-TOGGLE-002.

---

## Problem
No affordance to toggle between the minimized floating bar and a wider expanded view with session history and larger prompt output area.

## Solution
Two toggle buttons:
- **Expand button**: in IdleState top-right — four-corner arrow icon, 22×22px. Expands to 760×580.
- **Collapse button**: in ExpandedView top-right (absolute, top 14px / right 16px) — two-bar icon, 26×26px. Collapses to 520×IDLE_HEIGHT.

`isExpanded` is a layout mode flag (not a state machine state). When `true`, App.jsx renders `<ExpandedView>` for ALL states. When `false`, per-state components render normally.

---

## Layout specification

### OVERALL WINDOW (expanded)
- width: 760px
- height: 580px (`STATE_HEIGHTS.EXPANDED = 580`)
- background: #0e0e0f

### ZONE 1 — TOP BAR (~120px tall)
- background: #111113
- borderBottom: 0.5px solid rgba(255,255,255,0.06)
- Row 1: traffic light spacer (36px, WebkitAppRegion: drag) + collapse button (absolute top-right, 26×26px, borderRadius 7px)
- Row 2: transport row — display flex, alignItems center, justifyContent center, gap 20px
  - Left flank (width 120px, justifyContent flex-end): pause button (34px, recording only) + timer (monospace, rgba(255,255,255,0.4))
  - Centre: record button 52px circle
    - IDLE/READY: rgba(255,255,255,0.06) bg, mic SVG
    - RECORDING: rgba(200,50,35,0.95) bg, stop square SVG, dual pulse rings
    - THINKING: spinning arc SVG (40px) around 40px inner circle
  - Right flank (width 120px, justifyContent flex-start): mode tag pill
- Row 3: waveform zone (36px full width) — IDLE/READY: flat hairline; RECORDING: red WaveformCanvas; THINKING: blue MorphCanvas

### ZONE 2 — LEFT PANEL (228px wide)
- background: #0e0e0f
- borderRight: 0.5px solid rgba(255,255,255,0.06)
- "SESSION HISTORY" label (9px uppercase, rgba(255,255,255,0.25), padding 14px 16px 8px)
- Scrollable history entries (getHistory() on mount + state change)
  - Entry: timestamp (10px monospace) + mode tag pill + title (12px, ellipsis)
  - Active: borderLeft 2px rgba(10,132,255,0.5), rgba(10,132,255,0.07) bg
  - Empty: "No history yet"

### ZONE 3 — RIGHT PANEL (flex: 1)
- background: #0e0e0f
- Content per state:
  - **IDLE**: centred "Speak your prompt" + "Press ⌥ Space or click mic to start"
  - **RECORDING**: "Listening..." + standby message
  - **PAUSED**: amber "Paused" + resume instruction
  - **THINKING**: "Generating prompt..." + transcript quote + 3 skeleton bars
  - **PROMPT_READY**: header (✓ + "Prompt ready" + action links) + two-column prompt grid (1fr 1fr) + action row (Edit left, Copy prompt right)

---

## State mapping
- `isExpanded=true` → `setWindowSize(760, 580)` via handleExpand()
- `isExpanded=false` → `setWindowSize(520, STATE_HEIGHTS.IDLE)` via handleCollapse()
- `transition()` skips `resizeWindow` when `isExpandedRef.current=true`
- `openHistory()` / `closeHistory()` clear `isExpanded` before opening history panel
