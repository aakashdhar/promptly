import { useState, useRef, useCallback } from 'react'
import { saveToHistory } from '../utils/history.js'
import { parseImageAnalysisOutput, buildImagePromptText, splitImagePrompt } from '../utils/promptUtils.js'
import { TECHNICAL_NUMERIC_PARAMS } from '../components/ImageBuilderState.constants.js'

const EMPTY_DEFAULTS = {
  subject:   { subject: '', setting: '', emotion: '', framing: '', negativePrompts: [] },
  lighting:  { timeOfDay: '', lightType: '', quality: '', lensFlare: '' },
  camera:    { lens: '', aperture: '', aspectRatio: '', angle: '', filmSim: '' },
  style:     { visualStyle: '', colorGrade: '', filmGrain: '', reference: '' },
  technical: { resolution: '', renderQuality: '', stylise: '', chaos: '', weird: '', seed: null },
}

const TABS = ['subject', 'lighting', 'camera', 'style', 'technical']

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function parsePhase1(raw) {
  const parsed = parseImageAnalysisOutput(raw)
  if (!parsed || typeof parsed !== 'object') return null
  const result = deepCopy(EMPTY_DEFAULTS)
  for (const tab of TABS) {
    if (parsed[tab] && typeof parsed[tab] === 'object') {
      result[tab] = { ...EMPTY_DEFAULTS[tab], ...parsed[tab] }
    }
  }
  result.subject.negativePrompts = Array.isArray(parsed.subject?.negativePrompts)
    ? parsed.subject.negativePrompts
    : []
  // Numbers snap to the nearest chip, so every value on screen can be seen and changed.
  for (const [field, options] of Object.entries(TECHNICAL_NUMERIC_PARAMS)) {
    const n = Number(result.technical[field])
    if (result.technical[field] === '' || result.technical[field] === null || Number.isNaN(n)) { result.technical[field] = ''; continue }
    result.technical[field] = options.reduce((best, o) => (Math.abs(o.value - n) < Math.abs(best.value - n) ? o : best)).value
  }
  return result
}

function parseVariations(raw, idOffset) {
  const parsed = parseImageAnalysisOutput(raw)
  if (!parsed || !Array.isArray(parsed.variations)) return []
  return parsed.variations.map((v, i) => ({
    id: idOffset + i + 1,
    prompt: v.prompt || '',
    focus: v.focus || '',
  }))
}

export default function useImageBuilder({
  STATES,
  transitionRef,
  originalTranscript,
  setThinkTranscript,
  setThinkingLabel,
  setThinkingAccentColor,
  startRecordingRef,
}) {
  const [imageDefaults, setImageDefaults] = useState(deepCopy(EMPTY_DEFAULTS))
  const [imageAnswers, setImageAnswers] = useState(deepCopy(EMPTY_DEFAULTS))
  const [removedByUser, setRemovedByUser] = useState({})
  const [imageBuiltPrompt, setImageBuiltPrompt] = useState('')
  const [imageVariations, setImageVariations] = useState([])
  const [selectedVariation, setSelectedVariation] = useState(1)
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false)
  const [activePreset, setActivePreset] = useState(null)
  const isReiteratingRef = useRef(false)
  // Bumped by Start over, so a variations call still running can't land in a fresh builder.
  const runIdRef = useRef(0)

  // Phase 1.5 — fires in background; idOffset=0 replaces list, >0 appends (and is told what's
  // already shown, so "3 more" are new ideas rather than repeats)
  const generateVariations = useCallback(async (transcript, idOffset, shown = []) => {
    if (!window.electronAPI) return
    const runId = runIdRef.current
    setIsGeneratingVariations(true)
    const existing = shown.length ? `- Already shown, so take different angles from these:\n${shown.map((p) => `  • ${p}`).join('\n')}\n` : ''
    const result = await window.electronAPI.builderStep('image-variations', { TRANSCRIPT: transcript, EXISTING: existing })
    if (runId !== runIdRef.current) return
    setIsGeneratingVariations(false)
    if (result?.cancelled || !result.success) return
    const newVars = parseVariations(result.prompt, idOffset)
    if (newVars.length === 0) return
    if (idOffset === 0) {
      setImageVariations(newVars)
      setSelectedVariation(1)
    } else {
      setImageVariations(prev => [...prev, ...newVars])
    }
  }, [])

  // Phase 1 — analysis; isReiterate=true preserves user-confirmed values
  const runPreSelection = useCallback(async (transcript, isReiterate = false) => {
    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
      return
    }

    const result = await window.electronAPI.builderStep('image-analyse', { TRANSCRIPT: transcript })
    if (result?.cancelled) return
    const parsed = result.success ? parsePhase1(result.prompt) : null
    if (!parsed) {
      transitionRef.current(STATES.ERROR, { message: "Couldn't read your image idea. Try again." })
      return
    }
    const newDefaults = parsed

    if (isReiterate) {
      // Merge: keep user-confirmed values, update AI-filled values, respect removedByUser
      // Read current state from closure (runPreSelection recreated when they change)
      const mergedAnswers = deepCopy(imageAnswers)
      for (const tab of TABS) {
        for (const field of Object.keys(EMPTY_DEFAULTS[tab])) {
          const key = `${tab}.${field}`
          const removed = removedByUser[key] || []
          if (field === 'negativePrompts') {
            const existing = Array.isArray(imageAnswers[tab]?.negativePrompts)
              ? imageAnswers[tab].negativePrompts
              : []
            const newNeg = Array.isArray(newDefaults[tab]?.negativePrompts)
              ? newDefaults[tab].negativePrompts
              : []
            mergedAnswers[tab].negativePrompts = [
              ...existing,
              ...newNeg.filter(v => !existing.includes(v)),
            ]
          } else {
            const oldAiDefault = imageDefaults[tab]?.[field]
            const currentVal = imageAnswers[tab]?.[field]
            const newAiDefault = newDefaults[tab]?.[field]
            const userChanged = currentVal !== oldAiDefault && currentVal !== ''
            if (!userChanged) {
              mergedAnswers[tab][field] = removed.includes(newAiDefault) ? '' : (newAiDefault ?? '')
            }
            // else keep current user value (already in mergedAnswers from deepCopy)
          }
        }
      }
      setImageDefaults(newDefaults)
      setImageAnswers(mergedAnswers)
      setActivePreset(null)
      setImageVariations([])
      setSelectedVariation(1)
      generateVariations(transcript, 0)
    } else {
      setImageDefaults(newDefaults)
      setImageAnswers(deepCopy(newDefaults))
      setRemovedByUser({})
      setActivePreset(null)
      generateVariations(transcript, 0)
    }

    transitionRef.current(STATES.IMAGE_BUILDER)
  }, [imageDefaults, imageAnswers, removedByUser, generateVariations])

  // Phase 2 — assembly with selected variation as narrative base
  const assembleImagePrompt = useCallback(async (answers) => {
    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
      return
    }
    setThinkingLabel('Assembling prompt...')
    setThinkingAccentColor?.('rgba(139,92,246,0.85)')
    setThinkTranscript(originalTranscript.current)
    transitionRef.current(STATES.THINKING)

    const activeVar = imageVariations.find(v => v.id === selectedVariation) || imageVariations[0] || null
    const negatives = answers.subject?.negativePrompts || []
    const result = await window.electronAPI.builderStep('image-assemble', {
      VARIATION: activeVar?.prompt || '',
      ANSWERS: JSON.stringify(answers, null, 2),
      AVOID: negatives.length ? `Avoid these elements: ${negatives.join(', ')}. Do NOT include 'no X' or 'without X' syntax — instead omit those elements entirely.\n` : '',
    })
    if (result?.cancelled) return
    if (!result.success) {
      transitionRef.current(STATES.ERROR, { message: 'Could not generate image prompt — try again' })
      return
    }
    const builtPrompt = buildImagePromptText(result.prompt)
    setImageBuiltPrompt(builtPrompt)
    saveToHistory({ transcript: originalTranscript.current, prompt: builtPrompt, mode: 'image' })
    // Nano Banana and ChatGPT don't read Midjourney flags, so the copy that goes out is the prompt alone.
    window.electronAPI?.setLastPrompt?.(splitImagePrompt(builtPrompt).prompt)
    transitionRef.current(STATES.IMAGE_BUILDER_DONE)
  }, [imageVariations, selectedVariation])

  // Param handlers
  function handleParamChange(tab, field, value) {
    setImageAnswers(prev => ({
      ...prev,
      [tab]: { ...prev[tab], [field]: value },
    }))
  }

  // Called by ImageBuilderState when user clicks a chip that was AI-pre-filled
  // key format: "tab.field" — prevents that value re-appearing after reiterate
  function handleRemoveDefault(tabField, value) {
    setRemovedByUser(prev => ({
      ...prev,
      [tabField]: [...(prev[tabField] || []), value],
    }))
  }

  function handleSelectVariation(id) {
    setSelectedVariation(id)
  }

  function handleGenerateMoreVariations() {
    generateVariations(originalTranscript.current, imageVariations.length, imageVariations.map((v) => v.prompt))
  }

  function handleApplyPreset(presetName, presetParams) {
    // presetParams: { subject:{...}, lighting:{...}, camera:{...}, style:{...}, technical:{...} }
    if (presetParams) {
      setImageAnswers(prev => {
        const merged = deepCopy(prev)
        for (const tab of TABS) {
          if (presetParams[tab] && typeof presetParams[tab] === 'object') {
            merged[tab] = { ...prev[tab], ...presetParams[tab] }
          }
        }
        return merged
      })
    }
    setActivePreset(presetName)
  }

  function handleSetNegative(text) {
    if (!text.trim()) return
    setImageAnswers(prev => {
      const existing = Array.isArray(prev.subject?.negativePrompts) ? prev.subject.negativePrompts : []
      if (existing.includes(text)) return prev
      return { ...prev, subject: { ...prev.subject, negativePrompts: [...existing, text] } }
    })
  }

  function handleRemoveNegative(text) {
    setImageAnswers(prev => ({
      ...prev,
      subject: {
        ...prev.subject,
        negativePrompts: (prev.subject?.negativePrompts || []).filter(n => n !== text),
      },
    }))
  }

  function handleSetSeed(value) {
    const seed = value === '' || value === null ? null : Number(value)
    setImageAnswers(prev => ({
      ...prev,
      technical: { ...prev.technical, seed },
    }))
  }

  function handleConfirm() {
    assembleImagePrompt(imageAnswers)
  }

  function handleImageStartOver() {
    runIdRef.current++
    setImageDefaults(deepCopy(EMPTY_DEFAULTS))
    setImageAnswers(deepCopy(EMPTY_DEFAULTS))
    setRemovedByUser({})
    setImageBuiltPrompt('')
    setImageVariations([])
    setSelectedVariation(1)
    setIsGeneratingVariations(false)
    setActivePreset(null)
    isReiteratingRef.current = false
  }

  const imageBuilderProps = {
    transcript: originalTranscript.current,
    imageDefaults,
    imageAnswers,
    activePreset,
    imageVariations,
    selectedVariation,
    isGeneratingVariations,
    imageBuiltPrompt,
    onParamChange: handleParamChange,
    onRemoveDefault: handleRemoveDefault,
    onApplyPreset: handleApplyPreset,
    onSelectVariation: handleSelectVariation,
    onGenerateMore: handleGenerateMoreVariations,
    onSetSeed: handleSetSeed,
    onSetNegative: handleSetNegative,
    onRemoveNegative: handleRemoveNegative,
    onConfirm: handleConfirm,
    onEditAnswers: () => transitionRef.current(STATES.IMAGE_BUILDER),
    onReiterate: () => { isReiteratingRef.current = true; startRecordingRef?.current?.() },
    onStartOver: () => { handleImageStartOver(); transitionRef.current(STATES.IDLE) },
  }

  return {
    imageBuiltPrompt,
    isReiteratingRef,
    runPreSelection,
    handleImageStartOver,
    imageBuilderProps,
  }
}
