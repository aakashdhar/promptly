# FEATURE-EMAIL-MODE — Email drafting mode for Promptly

## Problem
Writing professional emails is hard. The tone, structure, and framing
need to be right — especially for difficult situations like delays,
pushbacks, or sensitive client communication. Users know what they want
to say but struggle to say it well in writing.

## Solution
A new "Email" mode that works exactly like Polish mode — speak the
situation naturally, get a ready-to-send email back. No prompt
intermediary. The output is the email itself — subject line + body +
a short tone note explaining why Claude chose that tone.

Claude infers everything from how the user speaks:
- Who the recipient is (client, teammate, boss, vendor)
- What tone is appropriate (formal, diplomatic, warm, direct)
- What the core message is
- What to include and what to avoid
- What action is needed from the recipient

## Critical behaviour — always expanded, never minimized
Email mode ALWAYS operates in the expanded view (1100×860px).
There is NO minimized bar state for Email mode.
Identical behaviour to Image, Video and Workflow modes:
  - When mode === 'email' and user presses ⌥ Space:
    If currently in minimized bar → auto-expand before recording starts
  - The expanded view handles all states: recording, thinking,
    email ready
  - The collapse button (≡) is hidden/disabled when mode === 'email'
    Tooltip: "Email mode uses full view"
  - When user switches away from email mode, collapse button re-enables

## Mode identity
Mode name: 'email'
Mode label: 'Email'
Mode accent: rgba(20,184,166) — teal (distinct from all existing modes)
Mode icon: envelope SVG
Mode dot colour: rgba(20,184,166,0.9) in idle bar
Mode subtitle in idle bar: "Describe your email situation naturally"
Mode tag in history:
  background rgba(20,184,166,0.1), color rgba(45,212,191,0.65)
Thinking spinner: teal rgba(20,184,166,0.85)
Thinking label: "Drafting your email..."
Thinking waveform: slow teal morph wave (same pattern as existing
  thinking state but teal instead of blue)

## Flow — start to end

STEP 1 — User presses ⌥ Space
  If minimized → auto-expand first
  Transition to RECORDING in expanded view

STEP 2 — RECORDING (expanded view)
  Top bar: red recording button + live waveform + timer
  Left panel: session history (normal)
  Right panel: standby state
    Centred layout:
      Envelope icon (teal tint, 56px circle)
      Title: "Describe your email situation"
      Subtitle: "Who are you writing to? What needs to be said?
        Speak naturally — Claude will handle the rest."
    font-size title 16px, rgba(255,255,255,0.55)
    font-size subtitle 13px, rgba(255,255,255,0.28), line-height 1.7

STEP 3 — THINKING
  Top bar: teal spinner + "Drafting your email..."
    setThinkingAccentColor('rgba(20,184,166,0.85)') MUST be called
    when transitioning to THINKING in email mode — same pattern as
    video (orange) and workflow (green). This drives the MorphCanvas
    accentColor prop and the THINKING pill colour in ThinkingState.
  Right panel: skeleton loading
    Skeleton sections matching the email ready layout:
    Bar colour: rgba(255,255,255,0.06) — matches existing skeleton pattern
      Subject line skeleton: one bar 60% width
      Email body skeleton: 6-7 bars varying widths
      Tone note skeleton: 2 bars

STEP 4 — EMAIL_READY state
  Full email output in right panel
  Two column layout (see below)

---

## Claude system prompt for email generation

"You are an expert communication writer. The user has described an email
situation by speaking naturally. Write a complete, professional email
based on what they described.

User's spoken situation: {transcript}

Analyse the transcript and infer:
- Who the recipient is and their relationship to the sender
- The appropriate tone (formal/informal, warm/direct, diplomatic/firm)
- The core message that must come across
- Any specific instructions the user mentioned (e.g. 'be diplomatic',
  'keep it short', 'don't sound desperate')
- What action or response is needed from the recipient

Return ONLY valid JSON, no preamble, no markdown:
{
  'subject': 'The email subject line',
  'body': 'The complete email body with proper greeting and sign-off',
  'toneAnalysis': {
    'recipient': 'who the recipient is and their relationship',
    'tone': 'the tone chosen e.g. Diplomatic, professional, warm',
    'coreMessage': 'one sentence — the core message',
    'approach': 'one sentence — how the email handles the situation',
    'whyThisTone': 'two sentences explaining why this tone was chosen
      and what specific decisions were made based on the transcript'
  }
}

Rules:
1. The email body must be complete and ready to send
2. Use proper greeting (Hi [Name], / Dear [Name], / Hello [Name],)
   Infer name from transcript if mentioned, otherwise use generic
3. Sign-off: Best, / Kind regards, / Thanks, — infer from tone
4. Do not include placeholder text — write a real email
5. The subject line should be specific, not generic
6. Body: 3-5 paragraphs for complex situations, 1-2 for simple ones
7. If user mentioned 'diplomatic' or 'careful' — avoid blame language
8. If user mentioned 'firm' or 'direct' — be clear and assertive
9. Always end with a clear next step or call to action
10. Respond ONLY with the JSON object"

Store parsed response as emailOutput in App.jsx state:
  emailOutput: { subject, body, toneAnalysis }

---

## EMAIL_READY layout — expanded view

### Top bar (dimmed — not recording)
Mic button: opacity 0.35
Flanking controls: opacity 0.35
Timer: opacity 0.2
Mode pill: full opacity teal — "Email"
Waveform: flat teal hairline
Collapse button: hidden (email mode always expanded)

Text area right of divider:
  Green dot + "Email ready"
  Subtitle: "Review and copy to send"

### Right panel header
padding: 16px 28px 14px
border-bottom: 0.5px solid rgba(255,255,255,0.05)
display flex, justify-content space-between, align-items center

Left side:
  Teal dot (7px) + "Email ready" (13px, font-weight 500,
    rgba(255,255,255,0.65))
  Tone badge: toneAnalysis.tone value
    background rgba(20,184,166,0.08)
    border rgba(20,184,166,0.18), border-radius 4px
    font-size 10px, color rgba(45,212,191,0.6)
    padding 2px 7px

Right side:
  "Iterate ↻" link (12px, rgba(255,255,255,0.2))
  "Reset" link (12px, rgba(255,255,255,0.2))

### Two column content (grid-template-columns: 1fr 1.4fr)

LEFT COLUMN (1fr):
  padding: 20px 22px
  border-right: 0.5px solid rgba(255,255,255,0.05)
  overflow-y: auto
  display flex, flex-direction column, gap 18px

  Section 1 — You said:
    Label: "YOU SAID" — 9px uppercase teal 0.5
    Content: transcript text
      font-size 13px, rgba(255,255,255,0.42), italic, line-height 1.7

  Divider: 0.5px rgba(255,255,255,0.06)

  Section 2 — Tone analysis:
    Label: "TONE ANALYSIS" — 9px uppercase rgba(255,255,255,0.22)
    Four rows (label min-width 70px teal 0.5 + value 12.5px rgba(255,255,255,0.62)):
      Recipient: toneAnalysis.recipient
      Tone: toneAnalysis.tone
      Core msg: toneAnalysis.coreMessage
      Approach: toneAnalysis.approach

  Section 3 — Why this tone box:
    padding 10px 12px
    background rgba(20,184,166,0.04)
    border rgba(20,184,166,0.1), border-radius 9px
    Label: "WHY THIS TONE" — 9px uppercase rgba(20,184,166,0.45)
    Content: toneAnalysis.whyThisTone
      font-size 11.5px, rgba(255,255,255,0.38), line-height 1.65

RIGHT COLUMN (1.4fr):
  padding: 20px 28px
  overflow-y: auto
  display flex, flex-direction column, gap 16px

  Subject section:
    Header row: "SUBJECT LINE" label (9px teal 0.5) + Copy button right
      Copy button: height 22px, padding 0 9px
        background rgba(20,184,166,0.08)
        border rgba(20,184,166,0.18), border-radius 5px
        font-size 10px, font-weight 600
        color rgba(45,212,191,0.65)
    Subject box:
      padding 10px 14px
      background rgba(255,255,255,0.03)
      border rgba(255,255,255,0.08), border-radius 9px
      font-size 13.5px, font-weight 500, rgba(255,255,255,0.78)
      content: emailOutput.subject

  Email body section (flex: 1):
    Header row: "EMAIL BODY" label (9px teal 0.5)
    Body box:
      padding 16px 18px
      background rgba(255,255,255,0.02)
      border rgba(255,255,255,0.07), border-radius 9px
      font-size 13.5px, rgba(255,255,255,0.72), line-height 1.85
      content: emailOutput.body (preserve line breaks)
      white-space: pre-wrap

### Action row
padding: 12px 24px 18px
border-top: 0.5px solid rgba(255,255,255,0.05)
display flex, gap 8px, align-items center

Left buttons:
  "Edit" — secondary style
    onClick: toggles inline edit mode on the email body
    When active: body box becomes contenteditable (same pattern as
      PromptReadyState edit mode); button label changes to "Done"
    When Done clicked: saves edited content back to emailOutput.body
      (update local state only — no re-generation)
    Escape key: cancels edit, restores previous body text

  "Save" — secondary style
    onClick: bookmarks the history entry via bookmarkHistoryItem()
    When saved: button label changes to "Saved ✓" (permanent, not timed)
    Note: history entry is auto-saved on generation; Save adds the
      bookmarked flag — equivalent to the bookmark toggle in HistoryPanel

Spacer: flex 1

Right buttons:
  "Copy subject" — teal outline style
    height 40px, padding 0 20px
    background rgba(20,184,166,0.08)
    border rgba(20,184,166,0.2), border-radius 10px
    font-size 13px, font-weight 500
    color rgba(45,212,191,0.8)
    onClick: copies emailOutput.subject to clipboard

  "Copy email" — primary teal gradient
    height 40px, padding 0 28px
    background linear-gradient(135deg, rgba(20,184,166,0.88),
      rgba(13,148,136,0.88))
    color white, border none, border-radius 10px
    font-size 13px, font-weight 600
    box-shadow 0 2px 12px rgba(20,184,166,0.25)
    onClick: copies emailOutput.subject + '\n\n' + emailOutput.body
      to clipboard (subject + double newline + body)

### Copy behaviour
When either copy button is clicked:
  Button text changes to "Copied ✓" for 2 seconds
  Then reverts to original label
  Uses navigator.clipboard.writeText()

---

## Iterate behaviour
Same as existing Polish mode:
  User clicks "Iterate ↻"
  Returns to RECORDING state in expanded view
  Previous email output cleared
  New recording generates a fresh email
  History entry from previous attempt preserved

---

## History saving
Save email entries with:
  mode: 'email'
  transcript: the spoken situation
  output: emailOutput.subject + '\n\n' + emailOutput.body
  toneAnalysis: stored for reference
  tag: teal "Email" tag in history panel

---

## Auto-expand on mode switch
When mode changes to 'email' (mode-selected IPC handler in App.jsx):
  if (!isExpandedRef.current) { handleExpand() }
When mode changes away from 'email':
  do NOT auto-collapse — let user decide

## Auto-expand on shortcut trigger
The shortcut path is:
  globalShortcut → shortcut-triggered IPC →
  useKeyboardShortcuts.js onShortcutTriggered →
  startRecordingRef.current()

In App.jsx's shortcut-triggered IPC listener (or in the
onShortcutTriggered callback in useKeyboardShortcuts.js), BEFORE
calling startRecordingRef.current(), insert:
  if (modeRef.current === 'email' && !isExpandedRef.current) {
    handleExpand()
  }
This ensures the window expands before recording begins.
If useKeyboardShortcuts.js needs to call handleExpand, it must be
passed as a prop/param — do not add it as a new IPC channel.

---

## Acceptance criteria
- [ ] Email appears in right-click mode menu with teal accent
- [ ] Idle bar shows teal dot + "Describe your email situation naturally"
- [ ] Idle bar: teal pulse ring + teal mode pill text + correct subtitle
- [ ] ⌥ Space in email mode auto-expands if minimized
- [ ] Collapse button hidden in email mode
- [ ] Recording: right panel shows envelope icon + prompt text
- [ ] Thinking: teal spinner + "Drafting your email..." in top bar
- [ ] Thinking: teal morph wave (not default blue) — accentColor set
- [ ] Thinking: right panel shows skeleton matching email layout
- [ ] EMAIL_READY: right panel shows two-column grid (1fr 1.4fr)
- [ ] Left column: transcript shown in italic
- [ ] Left column: tone analysis rows (recipient, tone, core msg, approach)
- [ ] Left column: "Why this tone" teal box with explanation
- [ ] Right column: subject line with individual copy button
- [ ] Right column: full email body with line breaks preserved
- [ ] Header: tone badge shows inferred tone
- [ ] "Copy subject" copies subject only
- [ ] "Copy email" copies subject + double newline + body
- [ ] Both copy buttons show "Copied ✓" for 2 seconds after click
- [ ] Edit button: clicking makes body contenteditable; Done saves edit; Escape cancels
- [ ] Save button: clicking bookmarks the history entry; label changes to "Saved ✓"
- [ ] Iterate returns to recording, clears output
- [ ] History saves with teal Email tag
- [ ] Top bar properly dimmed in EMAIL_READY state
- [ ] Waveform is flat teal hairline in EMAIL_READY
- [ ] No minimized bar state for email mode
- [ ] Auto-expand works from minimized bar

## Files in scope
- src/renderer/components/EmailReadyState.jsx (new)
- src/renderer/components/IdleState.jsx (teal visual identity in idle bar)
- src/renderer/components/ExpandedTransportBar.jsx (collapse btn disabled)
- src/renderer/components/ExpandedDetailPanel.jsx (EMAIL_READY routing,
  RECORDING standby panel, THINKING skeleton)
- src/renderer/App.jsx (new state, auto-expand, email mode handling,
  setThinkingAccentColor call, shortcut-triggered auto-expand)
- src/renderer/hooks/useMode.js (add email mode with teal accent)
- src/renderer/hooks/useKeyboardShortcuts.js (auto-expand before
  startRecording when mode === 'email' — if expand callback added here)
- src/renderer/utils/promptUtils.js (getModeTagStyle email teal case)
- main.js (email mode in MODE_CONFIG + show-mode-menu +
  system prompt for email generation)
- vibe/CODEBASE.md, vibe/DECISIONS.md, vibe/TASKS.md

## Files out of scope
All other components, all hooks except useMode and useKeyboardShortcuts
preload.js, index.css
