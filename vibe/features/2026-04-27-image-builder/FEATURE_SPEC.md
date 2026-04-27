# FEATURE-IMAGE-BUILDER — Nano Banana Image Prompt Builder

## Problem
Users who want to generate images with Nano Banana or ChatGPT image gen
speak a rough idea but don't know all the parameters they can include.
The result is vague prompts that produce generic images. There is no
guided way to build a complete, optimised image generation prompt.

## Solution
A new mode called "Image" that replaces the standard prompt generation
flow with a guided interview. After the user speaks their idea, instead
of generating a structured Claude prompt, Promptly asks a series of
tappable questions that help the user specify key image parameters.
The final output is a natural language image generation prompt
optimised for Nano Banana, Nano Banana 2, Nano Banana Pro, and
ChatGPT image gen. Model selection is part of the interview and shapes
how the final prompt is worded.

## Output format
Natural language — not structured sections. The assembled prompt reads
as a single flowing description that image generation models understand:

"Photorealistic portrait of a 30-year-old woman with curly auburn hair,
at golden hour near the ocean. Close-up shot, 9:16 portrait format.
Warm golden colour palette, serene mood. Shot on 85mm lens with soft
bokeh. Slight smile, freckles visible. No text."

## Three-tier question system

### Tier 1 — Essential (6 questions, always asked)
Badge: "Essential · N/6" in purple

1. Model — which Nano Banana model
   Label: "Which model are you using?"
   Hint: "Different models have different strengths — match to your use case"
   Options: Nano Banana (fast, efficient — good for quick iterations),
   Nano Banana 2 (speed + quality — recommended for most use cases),
   Nano Banana Pro (highest quality, best text rendering, uses Thinking)
   Note: Model selection affects prompt wording. For Nano Banana Pro,
   Claude should add "high fidelity" and "precise text rendering" language.
   For Nano Banana 2, standard prompt language. Stored in imageAnswers.model.

2. Use case — output type
   Label: "What are you creating?"
   Hint: "Sets the overall approach for the prompt"
   Options: Photorealistic scene (real-world photo style),
   Stylized illustration / sticker (graphic, flat, artistic),
   Style transfer (apply a style to existing content),
   Product mockup / commercial (professional asset),
   Icon / UI asset (clean, minimal, specific background),
   Infographic / text layout (text + visuals combined),
   3D render / isometric (three-dimensional or geometric)
   Note: Use case shapes the opening of the assembled prompt.
   Product mockup → "Professional product shot of..."
   Photorealistic → "A photo of..."
   3D render/isometric → "A perfectly isometric 3D scene of..."
   Stylized illustration → "A stylized illustration of..."
   Icon/UI asset → "An icon of..."
   Infographic → "An infographic showing..."
   Stored in imageAnswers.useCase.

3. Style — how the image is rendered
   Options: Photorealistic, Illustration, Oil painting, Film photography,
   3D render, Cinematic, Watercolour, Anime / manga, Isometric, Claymation

4. Lighting — sets the atmosphere
   Options: Golden hour, Studio softbox, Natural overcast, Dramatic side
   light, Neon / artificial, Backlit silhouette, Blue hour / dusk, Candlelight

5. Aspect ratio — output dimensions
   Options: Square 1:1, Portrait 9:16, Landscape 16:9, Widescreen 21:9,
   4:3 classic, 3:2 photo

6. Subject detail — enrich the subject description
   Options: Add age / appearance, Add expression, Add clothing,
   Add skin / texture detail, Keep as spoken

### Tier 2 — Important (4 questions, asked after tier 1)
Badge: "Important · N/4" in blue

1. Composition — framing and shot type
   Options: Close-up portrait, Medium shot, Wide establishing, Rule of
   thirds, Symmetrical, Aerial / overhead, Macro / extreme close

2. Colour palette — tonal mood
   Options: Warm & golden, Cool & blue, Muted & desaturated, Vivid &
   saturated, Monochrome, Pastel, High contrast

3. Background — what surrounds the subject
   Label: "What's the background?"
   Hint: "Explicitly specifying background improves consistency"
   Options: Natural / contextual (let model decide),
   White background (clean, product-style),
   Transparent / no background (for assets),
   Solid colour (specify colour in prompt),
   Gradient (top to bottom or radial),
   Blurred / bokeh background,
   Black background,
   Custom / describe it
   Custom input: selecting "Custom / describe it" reveals an inline text
   field directly below the chip row (replaces no other chips). User types
   a free-form background description; pressing Enter or clicking Next
   confirms it. The chip shows the first 20 characters of the typed text
   as the selected value (truncated with "…" if longer). Leaving the
   field empty and pressing Next is treated as Skip (no value recorded).

4. Mood / atmosphere — emotional quality
   Options: Serene, Dramatic, Nostalgic, Mysterious, Energetic, Melancholic,
   Futuristic, Dreamlike

### Tier 3 — Advanced (7 questions, clearly optional)
Badge: "Advanced · optional" in amber
Each question has a "Skip ↓" chip as the last option.

1. Resolution / quality level
   Label: "What quality level?"
   Hint: "Add resolution keywords — Nano Banana responds to these in the prompt"
   Options: Standard quality (no resolution keywords added),
   High detail (adds 'highly detailed' to prompt),
   Ultra detailed / 4K (adds 'ultra detailed, 4K resolution' to prompt),
   Hyperreal / 8K (adds 'hyperrealistic, 8K, ultra sharp' to prompt),
   Professional print quality (adds 'print-ready, high resolution' to prompt),
   Skip ↓
   Note: These are prompt keywords, not API parameters. Nano Banana has no
   resolution API parameter — resolution is influenced by prompt language and
   model choice. If resolution was specified, weave keywords into prompt naturally.

2. Camera / lens
   Options: 35mm film, 50mm portrait, 85mm bokeh, Wide angle, Macro,
   Anamorphic, Fisheye, Skip ↓

3. Text in image (unique Nano Banana capability)
   Badge: "Unique capability" purple pill on question label
   Options: No text needed, Yes — title/headline, Yes — label/caption,
   Yes — logo/wordmark, Yes — signage, Skip ↓

4. Detail specificity
   Options: Minimal / clean, Moderate detail, Highly detailed, Ultra
   detailed / hyperreal, Skip ↓

5. What to avoid (negative space)
   Options: No text, No people, No shadows, No background, Keep minimal,
   Custom (type it), Skip ↓
   Custom input: same pattern as T2 Q3 — "Custom (type it)" reveals an
   inline text field below the chip row; Enter confirms; empty + Next = Skip.

6. Surface / material
   Options: Matte, Glossy, Metallic, Fabric / textile, Natural / organic,
   Glass, Skip ↓

7. Post-processing style
   Options: Film grain, Vintage / faded, HDR, Matte grade, Clean / neutral,
   Tilt-shift, Skip ↓

## Question UI — both compact bar and expanded view

### Compact bar layout (per question)
Height: dynamic — calculated per question transition (see State machine section)
Header row:
  Left: mode icon (image SVG) + "Nano Banana builder" label
  Right: tier badge
You said section: italic transcript text at 12px rgba(255,255,255,0.4)
Divider
Question title: 13.5px font-weight 500 rgba(255,255,255,0.82)
Question hint: 11px rgba(255,255,255,0.28)
Options: flex-wrap row of chip buttons
  Default chip: padding 6px 12px, border-radius 9px, font-size 11.5px
    background rgba(255,255,255,0.04), border rgba(255,255,255,0.1)
    color rgba(255,255,255,0.55)
  Selected chip (purple):
    background rgba(139,92,246,0.14), border rgba(139,92,246,0.38)
    color rgba(167,139,250,0.95), font-weight 500
  Skip chip: border-style dashed, color rgba(255,255,255,0.25)
Answered params: flex-wrap row of small answered chips above divider
  Each: background rgba(139,92,246,0.07), border rgba(139,92,246,0.15)
  Label: 8.5px uppercase purple, Value: 10.5px rgba(255,255,255,0.5)
Footer row (Tier 1 Q1 — no Back):
  Left: "Copy now →" only
  Right: Next button (rgba(139,92,246,0.75) bg, white text)
Footer row (all other questions):
  Left: "← Back · Copy now →"
  Right: Next button (rgba(139,92,246,0.75) bg, white text)

### Expanded view layout (per question)
Three-zone layout: top bar dimmed + left history + right question panel
Top bar: opacity 0.4 on mic button and flanking controls (not recording)
Left panel: same width as existing ExpandedView.jsx (300px) — history as
  normal, active entry shows "Now · building"
Right panel: flex:1 — same width as existing ExpandedView.jsx right panel
  Header: icon + "Nano Banana builder" + tier badge + "Copy now →"
  You said section: transcript + answered params chips
  Question area (flex:1, padding 24px 28px):
    Question title: 18px font-weight 500 rgba(255,255,255,0.85)
    Question hint: 13px rgba(255,255,255,0.3)
    Options: 4-column grid, each chip padding 10px 8px, text-align center
    Progress bar (at bottom of question area, margin-top auto):
      Label: "{completedQuestions} of 17 · {percentage}% complete"
        font-size 11px, color rgba(255,255,255,0.2), margin-bottom 6px
      Bar container: full width, height 2px, border-radius 1px,
        background rgba(255,255,255,0.06), overflow hidden
      Bar fill: rgba(139,92,246,0.6), width = percentage%
      Denominator: always 17 (6 + 4 + 7) — skipped questions count as completed
      Percentage: Math.round((completedQuestions / 17) * 100)
  Action row (Tier 1 Q1 — no Back):
    Back button hidden, spacer collapses
    Layout: "or press ↵" hint + Next button (right-aligned)
  Action row (all other questions):
    Back button + spacer + "or press ↵" + Next button

### Tier transition UI
When tier 1 completes and tier 2 begins:
  Show a compact summary box above the divider:
    background rgba(139,92,246,0.04), border rgba(139,92,246,0.1)
    border-radius 9px, padding 8px 10px
    Header: "Essential ✓" in small purple uppercase
    Answered chips below in a flex-wrap row

When tier 2 completes and tier 3 begins:
  Show a second compact summary box above the divider (same visual style):
    Header: "Important ✓" in small blue uppercase
    Answered chips below in a flex-wrap row
  Both the "Essential ✓" and "Important ✓" boxes are stacked, with
  "Essential ✓" on top and "Important ✓" below it, separated by 6px.
  The answered params row above the divider shows only tier 3 answers
  (tiers 1+2 answers are captured in their summary boxes).

### Final output screen — compact bar
Header: green dot + "Image prompt ready"
Divider
"Assembled prompt" label + prompt text in a code-style box
  background rgba(255,255,255,0.03), border rgba(255,255,255,0.07)
  border-radius 10px, padding 11px 13px
  font-size 12.5px, rgba(255,255,255,0.65), line-height 1.7
Param summary: flex-wrap row of orange answered chips
Actions: Edit answers + Start over + Copy prompt (purple primary)

### Final output screen — expanded view
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
Action row: Save to history + spacer + Copy prompt (purple primary)

## Prompt assembly logic
Claude assembles the final natural language prompt by combining:
1. The original transcript (what the user spoke)
2. All selected parameters from tier 1, tier 2, and any answered tier 3

System prompt for Claude generation:
"You are an expert image prompt engineer for Nano Banana (Google Gemini
image generation) and ChatGPT image generation. The user has spoken a
rough image idea and selected parameters through a guided interview.

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

## Mode identity
Mode name: 'image'
Mode label: 'Image'
Mode accent: rgba(139,92,246) — purple (distinct from all existing modes)
Mode icon: image SVG (rectangle with mountain and circle)
Mode dot colour: rgba(139,92,246,0.9) in idle bar
Mode subtitle in idle: "Speak your image idea"

## State machine for image builder
The image builder introduces a new sub-state within the existing
PROMPT_READY flow. When mode === 'image':

RECORDING → THINKING (Whisper transcription) → IMAGE_BUILDER (questions)
  → THINKING (Claude assembly) → IMAGE_BUILDER_DONE

IMAGE_BUILDER state has internal question index tracking:
  currentTier: 1 | 2 | 3
  currentQuestion: number
  answers: object mapping parameter name to selected value
    imageAnswers.model — selected Nano Banana model
    imageAnswers.useCase — selected output type

IMAGE_BUILDER_DONE (final output, replaces PROMPT_READY display)

Expand toggle during IMAGE_BUILDER:
  The expand toggle is active during IMAGE_BUILDER. currentTier,
  currentQuestion, and imageAnswers are React useState / useRef in App.jsx.
  They survive the compact→expanded transition because they are owned by
  App.jsx, not by the ImageBuilderState component. ImageBuilderState
  receives them as props in both compact and expanded render paths.
  Expanding mid-interview does NOT reset the question flow.

"Copy now →" (at any question) and Next after the final question both
call Claude via the `generate-raw` IPC channel with the image assembly
system prompt, and show a THINKING transition before IMAGE_BUILDER_DONE.
No direct parameter concatenation — Claude always assembles the prompt.

When user taps "Copy now →" or completes all questions, transition to the
standard THINKING state. In ThinkingState (or App.jsx), check
mode === 'image' to display "Assembling prompt..." instead of the default
"Generating prompt..." label. No new loading component — reuse ThinkingState
entirely. After Claude responds, transition to IMAGE_BUILDER_DONE.

All state names map to existing STATES where possible.
Add STATES.IMAGE_BUILDER and STATES.IMAGE_BUILDER_DONE if needed.
Use STATE_HEIGHTS.IMAGE_BUILDER_DONE = 380

History entry shape:
  { prompt: assembledPrompt, transcript: originalTranscript, mode: 'image',
    imageAnswers: { model, useCase, style, lighting, aspectRatio,
    subjectDetail, composition, colourPalette, background, mood,
    resolution, camera, text, detail, avoid, surface, postProcessing },
    timestamp: Date.now() }
  imageAnswers is saved to history so that "Parameters applied" can be
  displayed when viewing the entry in the history panel.

Sub-state pattern note:
  The IMAGE_BUILDER sub-state (currentTier, currentQuestion, imageAnswers)
  is implemented as React useState / useRef alongside the main currentState
  in App.jsx — NOT as nested states within the state machine enum. This is
  a new pattern; log in DECISIONS.md with rationale: "image builder requires
  internal step tracking within a single STATES.IMAGE_BUILDER state; using
  a nested object in React state avoids 17 discrete state machine states."

Dynamic height for IMAGE_BUILDER (call resizeWindow on every question transition):
  Base heights: Tier 1 = 380px, Tier 2 = 420px (has summary box), Tier 3 = 400px
  For each additional chip row beyond the first, add 28px
    (chips wrap at ~3 per row given 520px bar width)
  Maximum height: 520px — content scrolls beyond that
  Calculation in App.jsx:
    const answeredRows = Math.ceil(Object.keys(imageAnswers).length / 3)
    const dynamicHeight = baseHeight + Math.max(0, answeredRows - 1) * 28
    resizeWindow(Math.min(dynamicHeight, 520))

## Navigation rules
- Copy now → calls Claude via generate-raw → THINKING → IMAGE_BUILDER_DONE
  "Copy now →" is available from Q1 onward. If imageAnswers has no entries
  (user triggers it immediately on Q1 before selecting anything), the model
  and useCase lines are omitted from the system prompt and Claude assembles
  a prompt from the transcript alone. "Copy now →" is never disabled.
- Skip ↓ on advanced questions → moves to next question, no value recorded
- Back → goes to previous question; Back from Tier 2 Q1 returns to Tier 1 Q6;
  Back from Tier 3 Q1 returns to Tier 2 Q4 — cross-tier back navigation
  is supported. The tier summary boxes update to reflect any changed answers.
- Tier 1 Q1 (first question): no Back — compact footer shows "Copy now →" only;
  expanded action row hides Back button entirely, spacer collapses
- Start over → resets all answers, returns to transcript display, re-asks Q1
- Edit answers → returns to tier 1 Q1 with existing answers pre-selected
- ↵ / Next with selection → advances to next question
- ↵ / Next without selection → treated as Skip for tier 3, blocked for
  tier 1+2 (Next button remains disabled, opacity 0.3, until a chip is selected)

## Acceptance criteria
- [ ] Image mode appears in right-click mode menu
- [ ] Idle bar shows purple dot + "Speak your image idea" subtitle
- [ ] After recording, IMAGE_BUILDER state shows instead of PROMPT_READY
- [ ] Tier 1 Q1: model selection with 3 options (Nano Banana, Nano Banana 2, Nano Banana Pro)
- [ ] Tier 1 Q2: use case selection with 7 options
- [ ] Tier 1: all 6 questions asked in order with correct options
- [ ] Tier 2: all 4 questions asked after tier 1 completes
- [ ] Tier 1 summary box appears when tier 2 begins
- [ ] Tier 3: all 7 questions shown as optional with Skip chips
- [ ] "Copy now →" at any question → THINKING → IMAGE_BUILDER_DONE
- [ ] Back navigation works: each question returns to previous; tier 1 Q1 has no Back button
- [ ] Next without selection on tier 1/2: button is disabled (opacity 0.3) until a chip is selected
- [ ] Selected chip highlights in purple
- [ ] Answered chips accumulate above divider as questions progress
- [ ] Edit answers: previously selected chips are pre-highlighted when returning to each question
- [ ] Progress bar denominator is 17; skipped questions count as completed
- [ ] Options grid is 4 columns in expanded view
- [ ] ThinkingState shows "Assembling prompt..." when mode === 'image' (not the default "Generating prompt...")
- [ ] Assembled prompt contains no section headers — reads as natural language paragraph(s)
- [ ] Assembled prompt opening phrase matches the selected use case
- [ ] When Nano Banana Pro is selected, the system prompt sent to Claude includes "high fidelity" and "precise text rendering" instructions (verify via system prompt logged in development)
- [ ] When a resolution level is selected, the system prompt sent to Claude includes the corresponding resolution keyword instructions (verify via system prompt)
- [ ] Final screen shows prompt preview + param summary
- [ ] "Optimised for" chip shows the selected model with its API model ID
- [ ] History entry is saved with mode: 'image' and imageAnswers object via utils/history.js
- [ ] ARCHITECTURE.md state list updated (count: 13, includes IMAGE_BUILDER and IMAGE_BUILDER_DONE)
- [ ] ARCHITECTURE.md Prompt modes table includes 'image' mode entry
- [ ] DECISIONS.md includes entry for IMAGE_BUILDER sub-state pattern
- [ ] If Claude assembly fails → ERROR state with message "Could not generate image prompt — try again"

## Files in scope
- src/renderer/components/ImageBuilderState.jsx (new)
- src/renderer/components/ImageBuilderDoneState.jsx (new)
- src/renderer/App.jsx (new states, new mode handling)
- src/renderer/hooks/useMode.js (add image mode)
- src/renderer/utils/history.js (read only — call existing saveToHistory(), no structural changes)
- main.js (add image to MODE_CONFIG and show-mode-menu)
- vibe/ARCHITECTURE.md (update state list count to 13 and Prompt modes table to add 'image')
- vibe/CODEBASE.md, vibe/DECISIONS.md, vibe/TASKS.md

## Files out of scope
All other components, all hooks except useMode, preload.js, index.css
