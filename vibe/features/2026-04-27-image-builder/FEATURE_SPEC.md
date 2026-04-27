# FEATURE-IMAGE-BUILDER — Nano Banana Image Prompt Builder

## Problem
Users who want to generate images with Nano Banana or ChatGPT image gen
speak a rough idea but don't know all the parameters they can include.
The result is vague prompts that produce generic images. There is no
guided way to build a complete, optimised image generation prompt.

## Solution
A new mode called "Image" that replaces the standard prompt generation
flow with a smart-defaults review screen. After the user speaks their idea,
Claude analyses the transcript and pre-fills all image parameters. The user
reviews the AI suggestions at a glance, taps to adjust any chips, then
confirms. The final output is a natural language image generation prompt
optimised for Nano Banana, Nano Banana 2, Nano Banana Pro, and ChatGPT
image gen.

## Output format
Natural language — not structured sections. The assembled prompt reads
as a single flowing description that image generation models understand:

"Photorealistic portrait of a 30-year-old woman with curly auburn hair,
at golden hour near the ocean. Close-up shot, 9:16 portrait format.
Warm golden colour palette, serene mood. Shot on 85mm lens with soft
bokeh. Slight smile, freckles visible. No text."

---

## New IMAGE_BUILDER flow

STEP 1 — User records (unchanged)
STEP 2 — THINKING state: Whisper transcribes + Claude analyses transcript
  Label: "Analysing your idea..."
  Claude returns a JSON object of pre-selected parameters (see below)
STEP 3 — IMAGE_BUILDER state: shows all-params review screen
  All parameters pre-filled by Claude
  User scans, taps to change, adds more, hits "Confirm & generate →"
STEP 4 — THINKING state: Claude assembles final prompt
  Label: "Assembling prompt..."
STEP 5 — IMAGE_BUILDER_DONE: final prompt ready to copy

---

## STEP 2 — Claude pre-selection call

After transcription, call `window.electronAPI.generateRaw(systemPrompt, transcript)`
(uses the existing `generate-raw` IPC channel). Parse the returned
`{ success, prompt }` — `prompt` is the raw JSON string; JSON.parse it to
get imageDefaults. Use this system prompt:

"You are an expert image prompt engineer for Nano Banana (Google Gemini
image generation). Analyse the user's spoken idea and return a JSON
object with pre-selected values for each parameter.

User's spoken idea: {transcript}

Return ONLY valid JSON, no preamble, no explanation, no markdown:
{
  "model": "Nano Banana 2",
  "useCase": "Photorealistic scene",
  "style": ["Photorealistic"],
  "lighting": ["Golden hour"],
  "aspectRatio": "Portrait 9:16",
  "subjectDetail": [],
  "composition": ["Close-up portrait"],
  "cameraAngle": ["Eye level"],
  "colourPalette": ["Warm & golden"],
  "background": ["Natural / contextual"],
  "mood": ["Serene"],
  "resolution": "Standard quality",
  "lens": [],
  "textInImage": "No text needed",
  "detailLevel": "",
  "avoid": [],
  "surfaceMaterial": [],
  "postProcessing": []
}

Rules:
- Only pre-select values you are confident about from the transcript
- Arrays can have multiple values if clearly implied
- Leave arrays empty [] if not mentioned or unclear
- Leave strings empty '' if not mentioned or unclear
- model default: Nano Banana 2
- useCase: infer from context
- Respond ONLY with the JSON object"

Store the response as imageDefaults in App.jsx state.
imageAnswers starts as a deep copy of imageDefaults.
This call happens during the first THINKING state.

---

## IMAGE_BUILDER review screen layout

### Header
Left: image icon + "Nano Banana builder"
Right: sparkle icon + "Claude filled these for you" label
  (sparkle SVG: star/asterisk shape, rgba(139,92,246,0.6))

### You said section
"YOU SAID" label + transcript text (italic, rgba(255,255,255,0.4))

### Divider

### Params grid — each row:
format: [LABEL] [chips] [+ add chip]

LABEL: font-size 9px, font-weight 700, text-transform uppercase,
  letter-spacing 0.08em, color rgba(255,255,255,0.22),
  min-width 80px, flex-shrink 0

Each param row shows:
  - AI pre-selected chips (purple dot indicator)
  - Dashed "+ add" chip at end of each row (opens option picker)
  - Tap any chip to deselect/remove it
  - Tap "+ add" to see full options list for that param

### Chip states (three visual states):
1. AI pre-selected chip:
   background rgba(139,92,246,0.14)
   border 0.5px solid rgba(139,92,246,0.38)
   color rgba(167,139,250,0.95), font-weight 500
   Left: 5px purple dot (the AI indicator)
   font-size 11px, padding 4px 10px, border-radius 8px

2. User-added chip (tapped + add):
   background rgba(139,92,246,0.22)
   border 0.5px solid rgba(139,92,246,0.55)
   color rgba(200,180,255,1), font-weight 600
   No dot — user chose this manually

3. Deselected chip (was AI selected, user tapped to remove):
   Do not show — remove from display entirely when tapped
   (simplest UX — if user taps a chip it disappears, can re-add via + add)

### + add chip style:
   border 0.5px dashed rgba(255,255,255,0.15)
   background transparent
   color rgba(255,255,255,0.25)
   font-size 11px, padding 4px 10px, border-radius 8px
   text: "+ add"
   onClick: shows inline option picker for that param

### Param rows to show by default (essential + important):
Row 1:  Model          — single select chip
Row 2:  Use case       — single select chip
Row 3:  Subject detail — multi-select chips + add
Row 4:  Style          — multi-select chips + add
Row 5:  Lighting       — multi-select chips + add
Row 6:  Composition    — multi-select chips + add
Row 7:  Camera angle   — multi-select chips + add
Row 8:  Ratio          — single select chip
Row 9:  Colour         — multi-select chips + add
Row 10: Background     — multi-select chips + add
Row 11: Mood           — multi-select chips + add

### Advanced params section (collapsed by default):
Show a "+ Show advanced parameters" link below row 11:
  font-size 10.5px, color rgba(139,92,246,0.5), cursor pointer
  Clicking expands rows 12–18:
Row 12: Resolution   — single select chip
Row 13: Lens         — multi-select chips + add
Row 14: Text         — single select chip
Row 15: Detail level — single select chip
Row 16: Avoid        — multi-select chips + add
Row 17: Surface      — multi-select chips + add
Row 18: Post-process — multi-select chips + add

When expanded, link changes to "− Hide advanced parameters"

### Option picker (when + add is tapped):
Show a small inline dropdown below the row:
  background #1a1a24, border 0.5px solid rgba(255,255,255,0.1)
  border-radius 10px, padding 8px, max-height 160px, overflow-y auto
  Options listed as small chips in a flex-wrap grid
  Tapping an option adds it to the row and closes the picker
  Tapping outside closes the picker without adding

### Single-select vs multi-select picker behavior:
Multi-select rows (Style, Lighting, Composition, Camera angle, Colour,
  Background, Mood, Lens, Avoid, Surface, Post-process, Subject detail):
  Tapping an option in the picker adds it alongside any existing chips.
  Multiple chips can be active at the same time.

Single-select rows (Model, Use case, Ratio, Resolution, Text, Detail level):
  Tapping "+ add" opens the picker showing all options except the currently
  selected value. Selecting an option replaces the existing chip entirely.
  Only one chip can be active at a time.
  The picker does not show the currently active value as an option.

### Footer area
Left: "↺ Reiterate" link
Right: "Copy now →" link + "Confirm & generate →" button
  Confirm button: rgba(139,92,246,0.75) bg, white, font-weight 600
  height 32px, padding 0 18px, border-radius 8px

---

## Parameter option lists (unchanged from original spec)

### Model options (single-select)
Nano Banana (fast, efficient — good for quick iterations)
Nano Banana 2 (speed + quality — recommended for most use cases)
Nano Banana Pro (highest quality, best text rendering, uses Thinking)

Note: Model selection affects prompt wording. For Nano Banana Pro,
Claude should add "high fidelity" and "precise text rendering" language.
For Nano Banana 2, standard prompt language. Stored in imageAnswers.model.

### Use case options (single-select)
Photorealistic scene (real-world photo style)
Stylized illustration / sticker (graphic, flat, artistic)
Style transfer (apply a style to existing content)
Product mockup / commercial (professional asset)
Icon / UI asset (clean, minimal, specific background)
Infographic / text layout (text + visuals combined)
3D render / isometric (three-dimensional or geometric)

Note: Use case shapes the opening of the assembled prompt.
Product mockup → "Professional product shot of..."
Photorealistic → "A photo of..."
3D render/isometric → "A perfectly isometric 3D scene of..."
Stylized illustration → "A stylized illustration of..."
Icon/UI asset → "An icon of..."
Infographic → "An infographic showing..."
Stored in imageAnswers.useCase.

### Style options (multi-select)
Photorealistic, Illustration, Oil painting, Film photography,
3D render, Cinematic, Watercolour, Anime / manga, Isometric, Claymation

### Lighting options (multi-select)
Golden hour, Studio softbox, Natural overcast, Dramatic side light,
Neon / artificial, Backlit silhouette, Blue hour / dusk, Candlelight

### Aspect ratio options (single-select)
Square 1:1, Portrait 9:16, Landscape 16:9, Widescreen 21:9,
4:3 classic, 3:2 photo

### Subject detail options (multi-select)
Add age / appearance, Add expression, Add clothing,
Add skin / texture detail, Keep as spoken

### Composition options (multi-select)
Close-up portrait, Medium shot, Wide establishing, Rule of thirds,
Symmetrical, Aerial / overhead, Macro / extreme close

### Camera angle options (multi-select)
Eye level, Low angle, High angle, Dutch tilt, Bird's eye, Worm's eye

### Colour palette options (multi-select)
Warm & golden, Cool & blue, Muted & desaturated, Vivid & saturated,
Monochrome, Pastel, High contrast

### Background options (multi-select)
Natural / contextual (let model decide)
White background (clean, product-style)
Transparent / no background (for assets)
Solid colour (specify colour in prompt)
Gradient (top to bottom or radial)
Blurred / bokeh background
Black background
Custom / describe it

Custom input: selecting "Custom / describe it" reveals an inline text
field directly below the chip row. User types a free-form background
description; pressing Enter or clicking elsewhere confirms it. The chip
shows the first 20 characters of the typed text (truncated with "…"
if longer). Leaving the field empty is treated as no value recorded.

### Mood options (multi-select)
Serene, Dramatic, Nostalgic, Mysterious, Energetic, Melancholic,
Futuristic, Dreamlike

### Resolution options (single-select)
Standard quality (no resolution keywords added)
High detail (adds 'highly detailed' to prompt)
Ultra detailed / 4K (adds 'ultra detailed, 4K resolution' to prompt)
Hyperreal / 8K (adds 'hyperrealistic, 8K, ultra sharp' to prompt)
Professional print quality (adds 'print-ready, high resolution' to prompt)

Note: These are prompt keywords, not API parameters. Nano Banana has no
resolution API parameter — resolution is influenced by prompt language and
model choice. If resolution was specified, weave keywords into prompt
naturally.

### Lens options (multi-select)
35mm film, 50mm portrait, 85mm bokeh, Wide angle, Macro,
Anamorphic, Fisheye

### Text in image options (single-select)
No text needed, Yes — title/headline, Yes — label/caption,
Yes — logo/wordmark, Yes — signage

### Detail level options (single-select)
Minimal / clean, Moderate detail, Highly detailed, Ultra detailed / hyperreal

### Avoid options (multi-select)
No text, No people, No shadows, No background, Keep minimal, Custom (type it)

Custom input: same pattern as Background custom — "Custom (type it)"
reveals an inline text field below the chip row; Enter confirms;
empty field = no value recorded.

### Surface / material options (multi-select)
Matte, Glossy, Metallic, Fabric / textile, Natural / organic, Glass

### Post-processing options (multi-select)
Film grain, Vintage / faded, HDR, Matte grade, Clean / neutral,
Tilt-shift

---

## Reiterate from review screen
Same behaviour as before — re-records without losing any params.
After new transcription, Claude re-runs the pre-selection call
and MERGES with existing user selections:
  - User-manually-added chips are preserved
  - AI pre-selected chips are refreshed from new imageDefaults
  - Any chip the user had deselected stays deselected

Merge logic (uses removedByUser state):
  For each param in new imageDefaults:
    - Filter new imageDefaults[param] to exclude any value in removedByUser[param]
    - Replace AI chips in imageAnswers with the filtered new values
    - User-added chips (values not in any imageDefaults) are preserved as-is
  removedByUser is NOT reset on reiterate — persists across re-transcriptions
    so that a value the user removed stays gone until Start over.

---

## Confirm & generate flow
When user taps "Confirm & generate →":
  1. Collect all selected params from imageAnswers state
  2. Transition to THINKING state (label: "Assembling prompt...")
  3. Call `window.electronAPI.generateRaw(systemPrompt, JSON.stringify(imageAnswers))`
     using the prompt assembly system prompt below
  4. Transition to IMAGE_BUILDER_DONE with assembled prompt

---

## Prompt assembly logic
Claude assembles the final natural language prompt by combining:
1. The original transcript (what the user spoke)
2. All selected parameters from imageAnswers

System prompt for Claude generation:
"You are an expert image prompt engineer for Nano Banana (Google Gemini
image generation) and ChatGPT image generation. The user has spoken a
rough image idea and selected parameters through a guided review.

Assemble these into a single, flowing natural language image generation
prompt. Do NOT use section headers or structured formatting. Write it
as one or two paragraphs of vivid, specific description that image
generation models respond to.

The user has selected the following model: {imageAnswers.model}
The use case is: {imageAnswers.useCase}

Start the prompt appropriately for the use case:
- Photorealistic scene: start with 'A photo of...'
- Product mockup / commercial: start with 'Professional product shot of...'
- 3D render / isometric: start with 'A perfectly isometric 3D scene of...'
- Stylized illustration / sticker: start with 'A stylized illustration of...'
- Icon / UI asset: start with 'An icon of...'
- Infographic / text layout: start with 'An infographic showing...'
- Style transfer: start with 'Apply [style] to...'
If no use case was selected, infer a natural opening from the transcript.

If Nano Banana Pro was selected, add 'high fidelity' and 'precise text
rendering' to the prompt. If a resolution level was specified, weave
those keywords into the prompt naturally rather than appending them.

User's spoken idea: {transcript}
Selected parameters: {parameters as JSON}

Rules:
1. Weave the parameters naturally into the description
2. Be specific and vivid — avoid vague adjectives
3. Put the most important visual elements first
4. Include the aspect ratio as a natural phrase
5. If text was specified, include it in quotes
6. End with any negative specifications (what to avoid)
7. Maximum 60 words — concise but complete
8. Output ONLY the prompt — no preamble, no explanation"

---

## Final output screen (IMAGE_BUILDER_DONE — unchanged)

### Compact bar layout
Header: green dot + "Image prompt ready"
Divider
"Assembled prompt" label + prompt text in a code-style box
  background rgba(255,255,255,0.03), border rgba(255,255,255,0.07)
  border-radius 10px, padding 11px 13px
  font-size 12.5px, rgba(255,255,255,0.65), line-height 1.7
Param summary: flex-wrap row of amber answered chips
Actions: Edit answers + Start over + Copy prompt (purple primary)

### Expanded view layout
Right panel two-column grid (1fr 1fr):
  Left column:
    "Assembled prompt" label + large prompt text box (font-size 14px)
    "Optimised for" label + dynamic model chip based on imageAnswers.model:
      If Nano Banana selected: show "Nano Banana (gemini-2.5-flash-image)"
      If Nano Banana 2 selected: show "Nano Banana 2 (gemini-3.1-flash-image-preview)"
      If Nano Banana Pro selected: show "Nano Banana Pro (gemini-3-pro-image-preview)"
      Always show: ChatGPT image gen
  Right column:
    "Parameters applied" label
    Each param as a row: purple label (min-width 80px) + value (13px)
Action row: Start over + spacer + Copy prompt (purple primary)
  Note: "Edit answers" is omitted from the expanded done screen intentionally —
  in expanded view the user can tap "Start over" to re-enter the flow with
  the full review screen. The compact view retains "Edit answers" because
  the compact review screen is harder to navigate.

---

## Mode identity
Mode name: 'image'
Mode label: 'Image'
Mode accent: rgba(139,92,246) — purple (distinct from all existing modes)
Mode icon: image SVG (rectangle with mountain and circle)
Mode dot colour: rgba(139,92,246,0.9) in idle bar
Mode subtitle in idle: "Speak your image idea"

---

## State machine for image builder

RECORDING → THINKING (Whisper transcription + Claude pre-selection)
  → IMAGE_BUILDER (review screen)
  → THINKING (Claude assembly)
  → IMAGE_BUILDER_DONE

### App.jsx state additions
Replace: currentTier, currentQuestion (no longer needed)
Add:
  imageDefaults: object — Claude's pre-selected values from STEP 2
  imageAnswers: object — current user selections (starts as deep copy
    of imageDefaults, modified by user interactions)
  removedByUser: object — maps param name → Set<string> of values the
    user explicitly removed by tapping a chip. handleChipRemove(param, value)
    adds the value to removedByUser[param]. Reset to {} on Start over.
    Used by merge logic on reiterate to avoid re-adding removed values.
  showAdvanced: boolean — controls advanced params visibility (default: false)
  activePickerParam: string | null — which param has open option picker

### State heights
STATE_HEIGHTS.IMAGE_BUILDER = 520 (scrollable)
STATE_HEIGHTS.IMAGE_BUILDER_DONE = 380

### ThinkingState labels
Add `thinkingLabel` to App.jsx state: `const [thinkingLabel, setThinkingLabel] = useState('')`

Set it immediately before calling `transition('THINKING', ...)`:
  Phase 1 (pre-selection): `setThinkingLabel('Analysing your idea...')`
  Phase 2 (assembly):      `setThinkingLabel('Assembling prompt...')`

Pass as `<ThinkingState label={thinkingLabel} />`. ThinkingState renders
`label` if non-empty; otherwise falls back to its existing default text.
This means non-image modes are unaffected — no mode-check needed in ThinkingState.
No new loading component — reuse ThinkingState entirely.

### Expand toggle
The expand toggle is active during IMAGE_BUILDER. imageDefaults,
imageAnswers, showAdvanced, and activePickerParam are React useState
in App.jsx — they survive the compact→expanded transition because they
are owned by App.jsx, not by ImageBuilderState. Expanding mid-review
does NOT reset state. In expanded view, the right panel shows the same
all-params review screen.

### History entry shape
{ prompt: assembledPrompt, transcript: originalTranscript, mode: 'image',
  imageAnswers: { model, useCase, style, lighting, aspectRatio,
  subjectDetail, composition, cameraAngle, colourPalette, background,
  mood, resolution, lens, textInImage, detailLevel, avoid,
  surfaceMaterial, postProcessing },
  timestamp: Date.now() }
imageAnswers is saved to history so that "Parameters applied" can be
displayed when viewing the entry in the history panel.

### Sub-state pattern note
imageDefaults, imageAnswers, showAdvanced, activePickerParam are
implemented as React useState alongside the main currentState in
App.jsx — NOT as nested states within the state machine enum.
Log in DECISIONS.md: "image builder all-params review approach uses
parallel React state (imageDefaults, imageAnswers) alongside STATES enum
rather than 17 discrete question states; smart defaults from Claude
reduce user interaction to a single review screen."

### Error handling
If the pre-selection Claude call fails → use empty imageDefaults (all
empty arrays / empty strings / default model 'Nano Banana 2') and
transition to IMAGE_BUILDER anyway — user can add all params manually.
If the assembly Claude call fails → ERROR state with message:
"Could not generate image prompt — try again"

---

## Acceptance criteria
- [ ] Image mode appears in right-click mode menu
- [ ] Idle bar shows purple dot + "Speak your image idea" subtitle
- [ ] After recording, first THINKING state shows "Analysing your idea..."
- [ ] IMAGE_BUILDER state shows all-params review screen with Claude pre-fills
- [ ] Header shows sparkle icon + "Claude filled these for you" label
- [ ] AI pre-selected chips have purple dot indicator
- [ ] Tapping a chip removes it from the row (deselect = remove)
- [ ] Tapping "+ add" opens inline option picker for that param
- [ ] Selecting from picker adds chip as user-added (no dot, brighter style)
- [ ] Tapping outside picker closes it without adding
- [ ] Advanced params section collapsed by default; toggle shows/hides rows 11–17
- [ ] "Confirm & generate →" → second THINKING state shows "Assembling prompt..."
- [ ] "Copy now →" at review screen → THINKING → IMAGE_BUILDER_DONE
- [ ] Reiterate re-records; new pre-selection merges with user selections
  (user-added chips preserved, AI chips refreshed, removed chips stay removed)
- [ ] If pre-selection call fails, review screen opens with empty defaults
- [ ] Assembled prompt contains no section headers — reads as natural language
- [ ] Assembled prompt opening phrase matches the selected use case
- [ ] When Nano Banana Pro is selected, system prompt includes "high fidelity"
  and "precise text rendering" instructions
- [ ] When a resolution level is selected, system prompt includes the
  corresponding resolution keyword instructions
- [ ] Final screen shows prompt preview + param summary
- [ ] "Optimised for" chip shows the selected model with its API model ID
- [ ] History entry is saved with mode: 'image' and imageAnswers object
- [ ] ARCHITECTURE.md state list updated (count: 13, includes IMAGE_BUILDER
  and IMAGE_BUILDER_DONE)
- [ ] ARCHITECTURE.md Prompt modes table includes 'image' mode entry
- [ ] DECISIONS.md includes entry for IMAGE_BUILDER smart-defaults pattern
- [ ] If assembly fails → ERROR state with "Could not generate image prompt
  — try again"

---

## Files in scope
- src/renderer/components/ImageBuilderState.jsx (new — all-params review screen)
- src/renderer/components/ImageBuilderDoneState.jsx (new — final output)
- src/renderer/App.jsx (new states, two-phase THINKING, chip handlers)
- src/renderer/hooks/useMode.js (add image mode)
- src/renderer/utils/history.js (read only — call existing saveToHistory())
- main.js (add image to MODE_CONFIG and show-mode-menu)
- vibe/ARCHITECTURE.md (update state list count to 13 and Prompt modes table)
- vibe/CODEBASE.md, vibe/DECISIONS.md, vibe/TASKS.md

## Files out of scope
All other components, all hooks except useMode, preload.js, index.css
