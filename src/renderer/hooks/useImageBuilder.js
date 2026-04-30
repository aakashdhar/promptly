import { useState, useRef, useCallback } from 'react'
import { saveToHistory } from '../utils/history.js'

// Inline fence-stripping parse helpers (will be moved to promptUtils.js in IMG2-006)
function fenceParse(raw) {
  try {
    const stripped = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/i, '').trim()
    return JSON.parse(stripped)
  } catch {
    return null
  }
}

function buildPhase1Prompt(transcript) {
  return `You are an expert Nano Banana (Midjourney) prompt engineer.
Analyse the user's spoken image idea and return pre-selected
parameter values across five categories.

User's spoken idea: ${transcript}

Return ONLY valid JSON — no preamble, no markdown fences:
{
  "subject": {
    "subject": "Young woman",
    "setting": "Ocean/beach",
    "emotion": "Serene",
    "framing": "Close-up",
    "negativePrompts": []
  },
  "lighting": {
    "timeOfDay": "Golden hour",
    "lightType": "Directional sun",
    "quality": "Warm amber",
    "lensFlare": "None"
  },
  "camera": {
    "lens": "85mm portrait",
    "aperture": "f/1.4 shallow",
    "aspectRatio": "4:5 portrait",
    "angle": "Eye level",
    "filmSim": "Kodak Portra 400"
  },
  "style": {
    "visualStyle": "Cinematic film still",
    "colorGrade": "Warm teal-orange",
    "filmGrain": "35mm grain",
    "reference": "Emmanuel Lubezki"
  },
  "technical": {
    "resolution": "Ultra HD 4K",
    "renderQuality": "Photorealistic",
    "stylise": 750,
    "chaos": 20,
    "weird": 0,
    "seed": null
  }
}

Rules:
- Only pre-select values you are confident about from the transcript
- Leave a field empty string "" if not mentioned or unclear
- negativePrompts: array of strings the user mentioned avoiding
- For filmSim pick from: Kodak Portra 400, Fuji Velvia, Ilford HP5,
  CineStill 800T, Digital clean, Lomography, Medium format
- For reference pick a relevant photographer/cinematographer if applicable
- For technical params use Nano Banana's actual parameter ranges:
    stylise: 0-1000 (default 100, higher = more stylised; suggest 750 for cinematic)
    chaos: 0-100 (default 0, higher = more varied; suggest 20 for most subjects)
    weird: 0-3000 (default 0; suggest 0 unless user implies surreal)
    seed: null (user sets manually for reproducibility)
- Respond ONLY with the JSON object`
}

function buildVariationsPrompt(transcript) {
  return `You are an expert Nano Banana prompt engineer. Based on this image
idea: ${transcript}

Generate exactly 3 distinct prompt variations. Each variation should
interpret the idea differently — different creative angle, different
emphasis, different mood, while staying true to the core subject.

Return ONLY valid JSON — no preamble, no markdown fences:
{
  "variations": [
    {
      "id": 1,
      "prompt": "complete ready-to-use Nano Banana prompt text",
      "focus": "one short phrase describing the creative angle"
    },
    {
      "id": 2,
      "prompt": "...",
      "focus": "..."
    },
    {
      "id": 3,
      "prompt": "...",
      "focus": "..."
    }
  ]
}

Rules for each variation:
- Write complete, ready-to-use prompts (not fragments)
- 40-80 words per prompt
- Each variation must be meaningfully different from the others
- Include subject, setting, mood, lighting, and technical style
- Do NOT include --parameter flags in the prompt text
- Variation 1: closest to what user described, warm/natural
- Variation 2: more dramatic/editorial interpretation
- Variation 3: most cinematic/artistic interpretation
Respond ONLY with the JSON object`
}

function buildPhase2Prompt(activeVariation, imageAnswers) {
  const negatives = imageAnswers.subject?.negativePrompts || []
  const negativeInstruction = negatives.length > 0
    ? `Avoid these elements: ${negatives.join(', ')}. Do NOT include 'no X' or 'without X' syntax — instead omit those elements entirely.\n`
    : ''
  return `You are an expert Nano Banana prompt engineer. Assemble a final
optimised prompt from these confirmed parameters and selected variation.

Selected variation base: ${activeVariation?.prompt || ''}
Confirmed parameters: ${JSON.stringify(imageAnswers, null, 2)}
${negativeInstruction}
Rules:
1. Use the selected variation as the narrative foundation
2. Weave in all confirmed parameters naturally
3. Word order matters: subject -> setting -> mood -> lighting ->
   camera/technical -> style reference
4. Keep the assembled prompt 60-100 words
5. Do NOT include --parameter flags in the prompt text
6. Append technical flags as a separate "flags" field
7. Return ONLY valid JSON — no markdown fences:
{
  "prompt": "the assembled natural language prompt",
  "flags": "--ar 4:5 --stylize 750 --chaos 20"
}

flags format rules:
- --ar from aspectRatio (e.g. "4:5 portrait" -> "--ar 4:5")
- --stylize from stylise value
- --chaos from chaos value (omit if 0)
- --weird from weird value (omit if 0)
- --seed from seed value (omit if null)`
}

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
  const parsed = fenceParse(raw)
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
  return result
}

function parseVariations(raw, idOffset) {
  const parsed = fenceParse(raw)
  if (!parsed || !Array.isArray(parsed.variations)) return []
  return parsed.variations.map((v, i) => ({
    id: idOffset + i + 1,
    prompt: v.prompt || '',
    focus: v.focus || '',
  }))
}

function parsePhase2(raw) {
  return fenceParse(raw)
}

export default function useImageBuilder({
  STATES,
  transitionRef,
  isExpandedRef,
  originalTranscript,
  resizeWindow,
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

  // Phase 1.5 — fires in background; idOffset=0 replaces list, >0 appends
  const generateVariations = useCallback(async (transcript, idOffset) => {
    if (!window.electronAPI) return
    setIsGeneratingVariations(true)
    const result = await window.electronAPI.generateRaw(buildVariationsPrompt(transcript))
    setIsGeneratingVariations(false)
    if (!result.success) return
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

    const result = await window.electronAPI.generateRaw(buildPhase1Prompt(transcript))
    let newDefaults = deepCopy(EMPTY_DEFAULTS)
    if (result.success) {
      const parsed = parsePhase1(result.prompt)
      if (parsed) newDefaults = parsed
    }

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
    if (!isExpandedRef.current) resizeWindow(520)
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
    const result = await window.electronAPI.generateRaw(buildPhase2Prompt(activeVar, answers))
    if (!result.success) {
      transitionRef.current(STATES.ERROR, { message: 'Could not generate image prompt — try again' })
      return
    }
    const parsed = parsePhase2(result.prompt)
    const builtPrompt = parsed?.prompt && parsed?.flags
      ? `${parsed.prompt}\n\n${parsed.flags}`
      : result.prompt.trim()
    setImageBuiltPrompt(builtPrompt)
    saveToHistory({ transcript: originalTranscript.current, prompt: builtPrompt, mode: 'image' })
    window.electronAPI?.setLastPrompt?.(builtPrompt)
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
    generateVariations(originalTranscript.current, imageVariations.length)
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
    onStartOver: () => { handleImageStartOver(); transitionRef.current(STATES.IMAGE_BUILDER) },
  }

  return {
    imageBuiltPrompt,
    isReiteratingRef,
    runPreSelection,
    handleImageStartOver,
    imageBuilderProps,
  }
}
