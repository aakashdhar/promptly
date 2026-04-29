import { useState, useRef, useCallback } from 'react'
import { saveToHistory, getHistory, bookmarkHistoryItem } from '../utils/history.js'

const GREEN = 'rgba(34,197,94,0.85)'

export default function useWorkflowBuilder({
  STATES,
  transitionRef,
  originalTranscript,
  setThinkTranscript,
  setThinkingLabel,
  setThinkingAccentColor,
  startRecordingRef,
}) {
  const [workflowAnalysis, setWorkflowAnalysis] = useState(null)
  const [filledPlaceholders, setFilledPlaceholders] = useState({})
  const [workflowJson, setWorkflowJson] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const isReiteratingRef = useRef(false)
  const originalNodeCountRef = useRef(0)
  const lastHistoryIdRef = useRef(null)

  const runWorkflowAnalysis = useCallback(async (transcript, isReiterate = false) => {
    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Workflow mapping failed. Please try again.' })
      return
    }

    const label = isReiterate ? 'Re-mapping workflow...' : 'Mapping your workflow...'
    setThinkingLabel(label)
    setThinkingAccentColor?.(GREEN)
    setThinkTranscript(transcript)
    transitionRef.current(STATES.THINKING)

    const systemPrompt = `You are an expert n8n workflow engineer. Analyse the user's spoken automation idea and return a structured JSON object mapping it to n8n nodes.

User's spoken idea: ${transcript}

Return ONLY valid JSON, no preamble, no explanation, no markdown:
{
  "workflowName": "descriptive name for the workflow",
  "trigger": "plain English description of what starts the workflow",
  "nodes": [
    {
      "id": 1,
      "name": "Human-readable node name",
      "type": "n8n-nodes-base.exactNodeType",
      "purpose": "one sentence — what this node does",
      "operation": "the operation being performed",
      "parameters": {
        "paramName": "value or PLACEHOLDER_DESCRIPTION"
      },
      "placeholders": ["list of parameter keys that need user input"],
      "credentialType": "credential type name or null"
    }
  ],
  "connections": "plain English — e.g. linear 1→2→3 or branching 1→2 and 1→3",
  "connectionsMap": {
    "NodeName": ["TargetNodeName1", "TargetNodeName2"]
  },
  "credentialsNeeded": ["list of credential types user must set up in n8n"],
  "placeholderCount": 3
}

Rules:
- Use exact n8n node type strings (e.g. n8n-nodes-base.googleSheetsTrigger)
- First node is always the trigger
- Parameters that need user input use ALL_CAPS_PLACEHOLDER format
- Common placeholders: spreadsheetId, sheetName, boardId, listId, channel, phoneNumber, email, webhookUrl, apiKey
- n8n expression syntax for dynamic values: ={{$json['fieldName']}}
- Respond ONLY with the JSON object`

    const result = await window.electronAPI.generateRaw(systemPrompt)
    if (!result.success) {
      transitionRef.current(STATES.ERROR, { message: 'Workflow mapping failed. Please try again.' })
      return
    }

    let parsed
    try {
      const raw = result.prompt.trim().replace(/^```json\s*/, '').replace(/```\s*$/, '')
      parsed = JSON.parse(raw)
    } catch {
      transitionRef.current(STATES.ERROR, { message: 'Workflow mapping failed. Please try again.' })
      return
    }

    if (!parsed.nodes || parsed.nodes.length === 0) {
      transitionRef.current(STATES.ERROR, { message: 'Workflow mapping failed. Please try again.' })
      return
    }

    if (isReiterate) {
      // Preserve matching filled placeholders; discard user-added nodes (id > originalNodeCount)
      setFilledPlaceholders(prev => {
        const next = {}
        for (const node of parsed.nodes) {
          for (const pk of (node.placeholders || [])) {
            const key = `${node.id}-${pk}`
            if (prev[key]) next[key] = prev[key]
          }
        }
        return next
      })
    } else {
      setFilledPlaceholders({})
    }

    originalNodeCountRef.current = parsed.nodes.length
    setWorkflowAnalysis(parsed)
    setIsSaved(false)
    isReiteratingRef.current = false
    transitionRef.current(STATES.WORKFLOW_BUILDER)
  }, [STATES, transitionRef, setThinkTranscript, setThinkingLabel, setThinkingAccentColor])

  const assembleWorkflowJson = useCallback(async (analysis, placeholders) => {
    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'JSON assembly failed. Please try again.' })
      return
    }

    setThinkingLabel('Assembling JSON...')
    setThinkingAccentColor?.(GREEN)
    setThinkTranscript(originalTranscript.current)
    transitionRef.current(STATES.THINKING)

    const systemPrompt = `You are an expert n8n workflow engineer. Generate a complete, valid n8n workflow JSON from the following analysis and user-filled parameters.

Workflow analysis: ${JSON.stringify(analysis, null, 2)}
User-filled placeholders: ${JSON.stringify(placeholders, null, 2)}

Rules:
1. Output ONLY valid n8n workflow JSON — no explanation, no markdown
2. Include all required n8n workflow fields: name, nodes, connections, settings, meta
3. Each node must have: id, name, type, typeVersion, position, parameters, credentials (empty object if not configured)
4. Connections must use exact n8n format: { "NodeName": { "main": [[{ "node": "TargetNode", "type": "main", "index": 0 }]] } }
5. Replace all PLACEHOLDER values with user-filled values
6. Use n8n expression syntax for dynamic values: ={{$json['field']}}
7. Position nodes cleanly: trigger at [240,300], subsequent nodes spaced 220px apart horizontally or vertically for branches
8. typeVersion: use 1 for most nodes, check common versions: googleSheetsTrigger: 4, slack: 2, gmail: 2, httpRequest: 4
9. Output ONLY the JSON object`

    const result = await window.electronAPI.generateRaw(systemPrompt)
    if (!result.success) {
      transitionRef.current(STATES.ERROR, { message: 'JSON assembly failed. Please try again.' })
      return
    }

    let jsonStr = result.prompt.trim()
    // Strip markdown fences if present
    jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '')

    // Validate it's parseable JSON
    try {
      JSON.parse(jsonStr)
    } catch {
      transitionRef.current(STATES.ERROR, { message: 'JSON assembly failed. Please try again.' })
      return
    }

    saveToHistory({
      transcript: originalTranscript.current,
      prompt: `${analysis.workflowName} — ${analysis.nodes.length} nodes`,
      mode: 'workflow',
    })
    const latest = getHistory()[0]
    lastHistoryIdRef.current = latest?.id || null

    setWorkflowJson(jsonStr)
    setIsSaved(false)
    setIsCopied(false)
    transitionRef.current(STATES.WORKFLOW_BUILDER_DONE)
  }, [STATES, transitionRef, originalTranscript, setThinkTranscript, setThinkingLabel, setThinkingAccentColor])

  const handleFillPlaceholder = useCallback((nodeId, paramKey, value) => {
    setFilledPlaceholders(prev => ({ ...prev, [`${nodeId}-${paramKey}`]: value }))
  }, [])

  const handleAddNode = useCallback(() => {
    setWorkflowAnalysis(prev => {
      if (!prev) return prev
      const maxId = prev.nodes.reduce((m, n) => Math.max(m, n.id || 0), 0)
      return {
        ...prev,
        nodes: [
          ...prev.nodes,
          { id: maxId + 1, name: '', type: '', purpose: '', parameters: {}, placeholders: [], credentialType: null },
        ],
      }
    })
  }, [])

  const handleWorkflowConfirm = useCallback((analysis, placeholders) => {
    assembleWorkflowJson(analysis, placeholders)
  }, [assembleWorkflowJson])

  const handleWorkflowStartOver = useCallback(() => {
    setWorkflowAnalysis(null)
    setFilledPlaceholders({})
    setWorkflowJson('')
    setIsSaved(false)
    setIsCopied(false)
    isReiteratingRef.current = false
    transitionRef.current(STATES.IDLE)
  }, [STATES, transitionRef])

  const handleWorkflowEdit = useCallback(() => {
    transitionRef.current(STATES.WORKFLOW_BUILDER)
  }, [STATES, transitionRef])

  const handleWorkflowSave = useCallback(() => {
    setIsSaved(prev => {
      const next = !prev
      if (lastHistoryIdRef.current) {
        bookmarkHistoryItem(lastHistoryIdRef.current, next)
      }
      return next
    })
  }, [])

  const handleWorkflowCopy = useCallback(() => {
    if (!workflowJson) return
    window.electronAPI?.copyToClipboard(workflowJson)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 1800)
  }, [workflowJson])

  const workflowBuilderProps = {
    transcript: originalTranscript.current,
    workflowAnalysis,
    filledPlaceholders,
    workflowJson,
    isSaved,
    isCopied,
    onFillPlaceholder: handleFillPlaceholder,
    onAddNode: handleAddNode,
    onConfirm: () => handleWorkflowConfirm(workflowAnalysis, filledPlaceholders),
    onReiterate: () => { isReiteratingRef.current = true; startRecordingRef?.current?.() },
    onStartOver: handleWorkflowStartOver,
    onEdit: handleWorkflowEdit,
    onSave: handleWorkflowSave,
    onCopy: handleWorkflowCopy,
  }

  return {
    isReiteratingRef,
    runWorkflowAnalysis,
    handleWorkflowStartOver,
    workflowBuilderProps,
  }
}
