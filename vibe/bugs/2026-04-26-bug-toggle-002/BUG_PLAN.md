# BUG_PLAN — BUG-TOGGLE-002
> Tear down ExpandedIdleView.jsx and rebuild as three-zone ExpandedView.jsx.
> Date: 2026-04-26

---

## Exact files to modify
1. `src/renderer/components/ExpandedView.jsx` — CREATE new (three-zone layout)
2. `src/renderer/App.jsx` — swap import, gate all states, fix height, remove inline collapse button
3. `src/renderer/components/ExpandedIdleView.jsx` — DELETE (becomes unused)

## Exact files NOT to touch
- `main.js`, `preload.js`
- `src/renderer/hooks/useRecording.js`
- `src/renderer/hooks/useKeyboardShortcuts.js`
- `src/renderer/hooks/usePolishMode.js`
- `src/renderer/hooks/useMode.js`
- `src/renderer/hooks/useWindowResize.js`
- `src/renderer/hooks/useTone.js`
- `src/renderer/components/IdleState.jsx`
- `src/renderer/components/RecordingState.jsx`
- `src/renderer/components/PausedState.jsx`
- `src/renderer/components/ThinkingState.jsx`
- `src/renderer/components/PromptReadyState.jsx`
- `src/renderer/components/PolishReadyState.jsx`
- `src/renderer/components/ErrorState.jsx`
- `src/renderer/components/IteratingState.jsx`
- `src/renderer/components/TypingState.jsx`
- `src/renderer/index.css`

---

## ExpandedView.jsx — full specification

### Outer shell
```
display: flex
flexDirection: column
height: 100%
background: #0e0e0f
position: relative
```

### Zone 1 — Top Bar (~120px total, background: #111113, borderBottom: 0.5px solid rgba(255,255,255,0.06))
Layout: flex column

Row 1 — Traffic light spacer + collapse button:
- div height 36px, WebkitAppRegion: drag
- Collapse button: position absolute, top 14px, right 16px, 26×26px, borderRadius 7px
  - background rgba(255,255,255,0.05), border 0.5px rgba(255,255,255,0.1)
  - Two-bar SVG icon (≡), onClick: onCollapse
  - Hover: background rgba(255,255,255,0.12)

Row 2 — Transport row:
- display flex, alignItems center, justifyContent center, gap 20px
- padding: 0 20px
- Left flank (width 120px, justifyContent flex-end, gap 10px):
  - Pause button (34px circle) — only shown during RECORDING state
    background rgba(255,189,46,0.12), border 0.5px rgba(255,189,46,0.3)
    onClick: onPause
    Pause icon SVG
  - Timer: monospace 11px, rgba(255,255,255,0.4), min-width 32px, text-align right
    Value: duration prop (format "0:00")
- Centre: Record button (52px circle, WebkitAppRegion: no-drag)
  - IDLE: background rgba(255,255,255,0.06), border 0.5px rgba(255,255,255,0.12), mic SVG (14×16px), onClick: onStart
  - RECORDING: background rgba(200,50,35,0.95), stop square SVG, dual pulse rings (border-radius 50%, animate out), onClick: onStop
  - THINKING: spinning arc SVG (40px) around 40px inner circle (rgba(255,255,255,0.06))
  - PROMPT_READY: same as IDLE (return to ready)
- Right flank (width 120px, justifyContent flex-start, gap 10px):
  - Mode tag pill: same style as IdleState mode pill, onClick: showModeMenu

Row 3 — Waveform zone (36px tall, full width):
- IDLE: div with single hairline (height 1px, background rgba(255,255,255,0.08), margin: 0 auto, width: 60%)
- RECORDING: import WaveformCanvas, render at full width, height 36px
- THINKING: import MorphCanvas, render at full width, height 36px
- PROMPT_READY: same as IDLE (flat hairline)

### Zone 2+3 — Body (flex: 1, display: flex, flexDirection: row, minHeight: 0)

Zone 2 — Left Panel:
- width: 228px, flexShrink: 0
- background: #0e0e0f
- borderRight: 0.5px solid rgba(255,255,255,0.06)
- Header: "SESSION HISTORY" — fontSize 9px, letterSpacing 0.1em, color rgba(255,255,255,0.25), padding 14px 16px 8px, fontWeight 500
- History list: overflowY auto, flex 1, padding 0 8px 8px
  - Read history via getHistory() — called once on mount (useState)
  - Each entry: onClick → setActiveId(entry.id)
  - Entry style: padding 8px, borderRadius 6px, marginBottom 4px, cursor pointer
    - Active: borderLeft 2px solid rgba(10,132,255,0.5), background rgba(10,132,255,0.07), paddingLeft 6px
    - Hover (non-active): background rgba(255,255,255,0.04)
  - Entry content:
    - Top: timestamp (10px, monospace, rgba(255,255,255,0.25)) + mode tag (9px, right-aligned)
    - Title: 12px, rgba(255,255,255,0.72), marginTop 2px, overflow ellipsis
  - Empty state: "No history yet" (11px, rgba(255,255,255,0.25), textAlign center, padding 24px 0)

Zone 3 — Right Panel:
- flex: 1, minWidth: 0
- background: #0e0e0f
- overflowY: auto
- State-specific content (see below)

### Right panel content per state

IDLE:
- Centered vertically, padding 32px
- "Speak your prompt" — 16px, fontWeight 500, rgba(255,255,255,0.82), marginBottom 8px
- "Press ⌥ Space or click mic to start" — 12px, rgba(255,255,255,0.38)

RECORDING:
- padding 24px
- "Listening..." — 13px, fontWeight 500, rgba(255,255,255,0.75), marginBottom 8px
- "Speak now. Recording will stop when you tap the square." — 12px, rgba(255,255,255,0.35)

THINKING:
- padding 24px
- "Generating prompt..." — 13px, fontWeight 500, rgba(255,255,255,0.75), marginBottom 16px
- Skeleton sections (3): height 12px, borderRadius 4px, background rgba(255,255,255,0.06)
  - widths: '80%', '60%', '70%' — separated by gap 10px

PROMPT_READY:
- padding 20px 24px
- Header: green dot (✓ or dot) + "Prompt ready" + action links row
  - links: "↻ Iterate" (blue), "Regenerate", "Export", "Reset"
- Content: two-column CSS grid (1fr 1fr, gap 20px)
  - Parse generatedPrompt sections using same regex as PromptReadyState renderPromptOutput
  - Left column: first half of sections
  - Right column: second half
  - Section label: 9px, uppercase, rgba(100,170,255,0.55), letterSpacing 0.12em
  - Section body: 13px, rgba(255,255,255,0.78), lineHeight 1.75
- Action row (bottom): Edit + Save buttons left, Copy prompt button right

---

## App.jsx changes

1. Remove: `import ExpandedIdleView from './components/ExpandedIdleView.jsx'`
2. Add: `import ExpandedView from './components/ExpandedView.jsx'`
3. Add to STATE_HEIGHTS: `EXPANDED: 580`
4. `handleExpand()`: change `setWindowSize(760, 560)` → `setWindowSize(760, STATE_HEIGHTS.EXPANDED)` (= 760×580)
5. Replace the inner state rendering block:
   - When `isExpanded=true`: render single `<ExpandedView ...all-needed-props />`
   - When `isExpanded=false`: existing state conditionals unchanged
6. Remove the inline collapse button `{isExpanded && displayState !== STATES.PROMPT_READY && (<button>...)}` — it moves into ExpandedView's top bar

## Side effects check
- Normal rendering path (isExpanded=false) is unchanged — all existing props/callbacks remain
- The collapse button inside PromptReadyState (for normal mode) remains — it will never be shown when isExpanded=true since ExpandedView takes over
- History list in zone 2 calls getHistory() on mount — localStorage read, no IPC

## CODEBASE.md update needed?
Yes — add ExpandedView.jsx row, remove ExpandedIdleView.jsx row, update STATE_HEIGHTS.EXPANDED=580 note

## ARCHITECTURE.md update needed?
Yes — state machine section: note isExpanded flag as layout mode, ExpandedView component

## Rollback plan
`git checkout src/renderer/App.jsx src/renderer/components/ExpandedIdleView.jsx && git rm src/renderer/components/ExpandedView.jsx`
