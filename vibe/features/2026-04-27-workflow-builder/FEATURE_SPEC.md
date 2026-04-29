# FEATURE-WORKFLOW-BUILDER — n8n Workflow Builder Mode

## Problem
Building n8n workflows requires manual node-by-node construction in the
n8n UI. Users who know what they want but not how to build it spend
15-20 minutes clicking through nodes. There is no way to describe a
workflow in plain English and get something importable.

## Solution
A new "Workflow" mode in Promptly. User speaks their automation idea.
Claude maps it to n8n nodes, connections, and parameters. User reviews
the node breakdown, fills in placeholders, confirms. Claude generates
valid n8n workflow JSON ready to import. No manual node building needed.

## Critical behaviour — always expanded, never minimized
The workflow builder ALWAYS operates in the expanded view (1100×860px).
There is NO minimized bar state for the workflow builder.
Identical behaviour to the video builder:
  - When mode === 'workflow' and user presses ⌥ Space:
    If currently in minimized bar → auto-expand before recording starts
  - The expanded view handles all states: recording, thinking,
    workflow builder review, workflow builder done
  - The collapse button (≡) is hidden/disabled when mode === 'workflow'
    Tooltip on collapse button: "Workflow mode uses full view"
  - When user switches away from workflow mode, collapse button re-enables

## Mode identity
Mode name: 'workflow'
Mode label: 'Workflow'
Mode accent: rgba(34,197,94) — green (distinct from all existing modes)
Mode icon: workflow/nodes SVG (small box with arrows connecting to two boxes)
Mode dot colour: rgba(34,197,94,0.9) in idle bar
Mode subtitle in idle bar: "Describe your automation"
Mode tag in history:
  background rgba(34,197,94,0.1), color rgba(74,222,128,0.65)
Thinking spinner: green rgba(34,197,94,0.85) — not blue
Thinking label phase 1: "Mapping your workflow..."
Thinking label phase 2: "Assembling JSON..."

## Flow — start to end

STEP 1 — User presses ⌥ Space
  If minimized → auto-expand first
  Transition to RECORDING in expanded view

STEP 2 — RECORDING (expanded view)
  Top bar: red recording button + live waveform + timer
  Left panel: session history
  Right panel: "Describe your automation" standby

STEP 3 — THINKING phase 1 (analysis)
  Top bar: green spinner + "Mapping your workflow..."
  Right panel: node skeleton loading
  Claude call: workflow analysis JSON from transcript

STEP 4 — WORKFLOW_BUILDER state
  Review screen — node cards + placeholders
  User reviews, optionally fills placeholders, confirms

STEP 5 — THINKING phase 2 (JSON assembly)
  Top bar: green spinner + "Assembling JSON..."
  Right panel: loading

STEP 6 — WORKFLOW_BUILDER_DONE
  Left: plain English breakdown + import instructions
  Right: syntax-highlighted JSON preview
  Copy JSON button

---

## STEP 3 — Claude analysis call (phase 1)

System prompt:
"You are an expert n8n workflow engineer. Analyse the user's spoken
automation idea and return a structured JSON object mapping it to n8n nodes.

User's spoken idea: {transcript}

Return ONLY valid JSON, no preamble, no explanation, no markdown:
{
  'workflowName': 'descriptive name for the workflow',
  'trigger': 'plain English description of what starts the workflow',
  'nodes': [
    {
      'id': 1,
      'name': 'Human-readable node name',
      'type': 'n8n-nodes-base.exactNodeType',
      'purpose': 'one sentence — what this node does',
      'operation': 'the operation being performed',
      'parameters': {
        'paramName': 'value or PLACEHOLDER_DESCRIPTION'
      },
      'placeholders': ['list of parameter keys that need user input'],
      'credentialType': 'credential type name or null'
    }
  ],
  'connections': 'plain English — e.g. linear 1→2→3 or branching 1→2 and 1→3',
  'connectionsMap': {
    'NodeName': ['TargetNodeName1', 'TargetNodeName2']
  },
  'credentialsNeeded': ['list of credential types user must set up in n8n'],
  'placeholderCount': 3
}

Rules:
- Use exact n8n node type strings (e.g. n8n-nodes-base.googleSheetsTrigger)
- First node is always the trigger
- Parameters that need user input use ALL_CAPS_PLACEHOLDER format
- Common placeholders: spreadsheetId, sheetName, boardId, listId,
  channel, phoneNumber, email, webhookUrl, apiKey
- n8n expression syntax for dynamic values: ={{$json['fieldName']}}
- Respond ONLY with the JSON object"

Store as workflowAnalysis in App.jsx state.

---

## WORKFLOW_BUILDER review screen

### Header (right panel)
Left: workflow icon + workflow name from analysis
Right: placeholder count badge (amber) + "↺ Reiterate" link

### You said section
"YOU SAID" label + transcript (italic, rgba(255,255,255,0.38))

### Divider

### Node cards (scrollable, flex column, gap 8px)
Each node rendered as a card:

Card container:
  padding: 10px 14px
  border-radius: 10px
  background: rgba(255,255,255,0.03)
  border: 0.5px solid rgba(255,255,255,0.07)

Card header:
  display flex, align-items center, gap 8px
  Node number badge: 22px circle
    Trigger node (1): background rgba(34,197,94,0.15),
      border rgba(34,197,94,0.3), color rgba(74,222,128,0.9)
    Action nodes: background rgba(10,132,255,0.15),
      border rgba(10,132,255,0.3), color rgba(100,170,255,0.9)
  Node name: font-size 12.5px, font-weight 500, rgba(255,255,255,0.75)
  Node type: font-size 10px, monospace, rgba(255,255,255,0.28)
  Type badge right-aligned:
    Trigger: green bg, "Trigger"
    Action: blue bg, "Action"

Card fields:
  Each parameter as a row: label (10px, min-width 80px, rgba(255,255,255,0.3))
  + value or placeholder

  Regular value: font-size 11px, rgba(255,255,255,0.6)
  n8n expression: font-size 10.5px, monospace, rgba(74,222,128,0.65)
  
  Placeholder chip (tappable):
    font-size 11px
    color rgba(255,189,46,0.7)
    background rgba(255,189,46,0.06)
    border 0.5px solid rgba(255,189,46,0.18)
    border-radius 5px, padding 2px 7px
    cursor pointer
    Shows: "PLACEHOLDER_NAME ✎"
    Clicking opens an inline text input to fill the value
    After filling, chip becomes a regular green value

  Credentials row:
    label "Credentials"
    value: "{credentialType} — map in n8n after import"
    color rgba(255,255,255,0.28), font-style italic

### Connectors between cards
  display flex, align-items center, gap 6px
  padding 3px 14px
  Left: 1px vertical line (rgba(255,255,255,0.1)), margin-left 9px
  Right: arrow description in plain English
    e.g. "↓ passes data to both" or "↓ runs in parallel"
    font-size 10.5px, color rgba(255,255,255,0.2)

### Add node button
  Below last node card:
  dashed border rgba(255,255,255,0.08)
  "+" icon + "Add another node" label
  font-size 12px, color rgba(255,255,255,0.25)
  Clicking adds a blank node card with empty fields

### Action row
  Left: advisory hint if placeholders unfilled
    "{n} placeholder{s} unfilled — fill here or in n8n after import"
    font-size 11px, color rgba(255,189,46,0.5)
    Hidden when all placeholders filled
  Right: "Start over" (secondary) + "Confirm & generate JSON →" (primary green)
  Primary button always enabled — placeholder filling is optional
  > ⚠️ Changed 2026-04-29 (D-WFL-NOGATE): removed mandatory fill gate.
  > Unfilled placeholder strings pass through to the generated JSON as-is.
  > Users fill them in n8n after import.

---

## WORKFLOW_BUILDER_DONE layout

### Right panel header
Left: green dot + workflow name + node count badge
Right: "← Edit nodes" link + "Start over" link

### Two-column layout (1fr 1fr, gap 0)
Left column — "How it works":
  Section label: "HOW IT WORKS" uppercase
  Numbered steps with connecting lines between them:
    Each step: circle number + node name (bold) + purpose sentence
    Connecting line: 1px vertical rgba(255,255,255,0.08)
    Number circles match node card colours (green trigger, blue action)

  Import instructions box below steps:
    background rgba(34,197,94,0.04)
    border rgba(34,197,94,0.1)
    border-radius 9px, padding 10px 12px
    Title: "HOW TO IMPORT" green uppercase 9px
    Steps:
      1. Copy the JSON →
      2. Open n8n → New workflow
      3. ⌘A to select all → Delete
      4. ⌘V to paste JSON
      5. Map your credentials in each node
      6. Fill placeholder values
      7. Activate workflow ✓

Right column — JSON preview:
  background rgba(0,0,0,0.2)
  Section label: "N8N WORKFLOW JSON" uppercase
  Syntax-highlighted JSON (custom regex renderer — no library):
    Keys: rgba(100,170,255,0.8) — blue
    String values: rgba(74,222,128,0.8) — green
    Numbers: rgba(251,146,60,0.8) — orange
    Booleans/null: rgba(255,255,255,0.4)
    Note: NO amber placeholder highlight. If user filled all placeholders,
    JSON contains real values. If some were left unfilled, those parameter
    values appear as their original ALL_CAPS_PLACEHOLDER strings — user fills
    them in n8n after import. Amber is not used in the done screen.
    font-family monospace, font-size 10.5px, line-height 1.6

### Action row
  Left: "Save" button (secondary)
    Behaviour: calls handleWorkflowSave() → toggles isSaved flag → button
    shows "Saved ✓" when isSaved=true. Follows isSaved pattern from
    VideoBuilderDoneState. Also bookmarks the history entry via
    bookmarkHistoryItem from utils/history.js.
  Right: "Copy JSON" button (primary green gradient)
    Behaviour: copies raw workflowJson string to clipboard via
    copyToClipboard IPC → button shows "Copied!" flash for 1.8s (isCopied state)

---

## STEP 5 — Claude JSON assembly call (phase 2)

System prompt:
"You are an expert n8n workflow engineer. Generate a complete, valid
n8n workflow JSON from the following analysis and user-filled parameters.

Workflow analysis: {workflowAnalysis as JSON}
User-filled placeholders: {filledPlaceholders as JSON}

Rules:
1. Output ONLY valid n8n workflow JSON — no explanation, no markdown
2. Include all required n8n workflow fields:
   name, nodes, connections, settings, meta
3. Each node must have: id, name, type, typeVersion, position,
   parameters, credentials (empty object if not configured)
4. Connections must use exact n8n format:
   { 'NodeName': { 'main': [[{ 'node': 'TargetNode', 'type': 'main', 'index': 0 }]] } }
5. Replace all PLACEHOLDER values with user-filled values
6. Use n8n expression syntax for dynamic values: ={{$json['field']}}
7. Position nodes cleanly: trigger at [240,300], subsequent nodes
   spaced 220px apart horizontally or vertically for branches
8. typeVersion: use 1 for most nodes, check common versions:
   googleSheetsTrigger: 4, slack: 2, gmail: 2, httpRequest: 4
9. Output ONLY the JSON object"

---

## Error handling

### Phase 1 (analysis) error states
- Claude returns non-JSON or malformed JSON → JSON.parse throws → transition to ERROR state,
  message: "Workflow mapping failed. Please try again."
- Claude returns valid JSON but nodes array is empty or missing → transition to ERROR state,
  same message.
- generate-raw IPC call fails or times out → transition to ERROR state, same message.
- In all error cases the abortRef guard applies — stale async results after user resets are discarded.

### Phase 2 (JSON assembly) error states
- Claude returns non-JSON or unparseable response → transition to ERROR state,
  message: "JSON assembly failed. Please try again."
- generate-raw IPC call fails or times out → transition to ERROR state, same message.
- On error from THINKING phase 2, user can tap ERROR state to dismiss → returns to IDLE.

### Blank node card schema (for "Add another node")
A user-added blank node has this shape:
```js
{
  id: maxExistingNodeId + 1,   // auto-incremented
  name: '',                     // text input — required before Confirm
  type: '',                     // text input — user must type exact n8n node type string
  purpose: '',                  // text input (optional)
  parameters: {},
  placeholders: [],             // empty — no auto-placeholders for blank nodes
  credentialType: null,
}
```
Blank nodes show name and type as inline text inputs. The Confirm button
remains disabled if any blank node has an empty name or type field
(treated the same as an unfilled placeholder). Blank nodes have no
type badge (no Trigger/Action label) until a type is entered.

---

## State machine additions

Add to STATES in App.jsx:
  STATES.WORKFLOW_BUILDER
  STATES.WORKFLOW_BUILDER_DONE

Add to STATE_HEIGHTS:
  WORKFLOW_BUILDER: 860 (always expanded)
  WORKFLOW_BUILDER_DONE: 860 (always expanded)

Add to App.jsx state:
  workflowAnalysis: object — Claude phase 1 result
  filledPlaceholders: object — user-filled values keyed by `${nodeId}-${paramKey}`
  workflowJson: string — Claude phase 2 result (raw JSON string)
  isReiteratingWorkflow: boolean
  isSaved: boolean — Save button state in WORKFLOW_BUILDER_DONE
  isCopied: boolean — Copy JSON flash state in WORKFLOW_BUILDER_DONE

---

## Auto-expand on mode switch
When mode changes to 'workflow':
  if (!isExpanded) { handleExpand() }
  Implementation: in the mode-selected IPC handler in App.jsx (same location
  as the video builder auto-expand — follow that exact pattern).
When mode changes away from 'workflow':
  do NOT auto-collapse

---

## Reiterate behaviour
Same pattern as image and video builders:
  Re-records without losing any filled placeholder values
  Claude re-runs phase 1 analysis with new transcript
  Previously filled placeholders preserved if same parameter key exists
    (key = `${nodeId}-${paramKey}` — preserved only if same node id AND param key)
  New placeholders from new analysis shown unfilled
  User-added nodes (id > original analysis node count) are DISCARDED on reiterate
    — new analysis replaces the node list; user-added nodes had no stable id
  filledPlaceholders values from discarded user-added nodes are also discarded
  THINKING label: "Re-mapping workflow..."
  Returns to WORKFLOW_BUILDER with updated node cards

---

## Acceptance criteria
- [ ] Workflow appears in right-click mode menu with green accent
- [ ] Idle bar shows green dot + "Describe your automation"
- [ ] ⌥ Space in workflow mode auto-expands if minimized
- [ ] Recording happens in expanded view right panel standby
- [ ] THINKING phase 1: green spinner "Mapping your workflow..."
- [ ] WORKFLOW_BUILDER shows node cards with correct styling
- [ ] Trigger node has green number badge, action nodes blue
- [ ] Placeholder chips are amber and tappable
- [ ] Clicking placeholder opens inline text input
- [ ] Filled placeholder shows as green value
- [ ] Connector arrows show correct relationship description
- [ ] "Add another node" button adds blank card
- [ ] Confirm button always enabled — placeholder filling is optional (D-WFL-NOGATE)
- [ ] Reiterate preserves filled placeholders where key matches
- [ ] THINKING phase 2: green spinner "Assembling JSON..."
- [ ] WORKFLOW_BUILDER_DONE shows two-column layout
- [ ] Left column: numbered steps with connecting lines
- [ ] Left column: import instructions box
- [ ] Right column: syntax-highlighted JSON (blue keys, green strings, orange numbers)
- [ ] Copy JSON copies the full workflow JSON to clipboard
- [ ] Save button shows "Saved ✓" after clicking; bookmarks history entry
- [ ] Collapse button dimmed and non-clickable in workflow mode
- [ ] Hovering collapse button in workflow mode shows tooltip "Workflow mode uses full view"
- [ ] History entry saves with mode: 'workflow', green tag, workflowName as title
- [ ] Phase 1 Claude failure → ERROR state, message "Workflow mapping failed. Please try again."
- [ ] Phase 2 Claude failure → ERROR state, message "JSON assembly failed. Please try again."
- [ ] Empty nodes array from Claude → ERROR state
- [ ] getModeTagStyle('workflow') returns green colours in promptUtils.js
- [ ] Each git commit is one task only for clean revert

## Files in scope
- src/renderer/components/WorkflowBuilderState.jsx (new)
- src/renderer/components/WorkflowBuilderDoneState.jsx (new)
- src/renderer/hooks/useWorkflowBuilder.js (new — if extracted as hook)
- src/renderer/App.jsx (new states, auto-expand, workflow mode, workflowBuilderProps)
- src/renderer/hooks/useMode.js (add 'workflow' to MODE_LABELS)
- src/renderer/components/ExpandedTransportBar.jsx (disable collapse btn for workflow)
- src/renderer/utils/promptUtils.js (add 'workflow' case to getModeTagStyle)
- main.js (workflow mode in MODE_CONFIG + show-mode-menu)
- vibe/CODEBASE.md, vibe/DECISIONS.md, vibe/TASKS.md

## History saving — prompt field definition
History entries for workflow mode use this shape:
```js
saveToHistory({
  transcript: originalTranscript.current,
  prompt: `${workflowAnalysis.workflowName} — ${workflowAnalysis.nodes.length} nodes`,
  mode: 'workflow',
})
```
The `prompt` field stores a human-readable summary (name + node count).
workflowJson is NOT stored in history — it is too large for localStorage
and the user can copy it before navigating away.

## Files out of scope
All other components, all hooks except useMode and useWorkflowBuilder, preload.js, index.css
