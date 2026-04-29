import { useState, useRef, useCallback } from 'react'
import { PARAM_CONFIG } from '../components/ImageBuilderState.jsx'
import { saveToHistory } from '../utils/history.js'

const EMPTY_DEFAULTS = {
  model: 'Nano Banana 2', useCase: '', style: [], lighting: [],
  aspectRatio: '', subjectDetail: [], composition: [], cameraAngle: [],
  colourPalette: [], background: [], mood: [], resolution: '',
  lens: [], textInImage: '', detailLevel: '', avoid: [],
  surfaceMaterial: [], postProcessing: [],
}

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj))
}

export default function useImageBuilder({
  STATES,
  transitionRef,
  isExpandedRef,
  originalTranscript,
  resizeWindow,
  setThinkTranscript,
  setThinkingLabel,
  startRecordingRef,
}) {
  const [imageDefaults, setImageDefaults] = useState(deepCopy(EMPTY_DEFAULTS))
  const [imageAnswers, setImageAnswers] = useState(deepCopy(EMPTY_DEFAULTS))
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activePickerParam, setActivePickerParam] = useState(null)
  const [removedByUser, setRemovedByUser] = useState({})
  const [imageBuiltPrompt, setImageBuiltPrompt] = useState('')
  const isReiteratingRef = useRef(false)

  const assembleImagePrompt = useCallback(async (answers) => {
    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
      return
    }
    setThinkingLabel('Assembling prompt...')
    setThinkTranscript(originalTranscript.current)
    transitionRef.current(STATES.THINKING)

    const modelLine = answers.model ? `The user has selected the following model: ${answers.model}` : ''
    const useCaseLine = answers.useCase ? `The use case is: ${answers.useCase}` : ''
    const proLine = answers.model === 'Nano Banana Pro'
      ? `Since Nano Banana Pro was selected, add 'high fidelity' and 'precise text rendering' to the prompt.`
      : ''
    const resolutionLine = answers.resolution && answers.resolution !== 'Standard quality'
      ? `A resolution level was specified ('${answers.resolution}'). Weave those keywords into the prompt naturally rather than appending them.`
      : ''

    const systemPrompt = `You are an expert image prompt engineer for Nano Banana (Google Gemini image generation) and ChatGPT image generation. The user has spoken a rough image idea and selected parameters through a guided review.

Assemble these into a single, flowing natural language image generation prompt. Do NOT use section headers or structured formatting. Write it as one or two paragraphs of vivid, specific description that image generation models respond to.
${modelLine ? '\n' + modelLine : ''}${useCaseLine ? '\n' + useCaseLine : ''}

Start the prompt appropriately for the use case:
- Photorealistic scene: start with 'A photo of...'
- Product mockup / commercial: start with 'Professional product shot of...'
- 3D render / isometric: start with 'A perfectly isometric 3D scene of...'
- Stylized illustration / sticker: start with 'A stylized illustration of...'
- Icon / UI asset: start with 'An icon of...'
- Infographic / text layout: start with 'An infographic showing...'
- Style transfer: start with 'Apply [style] to...'
If no use case was selected, infer a natural opening from the transcript.
${proLine ? '\n' + proLine : ''}${resolutionLine ? '\n' + resolutionLine : ''}

User's spoken idea: ${originalTranscript.current}
Selected parameters: ${JSON.stringify(answers, null, 2)}

Rules:
1. Weave the parameters naturally into the description
2. Be specific and vivid — avoid vague adjectives
3. Put the most important visual elements first
4. Include the aspect ratio as a natural phrase
5. If text was specified, include it in quotes
6. End with any negative specifications (what to avoid)
7. Maximum 60 words — concise but complete
8. Output ONLY the prompt — no preamble, no explanation`

    const genResult = await window.electronAPI.generateRaw(systemPrompt)
    if (!genResult.success) {
      transitionRef.current(STATES.ERROR, { message: 'Could not generate image prompt — try again' })
      return
    }
    setImageBuiltPrompt(genResult.prompt)
    saveToHistory({ transcript: originalTranscript.current, prompt: genResult.prompt, mode: 'image', imageAnswers: answers })
    window.electronAPI?.setLastPrompt?.(genResult.prompt)
    transitionRef.current(STATES.IMAGE_BUILDER_DONE)
  }, [])

  // Phase 1: pre-selection Claude call. isReiterate=true → merge with existing answers.
  const runPreSelection = useCallback(async (transcript, isReiterate = false) => {
    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
      return
    }

    const systemPrompt = `You are an expert image prompt engineer for Nano Banana (Google Gemini image generation). Analyse the user's spoken idea and return a JSON object with pre-selected values for each parameter.

User's spoken idea: ${transcript}

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
- Respond ONLY with the JSON object`

    const genResult = await window.electronAPI.generateRaw(systemPrompt)
    let newDefaults = deepCopy(EMPTY_DEFAULTS)
    if (genResult.success) {
      try {
        const parsed = JSON.parse(genResult.prompt.replace(/```json\n?|\n?```/g, '').trim())
        newDefaults = { ...EMPTY_DEFAULTS, ...parsed }
      } catch {}
    }

    if (isReiterate) {
      // Merge: preserve user-added chips, refresh AI chips, respect removedByUser
      setImageAnswers(prev => {
        const merged = {}
        setImageDefaults(newDefaults)
        for (const { key, multi } of PARAM_CONFIG) {
          const oldDef = imageDefaults[key]
          const removed = removedByUser[key] || []
          if (multi) {
            const prevValues = Array.isArray(prev[key]) ? prev[key] : []
            const oldDefArr = Array.isArray(oldDef) ? oldDef : []
            // user-added = in answers but NOT in old AI defaults
            const userChips = prevValues.filter(v => !oldDefArr.includes(v))
            // new AI chips filtered through removedByUser
            const newAiChips = (Array.isArray(newDefaults[key]) ? newDefaults[key] : [])
              .filter(v => !removed.includes(v))
            // combine, dedup
            const seen = new Set()
            merged[key] = [...newAiChips, ...userChips].filter(v => { if (seen.has(v)) return false; seen.add(v); return true })
          } else {
            const newVal = newDefaults[key]
            if (newVal && !removed.includes(newVal)) {
              merged[key] = newVal
            } else {
              // keep old user value if it wasn't an AI default, else keep empty
              const oldDefVal = typeof oldDef === 'string' ? oldDef : ''
              merged[key] = (prev[key] && prev[key] !== oldDefVal) ? prev[key] : ''
            }
          }
        }
        return merged
      })
    } else {
      setImageDefaults(newDefaults)
      setImageAnswers(deepCopy(newDefaults))
      setRemovedByUser({})
    }

    transitionRef.current(STATES.IMAGE_BUILDER)
    if (!isExpandedRef.current) resizeWindow(520)
  }, [imageDefaults, removedByUser])

  function handleChipRemove(param, value) {
    setRemovedByUser(prev => ({
      ...prev,
      [param]: [...(prev[param] || []), value],
    }))
    setImageAnswers(prev => {
      const cfg = PARAM_CONFIG.find(p => p.key === param)
      if (!cfg) return prev
      if (cfg.multi) {
        return { ...prev, [param]: (Array.isArray(prev[param]) ? prev[param] : []).filter(v => v !== value) }
      }
      return { ...prev, [param]: '' }
    })
  }

  function handleChipAdd(param, value) {
    setImageAnswers(prev => {
      const cfg = PARAM_CONFIG.find(p => p.key === param)
      if (!cfg) return prev
      if (cfg.multi) {
        const cur = Array.isArray(prev[param]) ? prev[param] : []
        if (cur.includes(value)) return prev
        return { ...prev, [param]: [...cur, value] }
      }
      return { ...prev, [param]: value }
    })
  }

  function handleParamChange(param, value) {
    setImageAnswers(prev => ({ ...prev, [param]: value }))
  }

  function handleOpenPicker(param) {
    setActivePickerParam(param)
  }

  function handleClosePicker() {
    setActivePickerParam(null)
  }

  function handleToggleAdvanced() {
    setShowAdvanced(prev => !prev)
  }

  function handleConfirm() {
    assembleImagePrompt(imageAnswers)
  }

  function handleCopyNow() {
    assembleImagePrompt(imageAnswers)
  }

  function handleImageStartOver() {
    setImageDefaults(deepCopy(EMPTY_DEFAULTS))
    setImageAnswers(deepCopy(EMPTY_DEFAULTS))
    setShowAdvanced(false)
    setActivePickerParam(null)
    setRemovedByUser({})
    isReiteratingRef.current = false
  }

  function handleImageEditAnswers() {
    transitionRef.current(STATES.IMAGE_BUILDER)
    if (!isExpandedRef.current) resizeWindow(520)
  }

  const imageBuilderProps = {
    transcript: originalTranscript.current,
    imageDefaults,
    imageAnswers,
    showAdvanced,
    activePickerParam,
    imageBuiltPrompt,
    onChipRemove: handleChipRemove,
    onChipAdd: handleChipAdd,
    onParamChange: handleParamChange,
    onToggleAdvanced: handleToggleAdvanced,
    onOpenPicker: handleOpenPicker,
    onClosePicker: handleClosePicker,
    onConfirm: handleConfirm,
    onCopyNow: handleCopyNow,
    onReiterate: () => { isReiteratingRef.current = true; startRecordingRef?.current?.() },
    onEditAnswers: handleImageEditAnswers,
    onStartOver: () => { handleImageStartOver(); transitionRef.current(STATES.IMAGE_BUILDER) },
  }

  return {
    imageDefaults,
    imageAnswers,
    showAdvanced,
    activePickerParam,
    imageBuiltPrompt,
    isReiteratingRef,
    runPreSelection,
    handleChipRemove,
    handleChipAdd,
    handleParamChange,
    handleOpenPicker,
    handleClosePicker,
    handleToggleAdvanced,
    handleConfirm,
    handleCopyNow,
    handleImageStartOver,
    handleImageEditAnswers,
    imageBuilderProps,
  }
}
