import { useState, useRef, useCallback } from 'react'
import { saveToHistory, bookmarkHistoryItem } from '../utils/history.js'
import { parseWorkflowAnalysis, parseJsonObject } from '../utils/promptUtils.js'

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

    const result = await window.electronAPI.builderStep('workflow-analyse', { TRANSCRIPT: transcript })
    if (result?.cancelled) return
    if (!result.success) {
      transitionRef.current(STATES.ERROR, { message: 'Workflow mapping failed. Please try again.' })
      return
    }

    const parsed = parseWorkflowAnalysis(result.prompt)
    if (!parsed) {
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

    const result = await window.electronAPI.builderStep('workflow-assemble', { ANALYSIS: JSON.stringify(analysis, null, 2), PLACEHOLDERS: JSON.stringify(placeholders, null, 2) })
    if (result?.cancelled) return
    if (!result.success) {
      transitionRef.current(STATES.ERROR, { message: 'JSON assembly failed. Please try again.' })
      return
    }

    // Must be an n8n workflow (nodes + connections), pretty-printed for reading and import.
    let workflow
    try { workflow = parseJsonObject(result.prompt) } catch { workflow = null }
    if (!workflow || !Array.isArray(workflow.nodes) || typeof workflow.connections !== 'object') {
      transitionRef.current(STATES.ERROR, { message: 'JSON assembly failed. Please try again.' })
      return
    }
    const jsonStr = JSON.stringify(workflow, null, 2)

    // History keeps the workflow itself, so it can be copied into n8n again later.
    lastHistoryIdRef.current = saveToHistory({ transcript: originalTranscript.current, prompt: jsonStr, mode: 'workflow' })
    window.electronAPI?.setLastPrompt?.(jsonStr)

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

  const handleDeleteNode = useCallback((nodeId) => {
    setWorkflowAnalysis(prev => {
      if (!prev || prev.nodes.length <= 1) return prev
      return { ...prev, nodes: prev.nodes.filter(n => n.id !== nodeId) }
    })
    setFilledPlaceholders(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => { if (k.startsWith(`${nodeId}-`)) delete next[k] })
      return next
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
    // Toggled in history first, outside the state update, so the button always shows what's stored.
    if (!lastHistoryIdRef.current) return
    setIsSaved(!!bookmarkHistoryItem(lastHistoryIdRef.current))
  }, [])

  const handleWorkflowCopy = useCallback(() => {
    if (!workflowJson) return
    window.electronAPI?.copyToClipboard?.(workflowJson)
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
    onDeleteNode: handleDeleteNode,
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
