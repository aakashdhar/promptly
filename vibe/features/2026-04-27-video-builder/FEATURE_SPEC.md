# FEATURE-VIDEO-BUILDER — Veo 3.1 Video Prompt Builder

## Problem
Users who want to generate videos with Veo 3.1 speak a rough idea but
don't know all the parameters available — camera movement, resolution,
native audio, dialogue, reference images, first frame control. The result
is generic prompts that miss Veo 3.1's most powerful capabilities.

## Solution
A new mode called "Video" that launches a guided smart-defaults review
screen after the user speaks their idea. Claude analyses the transcript
and pre-selects all parameters. The user reviews, adjusts, and confirms.
The final output is a natural language prompt optimised for
veo-3.1-generate-preview.

## Critical behaviour — always opens in expanded view
The video builder ALWAYS opens in the expanded view (1100×860px).
There is NO minimized bar state for the video builder.
When mode === 'video' and user presses ⌥ Space:
  - If currently in minimized bar → automatically expand to full view
    before starting recording
  - The expanded view handles all states: recording, thinking,
    video builder review, video builder done
  - The collapse button (≡) in the expanded view is disabled (visible,
    opacity 0.4, not interactive) when mode === 'video'
  - A tooltip on the collapse button reads: "Video mode uses full view"
  - When user switches away from video mode, collapse button re-enables
    (opacity 1, interactive)

## Mode identity
Mode name: 'video'
Mode label: 'Video'
Mode accent: rgba(251,146,60) — orange (distinct from all other modes)
Mode icon: video camera SVG
Mode dot colour: rgba(251,146,60,0.9) in idle bar
Mode subtitle in idle bar: "Speak your video idea"
Mode tag colour in history: rgba(251,146,60,0.1) bg, rgba(251,146,60,0.65) text

## Flow — start to end

STEP 1 — User presses ⌥ Space
  If minimized → auto-expand calls setWindowSize(1100, 860) atomically
    (existing set-window-size IPC), then immediately transitions to
    RECORDING without waiting for window animation to complete.
    Window expands visually while recording indicator is already active —
    same behaviour as existing handleExpand() flow.
  Then transition to RECORDING state in expanded view

STEP 2 — RECORDING (in expanded view)
  Top bar: red recording button + live waveform + timer
  Left panel: session history (normal)
  Right panel: "Listening..." + standby

STEP 3 — THINKING (first pass — analysis)
  transition(THINKING, { label: 'Analysing your idea...', accentColor: 'rgba(251,146,60,0.8)' })
  App.jsx sets thinkingLabel = 'Analysing your idea...'
              thinkingAccentColor = 'rgba(251,146,60,0.8)'
  Right panel skeleton loading
  Claude call: pre-selection JSON from transcript (see below)

  On error (invalid JSON or generate-raw failure):
    Transition to ERROR state, message:
    "Couldn't analyse your idea — tap to try again"
    Resets videoDefaults and videoAnswers to {}

STEP 4 — VIDEO_BUILDER state
  Full review screen in right panel
  Smart defaults pre-filled
  User reviews, taps to change, confirms

STEP 5 — THINKING (second pass — assembly)
  transition(THINKING, { label: 'Assembling prompt...', accentColor: 'rgba(251,146,60,0.8)' })
  App.jsx sets thinkingLabel = 'Assembling prompt...'
              thinkingAccentColor = 'rgba(251,146,60,0.8)'
  Right panel skeleton loading

  On error (generate-raw failure):
    Transition to ERROR state, message:
    "Couldn't assemble prompt — tap to try again"

STEP 6 — VIDEO_BUILDER_DONE
  Assembled prompt preview
  Param summary chips
  Copy prompt button

---

## STEP 3 — Claude pre-selection call

System prompt for pre-selection:
"You are an expert video prompt engineer for Veo 3.1 (Google's video
generation model). Analyse the user's spoken idea and return a JSON
object with pre-selected values for each parameter.

User's spoken idea: {transcript}

Return ONLY valid JSON, no preamble, no explanation, no markdown:
{
  'cameraMovement': ['Slow push-in'],
  'shotType': ['Medium'],
  'aspectRatio': '16:9',
  'resolution': '1080p',
  'cinematicStyle': ['Cinematic film'],
  'lighting': ['Golden hour'],
  'colourGrade': ['Teal & orange'],
  'pacing': ['Slow cuts'],
  'audio': ['Ambient sound'],
  'settingDetail': '',
  'useFirstFrame': false,
  'referenceImages': false
}

Rules:
- Only pre-select values you are confident about from the transcript
- Arrays can have multiple values if clearly implied
- Leave arrays empty [] if not mentioned
- Leave strings empty '' if not mentioned
- aspectRatio default: '16:9'
- resolution default: '1080p'
- useFirstFrame default: false
- referenceImages default: false
- Respond ONLY with the JSON object"

Store response as videoDefaults in App.jsx state.
videoAnswers starts as deep copy of videoDefaults.

---

## ThinkingState.jsx modifications

Add props to ThinkingState.jsx:
  thinkingLabel: string — when non-empty, displayed instead of mode-derived label
  thinkingAccentColor: string — when non-empty, used for spinner/wave colour

Existing image mode behaviour unchanged (uses mode prop when no override).
Video mode always passes thinkingLabel and thinkingAccentColor explicitly via
the transition payload — App.jsx extracts them from the payload and sets state.

ThinkingState label logic:
  if (thinkingLabel) return thinkingLabel
  if (mode === 'image') return 'Assembling prompt…'
  return 'Building your prompt'

---

## VIDEO_BUILDER review screen layout

### Header
Left: video icon + "Veo 3.1 builder"
Right: sparkle icon + "Claude filled these · tap to change"
  sparkle: rgba(251,146,60,0.6)

### You said
"YOU SAID" label + transcript (italic, rgba(255,255,255,0.4))

### Divider

### Param rows — same pattern as image builder

LABEL style: font-size 9px, font-weight 700, uppercase,
  letter-spacing 0.08em, color rgba(255,255,255,0.22),
  min-width 80px, flex-shrink 0

Chip states:
1. AI pre-selected:
   background rgba(251,146,60,0.14), border rgba(251,146,60,0.38)
   color rgba(251,146,60,0.95), font-weight 500
   Left: 5px orange dot indicator
   font-size 11px, padding 4px 10px, border-radius 8px

2. User-added:
   background rgba(251,146,60,0.22), border rgba(251,146,60,0.55)
   color rgba(255,200,150,1), font-weight 600
   No dot

3. Deselected: removed from display, re-addable via + add

+ add chip:
  border dashed rgba(255,255,255,0.15), background transparent
  color rgba(255,255,255,0.25), padding 4px 10px, border-radius 8px

### Badge types
API badge (real API parameter):
  background rgba(48,209,88,0.1), border rgba(48,209,88,0.25)
  color rgba(48,209,88,0.7), font-size 8.5px uppercase

Veo 3.1 badge (unique capability):
  background rgba(251,146,60,0.1), border rgba(251,146,60,0.25)
  color rgba(251,146,60,0.7), font-size 8.5px uppercase

### Essential params (always visible)

Row 1: Camera movement
  Label: "Camera"
  Multi-select chips + add
  Options: Static wide, Slow push-in, Pull back, Tracking follow,
    Drone overhead, Handheld, Pan left/right, Tilt up/down,
    360° orbit, POV / first person, Dolly zoom

Row 2: Aspect ratio [API badge]
  Label: "Ratio API"
  Single select
  Options: 16:9 landscape (default), 9:16 portrait

Row 3: Resolution [API badge]
  Label: "Resolution API"
  Single select
  Options: 720p, 1080p (default), 4K ✦
  Note below if 4K selected:
    font-size 10px, color rgba(255,189,46,0.5)
    "4K incurs higher API costs and longer generation time"

Row 4: Audio [Veo 3.1 badge]
  Label: "Audio Veo 3.1"
  Multi-select chips + add
  Options: No audio, Ambient sound, Background music, Sound effects
  Note: Dialogue is configured separately in the advanced Dialogue row (Row 11)

### Important params (always visible)

Row 5: Cinematic style
  Label: "Style"
  Multi-select + add
  Options: Hyper-realistic, Cinematic film, Documentary,
    Animation, Fantasy, Film noir, Dreamlike, Music video

Row 6: Lighting & mood
  Label: "Lighting"
  Multi-select + add
  Options: Golden hour, Dawn / soft mist, Blue hour / dusk,
    Neon / artificial, Dramatic / harsh, Overcast / diffused,
    Candlelight, Studio / clean

Row 7: Colour grade
  Label: "Colour"
  Multi-select + add
  Options: Teal & orange, Warm & golden, Cool & blue,
    Desaturated / muted, High contrast, Monochrome,
    Pastel / soft, Vivid / saturated

Row 8: Pacing
  Label: "Pacing"
  Multi-select + add
  Options: Slow cuts, Real-time, Fast edit, Slow motion,
    Time-lapse, Match cuts

### Duration info note (always visible, not a param)
Below the essential params section:
  padding 5px 9px, background rgba(255,255,255,0.02)
  border 0.5px solid rgba(255,255,255,0.06), border-radius 7px
  Info icon + "Veo 3.1 generates 8-second clips — duration is fixed"
  font-size 10px, color rgba(255,255,255,0.2)

### Section separator
Between important and advanced:
  "− Hide advanced parameters" / "+ Show advanced parameters" toggle
  font-size 10.5px, color rgba(251,146,60,0.45), cursor pointer

### Advanced params (collapsed by default)

Row 9: Shot type
  Label: "Shot type"
  Multi-select + add
  Options: Wide establishing, Medium, Close-up,
    Extreme close-up, Over-shoulder, Two-shot

Row 10: Setting detail
  Label: "Setting"
  Text input for freeform location/time/weather enrichment
  placeholder: "Add setting details — location, time, weather..."
  background rgba(255,255,255,0.03)
  border 0.5px solid rgba(255,255,255,0.08), border-radius 7px
  padding 7px 10px, font-size 11px
  color rgba(255,255,255,0.65), font-style italic

Row 11: Dialogue [Veo 3.1 badge]
  Label: "Dialogue Veo 3.1"
  Options: No dialogue (default), Add spoken lines
  If "Add spoken lines" selected → text input appears:
    placeholder: "Type exact dialogue in quotes — Veo will speak it"
    Same input style as Row 10 setting detail
  Note: "Veo 3.1 generates native speech from dialogue"
  State variable: videoDialogueText (shared with assembly payload)

Row 12: First frame [Veo 3.1 badge]
  Label: "First frame Veo 3.1"
  Options: Text only (default), Use image as first frame
  If "Use image as first frame" selected → show info:
    "Provide an image to start video from a specific frame"
    font-size 10px, color rgba(255,255,255,0.3)
  Note: connects to image builder — "Generate with Nano Banana first →"
    This is a hint only — no actual image upload in v1

Row 13: Reference images [Veo 3.1 badge]
  Label: "Ref images Veo 3.1"
  Options: None (default), Add reference images
  If "Add reference images" selected → show three upload slots:
    3 dashed boxes, 32×32px each, border rgba(251,146,60,0.3)
    "+" in each, orange tint
    Note: "Up to 3 images — preserves subject appearance (face, outfit, product)"
  Note: image upload is v1 placeholder — show UI but note
    "Image reference upload coming in v2"

### Footer
Left: "↺ Reiterate" link
Right: "Copy now →" link + "Confirm & generate →" button
  Button: rgba(251,146,60,0.78) bg, white, font-weight 600
  height 29px, padding 0 16px, border-radius 8px

### Copy now behaviour
  In VIDEO_BUILDER state: copies raw transcript (originalTranscript)
  In VIDEO_BUILDER_DONE state: copies assembled prompt (videoBuiltPrompt)
  The Copy now link is always visible in the footer regardless of phase

---

## Reiterate behaviour
Same as image builder:
  Re-records without losing params
  transition(THINKING, { label: 'Updating idea...', accentColor: 'rgba(251,146,60,0.8)' })
  Claude re-runs pre-selection and merges:
    User-added chips preserved
    AI chips refreshed from new transcript
    Previously removed chips stay removed
  Returns to VIDEO_BUILDER at same state
  "You said" updates to new transcript

---

## Confirm & generate flow
1. Collect all videoAnswers
2. Build merged payload before calling generate-raw:
     const mergedAnswers = {
       ...videoAnswers,
       dialogueText: videoDialogueText,
       settingDetail: videoSettingDetail
     }
3. transition(THINKING, { label: 'Assembling prompt...', accentColor: 'rgba(251,146,60,0.8)' })
4. Claude assembly call with mergedAnswers (see below)
5. Transition to VIDEO_BUILDER_DONE

### Claude assembly system prompt:
"You are an expert video prompt engineer for Veo 3.1.
Assemble the following parameters into a single flowing natural language
video generation prompt. Do NOT use section headers.

User's spoken idea: {transcript}
Selected parameters: {mergedAnswers as JSON}

Rules:
1. Start with the subject and main action from the transcript
2. Weave camera movement in naturally — it's the most important element
3. Include aspect ratio and resolution as natural phrases
4. If dialogueText was specified, include it in quotes
5. Audio direction goes near the end
6. Be specific and cinematic — avoid vague adjectives
7. Maximum 80 words — concise but complete
8. Output ONLY the prompt — no preamble, no explanation"

---

## VIDEO_BUILDER_DONE layout

Header: green dot + "Video prompt ready"
Right side: "← Edit" + "Start over" links

  ← Edit: returns to VIDEO_BUILDER state (videoAnswers preserved,
    videoBuiltPrompt cleared — user can adjust and re-confirm)
  Start over: resets videoDefaults, videoAnswers, videoDialogueText,
    videoSettingDetail, and videoBuiltPrompt to initial values,
    then transitions to IDLE

Divider

"ASSEMBLED PROMPT" label
Prompt text box:
  background rgba(255,255,255,0.03), border rgba(255,255,255,0.07)
  border-radius 9px, padding 10px 12px
  font-size 12.5px, rgba(255,255,255,0.65), line-height 1.7

Param summary chips (orange)

"OPTIMISED FOR" label
Single chip: "veo-3.1-generate-preview"
  background rgba(251,146,60,0.08), border rgba(251,146,60,0.15)
  color rgba(251,146,60,0.65)

Divider

Action row:
  Save button (secondary): saves assembled prompt to promptly_history
    with video entry structure. Shows 1.5s 'Saved ✓' flash on button.
    If already saved this session, shows 'Saved ✓' without re-saving.
  Copy prompt button (primary orange gradient)

---

## Video history entry structure

Video builder entries extend the base promptly_history structure:
{
  id: string,
  transcript: string,      // raw spoken idea
  prompt: string,          // assembled natural-language prompt
  mode: 'video',
  timestamp: number,
  title: string,           // first 5 words of transcript
  videoAnswers: object     // full merged params at time of save
                           // includes dialogueText + settingDetail
}

---

## videoBuilderProps bundle (App.jsx → ExpandedView → ExpandedDetailPanel)

videoBuilderProps is passed from App.jsx as a single bundle prop,
forwarded through ExpandedView.jsx to ExpandedDetailPanel.jsx.
Mirrors the existing imageBuilderProps pattern.

Shape:
{
  // VideoBuilderState props (VIDEO_BUILDER)
  transcript,           // string
  videoDefaults,        // object
  videoAnswers,         // object
  showAdvanced,         // boolean (showVideoAdvanced)
  activePickerParam,    // string | null (videoActivePickerParam)
  dialogueText,         // string (videoDialogueText)
  settingDetail,        // string (videoSettingDetail)
  onChipRemove,         // fn(param, value)
  onChipAdd,            // fn(param, value)
  onParamChange,        // fn(param, value)
  onToggleAdvanced,     // fn()
  onOpenPicker,         // fn(param)
  onClosePicker,        // fn()
  onDialogueChange,     // fn(text)
  onSettingChange,      // fn(text)
  onConfirm,            // fn()
  onCopyNow,            // fn()
  onReiterate,          // fn()

  // VideoBuilderDoneState props (VIDEO_BUILDER_DONE)
  videoBuiltPrompt,     // string
  onCopy,               // fn()
  onEdit,               // fn() — returns to VIDEO_BUILDER
  onStartOver,          // fn() — resets all video state → IDLE
}

---

## Expanded view layout

VIDEO_BUILDER and VIDEO_BUILDER_DONE always render in expanded view.
Use existing ExpandedView.jsx three-zone layout:
  Top bar: same as existing — transport controls
    Mic button and flanking controls: opacity 0.4 (not recording)
    Mode pill: shows "Video" in orange
    Collapse button: opacity 0.4, pointer-events none, tooltip
      "Video mode uses full view" — disabled, NOT hidden
  Left panel (300px): session history as normal
    Active entry shows "Now · building" with orange Video tag
  Right panel (flex:1): VIDEO_BUILDER review screen or VIDEO_BUILDER_DONE

### Right panel in VIDEO_BUILDER (expanded):
Header row + you said section + param rows
Params rendered in a two-column grid when space allows:
  Left column: Camera, Ratio, Resolution, Audio, Style, Lighting
  Right column: Colour, Pacing + advanced params below
  OR single column scroll — agent decides based on content height
Option chips use 4-column grid for options picker (same as image builder)

### Right panel in VIDEO_BUILDER_DONE (expanded):
Two-column layout:
  Left: assembled prompt box (font-size 14px) + optimised for chips
  Right: full param breakdown (label: value pairs, 13px)
Action row: Save + spacer + Copy prompt

---

## State machine additions

Add to STATES in App.jsx:
  STATES.VIDEO_BUILDER
  STATES.VIDEO_BUILDER_DONE

Add to STATE_HEIGHTS:
  VIDEO_BUILDER: 860 (always expanded — same as EXPANDED)
  VIDEO_BUILDER_DONE: 860 (always expanded)

Add to App.jsx state:
  videoDefaults: object — Claude pre-selection from transcript
  videoAnswers: object — current user selections
  videoBuiltPrompt: string — assembled prompt from second Claude call
  showVideoAdvanced: boolean
  videoActivePickerParam: string | null
  videoDialogueText: string
  videoSettingDetail: string
  isReiteratingVideo: boolean
  thinkingLabel: string — ThinkingState label override ('' = use mode default)
  thinkingAccentColor: string — ThinkingState colour override ('' = use mode default)

transition() payload additions:
  When transitioning to THINKING with a label payload:
    transition(STATES.THINKING, { label, accentColor })
    App.jsx sets thinkingLabel = label, thinkingAccentColor = accentColor
  On transition away from THINKING: reset thinkingLabel = '', thinkingAccentColor = ''

---

## Auto-expand on mode switch
In App.jsx, when mode changes to 'video':
  if (!isExpanded) {
    handleExpand() // auto-expand
  }

When mode changes away from 'video':
  do NOT auto-collapse — let user decide

---

## Acceptance criteria
- [ ] Video appears in right-click mode menu with orange accent
- [ ] Idle bar shows orange dot + "Speak your video idea"
- [ ] Pressing ⌥ Space in video mode auto-expands if minimized
- [ ] Recording happens in expanded view
- [ ] After recording, THINKING shows orange spinner + "Analysing your idea..."
- [ ] VIDEO_BUILDER shows smart defaults review screen in right panel
- [ ] All 13 param rows render correctly
- [ ] API badges on Ratio and Resolution
- [ ] Veo 3.1 badges on Audio, Dialogue, First frame, Ref images
- [ ] 4K cost warning appears when 4K selected
- [ ] Duration info note always visible
- [ ] Advanced params hidden by default, toggle shows/hides
- [ ] AI pre-selected chips show orange dot indicator
- [ ] Tapping chip removes it, can re-add via + add
- [ ] + add opens inline option picker
- [ ] Reiterate re-records preserving all params; THINKING shows "Updating idea..."
- [ ] Confirm → THINKING "Assembling prompt..." → VIDEO_BUILDER_DONE
- [ ] Copy now in VIDEO_BUILDER copies raw transcript
- [ ] Copy now in VIDEO_BUILDER_DONE copies assembled prompt
- [ ] Collapse button disabled (opacity 0.4) with tooltip in video mode
- [ ] History saves video builder prompts with mode: 'video' + videoAnswers
- [ ] Works correctly in expanded view with left history panel
- [ ] Pre-selection error → ERROR state with correct message
- [ ] Assembly error → ERROR state with correct message
- [ ] Start over resets all video state → IDLE
- [ ] Save button saves to history + shows 'Saved ✓' flash

## Files in scope
- src/renderer/components/VideoBuilderState.jsx (new)
- src/renderer/components/VideoBuilderDoneState.jsx (new)
- src/renderer/hooks/useVideoBuilder.js (new)
- src/renderer/App.jsx (new states, auto-expand, video mode, thinkingLabel state)
- src/renderer/hooks/useMode.js (add video mode with orange accent)
- src/renderer/components/ThinkingState.jsx (add thinkingLabel + thinkingAccentColor props)
- src/renderer/components/ExpandedView.jsx (add videoBuilderProps pass-through)
- src/renderer/components/ExpandedDetailPanel.jsx (render VIDEO_BUILDER + VIDEO_BUILDER_DONE)
- src/renderer/components/ExpandedTransportBar.jsx (disable collapse button in video mode)
- main.js (video mode in MODE_CONFIG + show-mode-menu)
- vibe/CODEBASE.md, vibe/DECISIONS.md, vibe/TASKS.md

## Files out of scope
All other components, all hooks except useMode and new useVideoBuilder,
preload.js, index.css, splash.html
