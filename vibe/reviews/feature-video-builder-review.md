# Review — FEATURE-VIDEO-BUILDER
> Date: 2026-04-28 · Reviewed by: vibe-review skill
> Branch: feat/video-builder · Files changed: 10 source + 6 docs

---

## Automated checks

| Check | Result |
|-------|--------|
| `npm run lint` | ✅ PASS — 0 errors, 0 warnings |
| `npm test` | ✅ PASS — 20/20 tests (vitest 4.1.5) |
| `npm audit` | ✅ PASS — 0 vulnerabilities |

---

## Carryover check

**Previous review:** full-project-review-2026-04-28.md — Score 9.3/10 (Grade A) — 0 P0, 0 P1

Open carryovers from backlog:

| ID | Status |
|----|--------|
| P3-EXP-002 | ⚠️ STILL OPEN — ExpandedDetailPanel ISP — now 23 props (was 19, +4 from video additions). Noted as boundary-layer necessity. |
| BL-060 | ⚠️ STILL OPEN — PolishReadyState narrow-width crowding. Not impacted by this feature. |

---

## Architecture drift detection

Checked all ARCHITECTURE.md rules against the 10 changed source files.

| Rule | Status |
|------|--------|
| No runtime npm deps | ✅ Clean — 0 new deps |
| IPC via `window.electronAPI` only | ✅ Clean — no direct ipcRenderer |
| `localStorage` via wrappers only | ✅ Clean — no direct access |
| No `dangerouslySetInnerHTML` | ✅ Clean — JSX text nodes throughout |
| `claudePath` / `generateRaw` passthrough | ✅ Clean — `generate-raw` IPC used correctly |
| Passthrough mode in `generate-prompt` | ✅ Clean — `video: { passthrough: true }` at main.js:143 |
| One component per file | ✅ Clean — two new component files, one per concern |
| All state via `transition()` | ✅ Clean — no direct DOM mutation |
| Folder structure | ✅ Clean — new files in correct locations |
| Naming conventions | ✅ Clean — camelCase handlers, SCREAMING_SNAKE constants |

**No architecture drift found.**

---

## Findings

### P0 — Critical (1 found)

**P0-VID-001 · useVideoBuilder.js + VideoBuilderDoneState.jsx · copyToClipboard API misuse**

```
File: src/renderer/hooks/useVideoBuilder.js · Lines 234, 239
File: src/renderer/components/VideoBuilderDoneState.jsx · Line 47
```

Issue: `copyToClipboard` is called with an object `{ text: '...' }` in three places. Every other call site in the codebase passes a plain string. The preload signature is:
```js
copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', { text })
```
Calling with an object causes the main handler to receive `{ text: { text: '...' } }`, and `clipboard.writeText({ text: '...' })` writes `[object Object]` to the clipboard.

Evidence:
```js
// useVideoBuilder.js:234 — handleVideoCopyNow
window.electronAPI?.copyToClipboard?.({ text: originalTranscript.current })  // ❌ object

// useVideoBuilder.js:239 — handleVideoCopyPrompt  
window.electronAPI?.copyToClipboard?.({ text: videoBuiltPrompt })  // ❌ object

// VideoBuilderDoneState.jsx:47 — fallback copy path
window.electronAPI.copyToClipboard({ text: prompt })  // ❌ object

// All correct call sites in codebase pass plain string:
window.electronAPI.copyToClipboard(generatedPrompt)  // ✅ App.jsx:563
window.electronAPI.copyToClipboard(prompt)           // ✅ ImageBuilderDoneState.jsx:27
window.electronAPI.copyToClipboard(selected.prompt)  // ✅ ExpandedDetailPanel.jsx:48
```

Impact: "Copy now →" and "Copy prompt" both write `[object Object]` to clipboard — the core copy action of the entire video builder flow is broken.

Fix:
```js
// useVideoBuilder.js:234
window.electronAPI?.copyToClipboard?.(originalTranscript.current)

// useVideoBuilder.js:239
window.electronAPI?.copyToClipboard?.(videoBuiltPrompt)

// VideoBuilderDoneState.jsx:47
window.electronAPI.copyToClipboard(prompt)
```

---

### P1 — Warnings (3 found)

**P1-VID-001 · IdleState.jsx · Video mode missing orange identity**

```
File: src/renderer/components/IdleState.jsx · Lines 2–4, 11–13, 115, 189–191
```

Issue: `IdleState` has branches for `isPolish`, `isRefine`, and `isImage` but no `isVideo`. Video mode falls through to the default blue — ring colour `rgba(10,132,255,`, mode pill blue `rgba(10,132,255,0.12)`, and subtitle "⌥ Space to speak · ⌘T to type" — instead of orange + "Speak your video idea". This mirrors the P1-002 finding from the image builder review exactly.

Impact: When `mode === 'video'` is active, the Idle bar shows no visual distinction. User cannot distinguish video mode from balanced/detailed/concise at a glance.

Fix: Add `const isVideo = mode === 'video'` and branch all four locations:
- `ringColor` (line 11): add `isVideo ? 'rgba(251,146,60,'` before the blue fallback
- `micStroke` / `micStrokeFaded` (lines 12-13): add `isVideo ? 'rgba(251,146,60,0.8)'` 
- `boxShadow` (line 63): add `isVideo ? '0 0 12px rgba(251,146,60,0.2)'`
- Subtitle (line 115): add `isVideo ? 'Speak your video idea'` before the default
- Mode pill bg/border/color (lines 189–191): add `isVideo` orange ternary arm

**P1-VID-002 · ExpandedTransportBar.jsx · Video mode pill shows blue not orange**

```
File: src/renderer/components/ExpandedTransportBar.jsx · Lines 25–27
```

Issue: `isVideo` is defined at line 22 (for the collapse-button disable logic) but not used in the mode pill colour calculation. The pill ternary falls through to the blue default for video mode.

```js
// Current — video shows blue:
const pillBg = isPolish ? 'rgba(48,209,88,0.12)' : isRefine ? 'rgba(168,85,247,0.12)' : 'rgba(10,132,255,0.12)'

// Correct — video should be orange:
const pillBg = isPolish ? 'rgba(48,209,88,0.12)' : isRefine ? 'rgba(168,85,247,0.12)' : isVideo ? 'rgba(251,146,60,0.12)' : 'rgba(10,132,255,0.12)'
```

Impact: The mode pill in the expanded transport bar shows blue for video mode — inconsistent with all other video UI elements (chips, buttons, ThinkingState, header) which use orange.

Fix: Add `isVideo` arm to `pillBg`, `pillBorder`, and `pillColor` ternaries at lines 25–27:
```js
const pillBg = isPolish ? 'rgba(48,209,88,0.12)' : isRefine ? 'rgba(168,85,247,0.12)' : isVideo ? 'rgba(251,146,60,0.12)' : 'rgba(10,132,255,0.12)'
const pillBorder = isPolish ? '0.5px solid rgba(48,209,88,0.3)' : isRefine ? '0.5px solid rgba(168,85,247,0.3)' : isVideo ? '0.5px solid rgba(251,146,60,0.3)' : '0.5px solid rgba(10,132,255,0.25)'
const pillColor = isPolish ? 'rgba(100,220,130,0.9)' : isRefine ? 'rgba(200,160,255,1.0)' : isVideo ? 'rgba(251,146,60,0.85)' : 'rgba(100,180,255,0.85)'
```

**P1-VID-003 · App.jsx · 642 lines — above SRP threshold**

```
File: src/renderer/App.jsx · 642 lines
```

Issue: App.jsx is 642 lines — above the 500-line P1 threshold documented in the review criteria. This is the third time the file has crossed this boundary (BL-030 at 561, BL-033 at 652, refactored to 466, now 642 after image + video builder additions).

Root cause: both `imageBuilderProps` bundle assembly (lines 476–499) and `videoBuilderProps` bundle assembly (lines 500–540) are inline in JSX — 40-line objects defined directly in the render return. Pattern is consistent but verbose.

Impact: Not a runtime bug. Increases cognitive load and makes the render function harder to scan.

Fix: Extract both props bundles to `useMemo` with appropriate deps or move out of JSX to named variables above the return statement. This is the correct next extraction point. This can be addressed in a follow-up commit on this branch before merge.

---

### P2 — Notes (1 found)

**P2-VID-001 · ThinkingState.jsx · RGBA manipulation via regex is fragile**

```
File: src/renderer/components/ThinkingState.jsx · Lines 7–9
```

Issue: The `accentColor` → background/border derivation uses `.replace(/[\d.]+\)$/, '0.1)')`. This works only if `accentColor` is exactly `rgba(R,G,B,N)` with no spaces and the alpha is last. If the string format changes, the replace produces silently wrong CSS.

```js
const pillStyle = accentColor
    ? { ..., background: `${accentColor.replace(/[\d.]+\)$/, '0.1)')}`, ... }
    : ...
```

Impact: No current breakage — the caller always passes `rgba(251,146,60,0.8)`. Risk is future callers.

Fix option A: Pass explicit bg/border strings alongside accentColor (adds props).
Fix option B: Define the orange pill style as a constant in the hook and pass it directly.
Fix option C: Accept and live with it — document the format constraint in a comment:
```js
// accentColor must be rgba(R,G,B,A) with no spaces — alpha is replaced for bg/border
```

---

### P3 — Minor (2 found)

**P3-VID-001 · ExpandedDetailPanel.jsx · 23 props (ISP carryover P3-EXP-002)**
- File: `src/renderer/components/ExpandedDetailPanel.jsx` — 4 new props added (thinkingLabel, thinkingAccentColor, imageBuilderProps, videoBuilderProps) → 23 total. Carryover from P3-EXP-002 — acknowledged as boundary-layer necessity. Tracking only.

**P3-VID-002 · VideoBuilderState.jsx:195 · Hardcoded `#1a1a24` picker background**
- File: `src/renderer/components/VideoBuilderState.jsx` · Line 195 — `background: '#1a1a24'` for the picker dropdown. Not in the `@theme` token set. Minor deviation from the no-hardcoded-hex rule. All other colours in this file use RGBA.

---

## Strengths

- **Architecture pattern fidelity**: The two-phase Claude flow (pre-selection JSON → review → assembly) mirrors `useImageBuilder.js` precisely. Hooks, IPC channels, state transitions, and passthrough mode all follow established patterns with zero drift.
- **Reiterate merge logic** (`useVideoBuilder.js:148–182`): Correctly handles user-chip preservation, AI-chip refresh from new defaults, removedByUser exclusion, and boolean toggle refresh — a non-trivial algorithm done cleanly.
- **Collapse guard** (`ExpandedTransportBar.jsx:47–60`): Correctly disables collapse in video mode with opacity, cursor, title tooltip, and no onClick — exactly as specified.
- **ThinkingState accentColor** mechanism: The orange pill override in THINKING state correctly reflects video mode throughout — wired at all three layers (App.jsx → ExpandedDetailPanel inline block + ThinkingState component).
- **Clean hook isolation**: `useVideoBuilder.js` is fully self-contained — 303 lines, single concern, no state leaking into App.jsx beyond the return object.
- **Test suite**: 20 tests still passing after all changes. No regressions.
- **Lint clean**: 0 errors, 0 warnings.
- **Zero vulnerabilities**: `npm audit` clean.

---

## Quality score

| Factor | Deduction | Running total |
|--------|-----------|---------------|
| Start | — | 10.0 |
| P0-VID-001 (clipboard broken) | -1.0 | 9.0 |
| P1-VID-001 (IdleState no video identity) | -0.5 | 8.5 |
| P1-VID-002 (transport bar pill blue) | -0.5 | 8.0 |
| P1-VID-003 (App.jsx 642 lines) | -0.5 | 7.5 |
| P2-VID-001 (fragile RGBA replace) | -0.2 | 7.3 |
| P3-VID-001 + P3-VID-002 | -0.2 | 7.1 |
| Architecture drift | 0 | 7.1 |

**Score: 7.1 / 10 — Grade C**

---

## Gate decision

🔴 **BLOCKED** — 1 P0 issue (clipboard writes `[object Object]`). Fix P0-VID-001 first.

After P0 fix: 3 P1 warnings remain. Fix P1-VID-001 + P1-VID-002 (both are 1–3 line changes each) before merge.
P1-VID-003 (App.jsx size) can be resolved as a follow-up commit on this branch.

RFX tasks logged to TASKS.md.
