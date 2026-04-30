# FEATURE-IMAGE-BUILDER-V2 — Deeper Nano Banana image builder

## Overview
Rebuild the image builder review screen to go significantly deeper
on Nano Banana parameters. Replace the single flat list of parameters
with category tabs. Add a live variations panel showing 3 AI-generated
prompt variations from the same transcript. Expand presets from 18 to
48 organised by 5 category rows. Expose advanced Nano Banana technical
params (Stylise, Chaos, Weird, Seed). This makes Promptly's image mode
the deepest voice-to-image-prompt tool available for Nano Banana.

## What changes vs current image builder
Current:
  - Single flat review screen with all params at once
  - 18 params across 2 tiers (Essential, Advanced) from PARAM_CONFIG
  - 18 presets as amber chips
  - Single assembled prompt output (no flags)
  - Flat JSON schema: { model, useCase, style, lighting, aspectRatio, … }

New:
  - Category tabs: Subject / Lighting / Camera / Style / Technical
  - Each tab has its own parameter set (nested JSON schema)
  - 48 presets organised by 5 category rows
  - Variations panel (right side, 320px) showing 3 prompt variations
  - "Generate 3 more" button for additional variations
  - Technical tab exposes Stylise, Chaos, Weird, Seed params
  - Negative prompts field (inline chip → multi-add text inputs)
  - Phase 2 output: prompt text + Nano Banana flags on separate line
  - useImageBuilder.js fully rewritten — old PARAM_CONFIG replaced

## Always expanded / maximised
Same as current image builder — always opens in expanded/native window.
No minimized bar state. Collapse button hidden when mode === 'image'.

---

## PHASE 1 — Analysis (updated — new nested JSON schema)

Claude analyses transcript and returns pre-selected parameters.
**This is a full system prompt rewrite** — the old flat schema
(model, useCase, style[], lighting[], etc.) is replaced with the new
nested tab-based schema below. All old PARAM_CONFIG keys are gone.

Phase 1 uses `window.electronAPI.generateRaw(systemPrompt)` —
same IPC channel as video and workflow builders. No new IPC needed.

Full phase 1 system prompt:

```
You are an expert Nano Banana (Midjourney) prompt engineer.
Analyse the user's spoken image idea and return pre-selected
parameter values across five categories.

User's spoken idea: {transcript}

Return ONLY valid JSON — no preamble, no markdown fences:
{
  "subject": {
    "subject": "Young woman",
    "setting": "Ocean/beach",
    "emotion": "Serene",
    "framing": "Close-up",
    "negativePrompts": []
  },
  "lighting": {
    "timeOfDay": "Golden hour",
    "lightType": "Directional sun",
    "quality": "Warm amber",
    "lensFlare": "None"
  },
  "camera": {
    "lens": "85mm portrait",
    "aperture": "f/1.4 shallow",
    "aspectRatio": "4:5 portrait",
    "angle": "Eye level",
    "filmSim": "Kodak Portra 400"
  },
  "style": {
    "visualStyle": "Cinematic film still",
    "colorGrade": "Warm teal-orange",
    "filmGrain": "35mm grain",
    "reference": "Emmanuel Lubezki"
  },
  "technical": {
    "resolution": "Ultra HD 4K",
    "renderQuality": "Photorealistic",
    "stylise": 750,
    "chaos": 20,
    "weird": 0,
    "seed": null
  }
}

Rules:
- Only pre-select values you are confident about from the transcript
- Leave a field empty string "" if not mentioned or unclear
- negativePrompts: array of strings the user mentioned avoiding
- For filmSim pick from: Kodak Portra 400, Fuji Velvia, Ilford HP5,
  CineStill 800T, Digital clean, Lomography, Medium format
- For reference pick a relevant photographer/cinematographer if applicable
- For technical params use Nano Banana's actual parameter ranges:
    stylise: 0–1000 (default 100, higher = more stylised; suggest 750 for cinematic)
    chaos: 0–100 (default 0, higher = more varied; suggest 20 for most subjects)
    weird: 0–3000 (default 0; suggest 0 unless user implies surreal)
    seed: null (user sets manually for reproducibility)
- Respond ONLY with the JSON object
```

Parse response with fence-stripping before JSON.parse — follow the
`parseEmailOutput` pattern in `src/renderer/utils/promptUtils.js`.
Create `parseImageAnalysisOutput(raw)` in promptUtils.js and add
tests to `tests/utils.test.js`.

---

## PHASE 1.5 — Variation generation (NEW)

After phase 1 analysis completes, immediately fire a second
`window.electronAPI.generateRaw(systemPrompt)` call to generate
3 prompt variations. Do not await before showing the review screen —
fire and store the promise; the review screen mounts while it runs.

Uses the same `generate-raw` IPC channel — no new IPC handler needed,
no preload.js changes required.

System prompt for variation generation:

```
You are an expert Nano Banana prompt engineer. Based on this image
idea: {transcript}

Generate exactly 3 distinct prompt variations. Each variation should
interpret the idea differently — different creative angle, different
emphasis, different mood, while staying true to the core subject.

Return ONLY valid JSON — no preamble, no markdown fences:
{
  "variations": [
    {
      "id": 1,
      "prompt": "complete ready-to-use Nano Banana prompt text",
      "focus": "one short phrase describing the creative angle"
    },
    {
      "id": 2,
      "prompt": "...",
      "focus": "..."
    },
    {
      "id": 3,
      "prompt": "...",
      "focus": "..."
    }
  ]
}

Rules for each variation:
- Write complete, ready-to-use prompts (not fragments)
- 40–80 words per prompt
- Each variation must be meaningfully different from the others
- Include subject, setting, mood, lighting, and technical style
- Do NOT include --parameter flags in the prompt text
- Variation 1: closest to what user described, warm/natural
- Variation 2: more dramatic/editorial interpretation
- Variation 3: most cinematic/artistic interpretation
Respond ONLY with the JSON object
```

Parse with fence-stripping (same pattern as phase 1).

Store results as `imageVariations: array` in state (via useImageBuilder).
`selectedVariation: number` (default 1) — which variation is active.
`isGeneratingVariations: boolean` — true while variation call running.

When user clicks "Generate 3 more variations" or "All different →":
  Run the same call again (new `generateRaw` call)
  Append new variations to imageVariations array
  Increment variation IDs starting from `imageVariations.length + 1`
  "Generate 3 more" button shows "Generating..." and is disabled
  while `isGeneratingVariations` is true

---

## REQUIRED PARAMETERS — which params block Confirm

The Confirm button ("Confirm & assemble prompt →") is disabled
(opacity 0.4, pointer-events none) when any of the following
**required** params are empty:

  Subject tab: subject, setting, framing
  Lighting tab: timeOfDay, lightType
  Camera tab: lens, aspectRatio
  Style tab: visualStyle
  Technical tab: renderQuality

All other params (emotion, quality, lensFlare, aperture, angle,
filmSim, colorGrade, filmGrain, reference, resolution, stylise,
chaos, weird, seed, negativePrompts) are optional.

The unfilled count badge ("⚠ X unfilled") counts only required params
that are empty string "".

**Confirm also disabled while `isGeneratingVariations` is true.**
Show tooltip text "Generating variations…" on hover when disabled
for this reason (not for missing params).

---

## NEGATIVE PROMPTS

State location: `imageAnswers.subject.negativePrompts` — an array
of strings. Initialised from phase 1 JSON `subject.negativePrompts`.

Render pattern (Subject tab, Negative row):
- When array is empty: dashed chip "+ add exclusions" → clicking opens
  an inline text input (same pattern as custom chip in old builder)
- When array has items: each item renders as a chip with ✕ remove button
- User can add multiple exclusions; each new "+ add" appends to array
- No limit on number of exclusions

Phase 2 inclusion:
  If `negativePrompts.length > 0`, append to confirmed params JSON:
  `"negativePrompts": ["blur", "overexposed"]`
  The phase 2 system prompt includes: "Avoid these elements: {negatives.join(', ')}.
  Do NOT include 'no X' or 'without X' syntax in the prompt text — instead omit
  those elements entirely."

---

## REITERATE MERGE LOGIC (new nested structure)

When user taps "Reiterate" and re-records:
  1. Re-run phase 1 with new transcript → `newDefaults` (new nested object)
  2. Re-run phase 1.5 variation generation → reset imageVariations, selectedVariation=1
  3. Merge `imageAnswers` with `newDefaults` per-field:
     - For each leaf field (string): if user had changed the value from
       the old AI default → keep user value; else update to new AI default
     - For negativePrompts array: append new AI suggestions to existing array,
       dedup by value
  4. Preserve `removedByUser` set — keys are `"tab.fieldName"` strings,
     e.g. `"lighting.timeOfDay"`. Any new AI default value that appears in
     removedByUser for that field is excluded from the merge result.
  5. `activePreset` is cleared on reiterate (preset applies to full state,
     not meaningful after re-analysis)

`removedByUser` shape:
```js
{
  "lighting.timeOfDay": ["Golden hour"],
  "camera.lens": ["85mm portrait"],
  // …
}
```

---

## REVIEW SCREEN LAYOUT

Three-zone layout within the right panel (ExpandedDetailPanel routes to
ImageBuilderState which owns the full layout):

Zone A (left, flex:1, overflow-y: auto): Category tabs + params + presets + action row
Zone B (right, width:320px, flex-shrink:0): VariationsPanel component

Zone A and B are siblings inside a `display:flex, flexDirection:row` wrapper.
Separated by `borderLeft: '0.5px solid rgba(255,255,255,0.06)'` on Zone B.
`VariationsPanel` is rendered inside `ImageBuilderState.jsx` — NOT added to
`ExpandedDetailPanel` render tree directly.

### Right panel header
Same as current — dot + "Image builder" title + "Nano Banana" badge
+ unfilled count badge (required params only) + Reiterate + Reset links

### You said strip
Same as current — shows transcript in italic below header

### Category tabs
Display: flex row, border-bottom 0.5px rgba(255,255,255,0.06)
padding: 0 22px, gap: 2px

Five tabs: Subject · Lighting · Camera · Style · Technical

Tab default style:
  padding: 8px 14px
  font-size: 11.5px
  color: rgba(255,255,255,0.35)
  border-bottom: 2px solid transparent
  cursor: pointer

Tab active style:
  color: rgba(196,168,255,0.9)
  border-bottom: 2px solid rgba(139,92,246,0.7)
  font-weight: 500

`activeTab` state lives inside `ImageBuilderState.jsx` as local `useState`
— tab selection does not need to survive reiterate or persist to App.jsx.

### Parameter display (per tab)
Each tab shows its own parameter rows.
Row layout: label (9.5px uppercase, min-width 90px) + chips (flex-wrap)

Chip default:
  padding: 4px 11px, border-radius: 7px, font-size: 11.5px
  background: rgba(255,255,255,0.04)
  border: 0.5px solid rgba(255,255,255,0.1)
  color: rgba(255,255,255,0.5)

Chip AI pre-filled (purple dot prefix):
  background: rgba(139,92,246,0.1)
  border: 0.5px solid rgba(139,92,246,0.35)
  color: rgba(196,168,255,0.85)
  Leading '·' character in rgba(139,92,246,0.7) rendered as JSX text node

Clicking any chip selects it (sets that field to the chip value)
Clicking selected non-AI chip deselects it (sets field to "")
Clicking selected AI chip does NOT deselect (required field protection)
  — instead add to removedByUser for that field path

### SUBJECT tab parameters
Subject: Young woman, Man, Child, Couple, Group, Animal, + add
Setting: Ocean/beach, Forest, Urban street, Studio, Desert,
  Mountains, Interior, + add
Emotion: Serene, Joyful, Pensive, Mysterious, Confident, Melancholic
Framing: Close-up, Mid shot, Full body, Over shoulder, Dutch angle
Negative: (see Negative Prompts section above)

### LIGHTING tab parameters
Time of day: Golden hour, Blue hour, Midday, Overcast, Night, Dawn
Light type: Directional sun, Rembrandt, Butterfly, Split, Rim light,
  Practical, Ambient
Quality: Warm amber, Soft diffused, Hard shadows, Dappled, Backlit,
  Contre-jour
Lens flare: None, Subtle, Anamorphic, Strong

### CAMERA tab parameters
Lens: 24mm wide, 35mm street, 50mm standard, 85mm portrait,
  135mm telephoto, Macro, Fisheye
Aperture: f/1.4 shallow, f/2.8, f/5.6, f/11 deep
Aspect ratio: 1:1 square, 4:5 portrait, 2:3, 9:16 vertical,
  16:9 wide, 3:2
Camera angle: Eye level, Low angle, High angle, Bird's eye,
  Worm's eye
Film simulation: Kodak Portra 400, Fuji Velvia, Ilford HP5,
  CineStill 800T, Digital clean, Lomography, Medium format

### STYLE tab parameters
Visual style: Cinematic film still, Editorial fashion, Documentary,
  Fine art, Commercial, Conceptual
Color grade: Warm teal-orange, Desaturated, Hyper-saturated,
  Monochrome, Duotone, Cross-processed
Film grain: 35mm grain, Medium format, Heavy grain, Digital clean,
  Lomography
Reference: Roger Deakins, Emmanuel Lubezki, Annie Leibovitz,
  Nan Goldin, Gregory Crewdson, + add

### TECHNICAL tab parameters
Resolution: Ultra HD 4K, 1080p, Medium, Standard
Render quality: Photorealistic, Hyper-real, Stylised, Painterly
Stylise: chip options 250 subtle, 500, 750 (default AI), 1000 strong
Chaos: chip options 0 precise (default AI), 20, 50, 100 wild
Weird: chip options 0 (default AI), 250, 500, 1000
Seed: dashed chip "+ set seed" → opens inline number input on click;
  entered value renders as a selected chip with ✕ remove; stored as
  `imageAnswers.technical.seed` (number or null)

### Presets strip (below params, above action row)
Section header: "Nano Banana Pro presets" left + "Show all 48 →" right

By default, show first 2 rows (Photography + Cinematic).
"Show all 48 →" expands to all 5 rows (toggled by local state).

Categories and presets (48 total — amber dot chips):

Photography (10):
  Golden hour portrait, Studio editorial, Street documentary,
  Fashion beauty, Macro detail, Architectural, Environmental portrait,
  Night portrait, Drone aerial, Couple romance

Cinematic (10):
  Film noir, Wes Anderson, Sci-fi blockbuster, Indie drama,
  Horror atmospheric, Documentary realism, Period drama,
  New Wave, Road movie, Sci-fi noir

Art styles (12):
  Oil painting, Watercolour, Concept art, Pixel art, Comic book,
  Anime, Impressionist, Surrealism, Art Nouveau, Retro poster,
  Cyberpunk, Grunge

Commercial (8):
  Product shot, Food photography, Real estate, Corporate portrait,
  Lifestyle brand, Wedding & event, Sports action, Travel & tourism

Mood & atmosphere (8):
  Dark moody, Soft dreamy, Gritty urban, Ethereal, Warm cozy,
  High drama, Nostalgic, Otherworldly

Total: 10+10+12+8+8 = 48 ✓

When a preset chip is clicked:
  Apply all preset parameters across all tabs (sets imageAnswers to preset values)
  Show amber dot on the selected preset chip
  Show "Preset active: [Name]" indicator in header
  Clear activePreset on Reiterate or Start over

### Action row
Left: warning if required params unfilled "⚠ X unfilled"
Right: Start over (secondary) + Confirm & assemble prompt → (primary)
Primary disabled (opacity 0.4, pointer-events none) when:
  - Any required param (see REQUIRED PARAMETERS section) is empty, OR
  - isGeneratingVariations is true (with "Generating variations…" tooltip)

---

## VARIATIONS PANEL (Zone B)

New file: `src/renderer/components/VariationsPanel.jsx`
Rendered inside `ImageBuilderState.jsx` (not ExpandedDetailPanel).

### Props interface
```jsx
VariationsPanel({
  variations,            // array of { id, prompt, focus }
  selectedVariation,     // number — ID of active variation
  isLoading,             // boolean — true while generating
  onSelectVariation,     // (id: number) => void
  onGenerateMore,        // () => void — fires both "Generate 3 more" and "All different →"
})
```

All props flow through `imageBuilderProps` bundle from `useImageBuilder`.

### Visual spec

width: 320px, flex-shrink: 0
border-left: 0.5px solid rgba(255,255,255,0.06)
background: rgba(10,10,15,1)
display: flex, flex-direction: column

Panel header:
  padding: 12px 16px 10px
  border-bottom: 0.5px solid rgba(255,255,255,0.05)
  Left: "{count} variations · tap to select" (9px uppercase, rgba(255,255,255,0.25))
         where count = variations.length
  Right: "All different →" link — clicking calls `onGenerateMore()`
         (same behavior as "Generate 3 more" button)

Variation items (flex: 1, overflow-y: auto):
Each variation:
  padding: 11px 16px
  border-bottom: 0.5px solid rgba(255,255,255,0.04)
  cursor: pointer

  Variation number label:
    font-size: 9px, font-weight: 700, letter-spacing: .06em
    text-transform: uppercase
    color: rgba(139,92,246,0.5)
    Shows "Variation N" or "Variation N · selected"

  Prompt preview text:
    font-size: 11.5px
    color: rgba(255,255,255,0.55)
    line-height: 1.55
    Shows first 120 characters of the prompt + "..."
    Full text visible on selection (no truncation)

  Focus line:
    font-size: 9.5px
    color: rgba(255,255,255,0.28)
    margin-top: 3px
    Shows variation.focus

Selected variation style:
  background: rgba(139,92,246,0.07)
  border-left: 2px solid rgba(139,92,246,0.5)
  padding-left: 14px (compensate for border)
  Prompt text shows in full (not truncated)

Loading state (isLoading = true):
  Show 3 skeleton items with skeleton-pulse animation
  Each skeleton: 60px grey bar + 30px grey bar, opacity 0.08
  Label in header: "Generating variations…"

Generate more button (always visible, below variation list):
  padding: 10px 14px
  border-top: 0.5px solid rgba(255,255,255,0.05)
  Button: "+ Generate 3 more variations"
    width: 100%, height: 34px
    background: rgba(139,92,246,0.08)
    border: 0.5px solid rgba(139,92,246,0.2)
    border-radius: 8px, font-size: 12px
    color: rgba(196,168,255,0.7)
    Disabled (opacity 0.4, pointer-events none) while isLoading=true
    Shows "Generating…" text while isLoading=true

---

## PHASE 2 — Assembly (updated)

When user confirms, Claude assembles the final prompt using:
- All confirmed tab parameters (imageAnswers)
- The SELECTED variation as the base narrative
- Technical params appended as Nano Banana flags

If no variation is selected (imageVariations empty — should not happen
in practice, but guard for it): use the original transcript as the
narrative base in place of `selectedVariation.prompt`.

Uses `window.electronAPI.generateRaw(systemPrompt)` — no new IPC.

System prompt:
```
You are an expert Nano Banana prompt engineer. Assemble a final
optimised prompt from these confirmed parameters and selected variation.

Selected variation base: {selectedVariation.prompt}
Confirmed parameters: {JSON.stringify(imageAnswers, null, 2)}

Rules:
1. Use the selected variation as the narrative foundation
2. Weave in all confirmed parameters naturally
3. Word order matters: subject → setting → mood → lighting →
   camera/technical → style reference
4. Keep the assembled prompt 60–100 words
5. Do NOT include --parameter flags in the prompt text
6. Append technical flags as a separate "flags" field
7. Return ONLY valid JSON — no markdown fences:
{
  "prompt": "the assembled natural language prompt",
  "flags": "--ar 4:5 --stylize 750 --chaos 20"
}

flags format rules:
- --ar from aspectRatio (e.g. "4:5 portrait" → "--ar 4:5")
- --stylize from stylise value
- --chaos from chaos value (omit if 0)
- --weird from weird value (omit if 0)
- --seed from seed value (omit if null)
```

Parse with `parseImageAssemblyOutput(raw)` (new function in
`src/renderer/utils/promptUtils.js`, same fence-stripping pattern
as `parseEmailOutput`).

Add tests to `tests/utils.test.js`:
  - parseImageAssemblyOutput: fenced JSON → { prompt, flags }
  - parseImageAssemblyOutput: raw JSON (no fences) → { prompt, flags }
  - parseImageAssemblyOutput: malformed → returns null

Output shown to user: `prompt + '\n\n' + flags`
Copy button copies: `prompt + '\n\n' + flags`

---

## State additions in App.jsx (via useImageBuilder hook)

imageVariations: array — variation objects from phase 1.5
selectedVariation: number — ID of selected variation (default 1)
isGeneratingVariations: boolean — true while variation call running
activePreset: string | null — name of active preset or null

Note: `activeTab` (tab index string) lives as local state inside
`ImageBuilderState.jsx` — it does not need to be hoisted to App.jsx or
useImageBuilder because tab selection doesn't survive reiterate cycles.

Handlers (all owned by `useImageBuilder`, exposed via `imageBuilderProps`):
handleSelectVariation(id) — set selectedVariation
handleGenerateMoreVariations() — fire new generateRaw variation call, append results
handleApplyPreset(presetName) — apply preset params to imageAnswers across all tabs, set activePreset
handleSetNegative(text) — append text to imageAnswers.subject.negativePrompts
handleRemoveNegative(text) — filter text out of negativePrompts array
handleSetSeed(value) — set imageAnswers.technical.seed

### imageBuilderProps bundle (complete)
All fields passed from useImageBuilder → App.jsx → ExpandedView →
ExpandedDetailPanel → ImageBuilderState:

```js
const imageBuilderProps = {
  transcript,            // string
  imageDefaults,         // nested object { subject, lighting, camera, style, technical }
  imageAnswers,          // nested object — same shape as imageDefaults
  activePreset,          // string | null
  imageVariations,       // array of { id, prompt, focus }
  selectedVariation,     // number
  isGeneratingVariations,// boolean
  imageBuiltPrompt,      // string — assembled output (phase 2)
  onParamChange,         // (tab, field, value) => void
  onApplyPreset,         // (presetName) => void
  onSelectVariation,     // (id) => void
  onGenerateMore,        // () => void
  onSetSeed,             // (value) => void
  onSetNegative,         // (text) => void
  onRemoveNegative,      // (text) => void
  onConfirm,             // () => void
  onReiterate,           // () => void (starts new recording)
  onStartOver,           // () => void
}
```

---

## Acceptance criteria

- [ ] Category tabs render: Subject, Lighting, Camera, Style, Technical
- [ ] Clicking tab switches parameter set (local state in ImageBuilderState)
- [ ] AI pre-filled chips show purple dot prefix
- [ ] Clicking non-AI chip selects it (replaces current value)
- [ ] Clicking AI chip deselects it and adds to removedByUser for that field
- [ ] Subject tab: all 5 param rows render correctly (incl. Negative)
- [ ] Lighting tab: all 4 param rows render correctly
- [ ] Camera tab: all 5 param rows render correctly
- [ ] Style tab: all 4 param rows render correctly
- [ ] Technical tab: Stylise, Chaos, Weird, Seed all render
- [ ] Seed chip opens inline number input; entered value shown as chip
- [ ] Negative "+ add exclusions" opens inline text input; added items render as chips with ✕
- [ ] Multiple negative exclusions can be added
- [ ] Presets organised by 5 category rows (Photography/Cinematic/Art/Commercial/Mood)
- [ ] Default view shows Photography + Cinematic rows only
- [ ] "Show all 48 →" expands all 5 rows (48 presets total)
- [ ] Clicking preset applies params across all tabs, sets activePreset
- [ ] "Preset active: [Name]" shown in header when preset active
- [ ] Variations panel renders on right side (320px)
- [ ] 3 variations shown with number label, preview text, focus line
- [ ] Selected variation highlighted with purple left border
- [ ] Clicking variation selects it, shows full prompt text
- [ ] Variations generate in background during review screen load
- [ ] Skeleton shown (3 placeholder rows) while variations loading
- [ ] "Generate 3 more" appends 3 new variations, increments IDs
- [ ] "All different →" header link also triggers variation regeneration
- [ ] "Generate 3 more" button disabled + shows "Generating…" while loading
- [ ] Confirm button disabled while isGeneratingVariations is true
- [ ] Confirm button disabled if any required param is empty
- [ ] Phase 2 uses selected variation as narrative base
- [ ] Phase 2 response fence-stripped before JSON.parse
- [ ] Output shows prompt + blank line + flags
- [ ] Copy button copies prompt + newline + flags
- [ ] Reiterate re-runs phase 1, re-generates variations, merges answers
- [ ] Reiterate merge preserves user-confirmed params, updates AI-filled params
- [ ] activePreset cleared on Reiterate
- [ ] No minimized bar state — always expanded
- [ ] Layout: Zone A scrollable, Zone B fixed 320px

## Files in scope
- src/renderer/components/ImageBuilderState.jsx — full rebuild
- src/renderer/components/ImageBuilderDoneState.jsx — flags display update
- src/renderer/components/VariationsPanel.jsx — new component
- src/renderer/App.jsx — new state vars + handlers from hook
- src/renderer/hooks/useImageBuilder.js — full rewrite (new schema + variations)
- src/renderer/utils/promptUtils.js — parseImageAnalysisOutput + parseImageAssemblyOutput
- tests/utils.test.js — tests for both new parse utilities
- main.js — updated phase 1 system prompt (generate-raw passthrough only,
             no new IPC handlers; phase 1.5 variation call is renderer-side
             via generate-raw)
- vibe/CODEBASE.md, vibe/DECISIONS.md, vibe/TASKS.md

## Files out of scope
All other components, all other modes, preload.js, index.css
(No new IPC channels — all Claude calls use the existing generate-raw channel)
