# FEATURE-EMAIL-MODE — Implementation Plan

EMAIL-001 (S) — useMode.js: add 'email' mode, teal accent
  rgba(20,184,166) as accent colour
  Mode label: 'Email'
  Subtitle: 'Describe your email situation naturally'

EMAIL-002 (S) — main.js: email mode in MODE_CONFIG + show-mode-menu
  Add email generation system prompt
  Handle JSON response parsing
  Return { subject, body, toneAnalysis } to renderer

EMAIL-003 (M) — EmailReadyState.jsx: full two-column email output
  Props: emailOutput, transcript, onCopy, onCopySubject,
    onIterate, onReset, onEdit, onSave, isExpanded
  Two column layout: left (you said + tone analysis + why this tone)
    right (subject + body + action row)
  Copy subject and copy email buttons with "Copied ✓" feedback
  Tone badge in header

EMAIL-004 (M) — App.jsx: EMAIL_READY state + email mode flow
  Add STATES.EMAIL_READY
  Add emailOutput state: { subject, body, toneAnalysis }
  Auto-expand when mode === 'email'
  Disable collapse button in email mode
  Parse Claude JSON response into emailOutput
  Handle iterate (return to recording, clear emailOutput)

EMAIL-005 (S) — App.jsx: STATE_HEIGHTS.EMAIL_READY = 860
  Always expanded — same as other builder modes

EMAIL-006 (S) — History: save email entries with teal tag
  Store subject + body + toneAnalysis in history

EMAIL-007 (S) — Expanded view: hide collapse btn in email mode
  Same pattern as image, video, workflow modes

EMAIL-008 (S) — Docs: CODEBASE.md, DECISIONS.md, TASKS.md
