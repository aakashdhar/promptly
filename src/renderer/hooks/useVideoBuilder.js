import { useState, useRef, useCallback } from 'react'
import { saveToHistory } from '../utils/history.js'

const EMPTY_DEFAULTS = {
  cameraMovement: [],
  shotType: [],
  aspectRatio: '16:9',
  resolution: '1080p',
  cinematicStyle: [],
  lighting: [],
  colourGrade: [],
  pacing: [],
  audio: [],
  useFirstFrame: false,
  referenceImages: false,
}

// Chip/select params used in reiterate merge (excludes text inputs and booleans)
export const VIDEO_PARAM_CONFIG = [
  { key: 'cameraMovement', multi: true },
  { key: 'shotType', multi: true },
  { key: 'aspectRatio', multi: false },
  { key: 'resolution', multi: false },
  { key: 'cinematicStyle', multi: true },
  { key: 'lighting', multi: true },
  { key: 'colourGrade', multi: true },
  { key: 'pacing', multi: true },
  { key: 'audio', multi: true },
]

const ORANGE = 'rgba(251,146,60,0.8)'

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj))
}

export default function useVideoBuilder({
  STATES,
  transitionRef,
  originalTranscript,
  setThinkTranscript,
  setThinkingLabel,
  setThinkingAccentColor,
}) {
  const [videoDefaults, setVideoDefaults] = useState(deepCopy(EMPTY_DEFAULTS))
  const [videoAnswers, setVideoAnswers] = useState(deepCopy(EMPTY_DEFAULTS))
  const [videoBuiltPrompt, setVideoBuiltPrompt] = useState('')
  const [showVideoAdvanced, setShowVideoAdvanced] = useState(false)
  const [videoActivePickerParam, setVideoActivePickerParam] = useState(null)
  const [removedByUser, setRemovedByUser] = useState({})
  const [videoDialogueText, setVideoDialogueText] = useState('')
  const [videoSettingDetail, setVideoSettingDetail] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const isReiteratingRef = useRef(false)

  const assembleVideoPrompt = useCallback(async (answers, dialogueText, settingDetail) => {
    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
      return
    }
    setThinkingLabel('Assembling prompt...')
    setThinkingAccentColor?.(ORANGE)
    setThinkTranscript(originalTranscript.current)
    transitionRef.current(STATES.THINKING)

    const mergedAnswers = { ...answers, dialogueText, settingDetail }

    const systemPrompt = `You are an expert video prompt engineer for Veo 3.1.
Assemble the following parameters into a single flowing natural language video generation prompt. Do NOT use section headers.

User's spoken idea: ${originalTranscript.current}
Selected parameters: ${JSON.stringify(mergedAnswers, null, 2)}

Rules:
1. Start with the subject and main action from the transcript
2. Weave camera movement in naturally — it's the most important element
3. Include aspect ratio and resolution as natural phrases
4. If dialogueText was specified, include it in quotes
5. Audio direction goes near the end
6. Be specific and cinematic — avoid vague adjectives
7. Maximum 80 words — concise but complete
8. Output ONLY the prompt — no preamble, no explanation`

    const genResult = await window.electronAPI.generateRaw(systemPrompt)
    if (!genResult.success) {
      transitionRef.current(STATES.ERROR, { message: "Couldn't assemble prompt — tap to try again" })
      return
    }
    setVideoBuiltPrompt(genResult.prompt)
    setIsSaved(false)
    saveToHistory({
      transcript: originalTranscript.current,
      prompt: genResult.prompt,
      mode: 'video',
      videoAnswers: { ...answers, dialogueText, settingDetail },
    })
    window.electronAPI?.setLastPrompt?.(genResult.prompt)
    transitionRef.current(STATES.VIDEO_BUILDER_DONE)
  }, [])

  // Phase 1: pre-selection Claude call. isReiterate=true → merge with existing answers.
  const runPreSelection = useCallback(async (transcript, isReiterate = false) => {
    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
      return
    }

    const systemPrompt = `You are an expert video prompt engineer for Veo 3.1 (Google's video generation model). Analyse the user's spoken idea and return a JSON object with pre-selected values for each parameter.

User's spoken idea: ${transcript}

Return ONLY valid JSON, no preamble, no explanation, no markdown:
{
  "cameraMovement": ["Slow push-in"],
  "shotType": ["Medium"],
  "aspectRatio": "16:9",
  "resolution": "1080p",
  "cinematicStyle": ["Cinematic film"],
  "lighting": ["Golden hour"],
  "colourGrade": ["Teal & orange"],
  "pacing": ["Slow cuts"],
  "audio": ["Ambient sound"],
  "settingDetail": "",
  "useFirstFrame": false,
  "referenceImages": false
}

Rules:
- Only pre-select values you are confident about from the transcript
- Arrays can have multiple values if clearly implied
- Leave arrays empty [] if not mentioned
- Leave strings empty "" if not mentioned
- aspectRatio default: "16:9"
- resolution default: "1080p"
- useFirstFrame default: false
- referenceImages default: false
- Respond ONLY with the JSON object`

    const genResult = await window.electronAPI.generateRaw(systemPrompt)
    if (!genResult.success) {
      setVideoDefaults(deepCopy(EMPTY_DEFAULTS))
      setVideoAnswers(deepCopy(EMPTY_DEFAULTS))
      transitionRef.current(STATES.ERROR, { message: "Couldn't analyse your idea — tap to try again" })
      return
    }

    let parsed = {}
    try {
      parsed = JSON.parse(genResult.prompt.replace(/```json\n?|\n?```/g, '').trim())
    } catch {}

    const { settingDetail: newSettingDetail = '', ...chipFields } = parsed
    const newDefaults = { ...deepCopy(EMPTY_DEFAULTS), ...chipFields }

    if (isReiterate) {
      setVideoDefaults(newDefaults)
      setVideoAnswers(prev => {
        const merged = {}
        for (const { key, multi } of VIDEO_PARAM_CONFIG) {
          const oldDef = videoDefaults[key]
          const removed = removedByUser[key] || []
          if (multi) {
            const prevValues = Array.isArray(prev[key]) ? prev[key] : []
            const oldDefArr = Array.isArray(oldDef) ? oldDef : []
            const userChips = prevValues.filter(v => !oldDefArr.includes(v))
            const newAiChips = (Array.isArray(newDefaults[key]) ? newDefaults[key] : [])
              .filter(v => !removed.includes(v))
            const seen = new Set()
            merged[key] = [...newAiChips, ...userChips].filter(v => {
              if (seen.has(v)) return false
              seen.add(v)
              return true
            })
          } else {
            const newVal = newDefaults[key]
            if (newVal != null && newVal !== '' && !removed.includes(newVal)) {
              merged[key] = newVal
            } else {
              const oldDefVal = typeof oldDef === 'string' ? oldDef : ''
              merged[key] = (prev[key] && prev[key] !== oldDefVal) ? prev[key] : ''
            }
          }
        }
        // boolean toggles always refreshed from new defaults on reiterate
        merged.useFirstFrame = newDefaults.useFirstFrame ?? false
        merged.referenceImages = newDefaults.referenceImages ?? false
        return merged
      })
      // preserve user-entered text on reiterate
    } else {
      setVideoDefaults(newDefaults)
      setVideoAnswers(deepCopy(newDefaults))
      setVideoSettingDetail(newSettingDetail)
      setVideoDialogueText('')
      setRemovedByUser({})
    }

    transitionRef.current(STATES.VIDEO_BUILDER)
  }, [videoDefaults, removedByUser])

  function handleVideoChipRemove(param, value) {
    setRemovedByUser(prev => ({ ...prev, [param]: [...(prev[param] || []), value] }))
    setVideoAnswers(prev => {
      const cfg = VIDEO_PARAM_CONFIG.find(p => p.key === param)
      if (!cfg) return prev
      if (cfg.multi) {
        return { ...prev, [param]: (Array.isArray(prev[param]) ? prev[param] : []).filter(v => v !== value) }
      }
      return { ...prev, [param]: '' }
    })
  }

  function handleVideoChipAdd(param, value) {
    setVideoAnswers(prev => {
      const cfg = VIDEO_PARAM_CONFIG.find(p => p.key === param)
      if (!cfg) return prev
      if (cfg.multi) {
        const cur = Array.isArray(prev[param]) ? prev[param] : []
        if (cur.includes(value)) return prev
        return { ...prev, [param]: [...cur, value] }
      }
      return { ...prev, [param]: value }
    })
  }

  function handleVideoParamChange(param, value) {
    setVideoAnswers(prev => ({ ...prev, [param]: value }))
  }

  function handleVideoOpenPicker(param) { setVideoActivePickerParam(param) }
  function handleVideoClosePicker() { setVideoActivePickerParam(null) }
  function handleVideoToggleAdvanced() { setShowVideoAdvanced(prev => !prev) }

  function handleVideoConfirm() {
    assembleVideoPrompt(videoAnswers, videoDialogueText, videoSettingDetail)
  }

  // In VIDEO_BUILDER: copies raw transcript
  function handleVideoCopyNow() {
    window.electronAPI?.copyToClipboard?.(originalTranscript.current)
  }

  // In VIDEO_BUILDER_DONE: copies assembled prompt
  function handleVideoCopyPrompt() {
    window.electronAPI?.copyToClipboard?.(videoBuiltPrompt)
  }

  function handleVideoDialogueChange(text) { setVideoDialogueText(text) }
  function handleVideoSettingChange(text) { setVideoSettingDetail(text) }

  function handleVideoSave() {
    if (isSaved) return
    window.electronAPI?.setLastPrompt?.(videoBuiltPrompt)
    setIsSaved(true)
  }

  function handleVideoStartOver() {
    setVideoDefaults(deepCopy(EMPTY_DEFAULTS))
    setVideoAnswers(deepCopy(EMPTY_DEFAULTS))
    setVideoBuiltPrompt('')
    setShowVideoAdvanced(false)
    setVideoActivePickerParam(null)
    setRemovedByUser({})
    setVideoDialogueText('')
    setVideoSettingDetail('')
    setIsSaved(false)
    isReiteratingRef.current = false
    transitionRef.current(STATES.IDLE)
  }

  function handleVideoEditAnswers() {
    setVideoBuiltPrompt('')
    transitionRef.current(STATES.VIDEO_BUILDER)
  }

  return {
    videoDefaults,
    videoAnswers,
    videoBuiltPrompt,
    showVideoAdvanced,
    videoActivePickerParam,
    videoDialogueText,
    videoSettingDetail,
    isSaved,
    isReiteratingRef,
    runPreSelection,
    assembleVideoPrompt,
    handleVideoChipRemove,
    handleVideoChipAdd,
    handleVideoParamChange,
    handleVideoOpenPicker,
    handleVideoClosePicker,
    handleVideoToggleAdvanced,
    handleVideoConfirm,
    handleVideoCopyNow,
    handleVideoCopyPrompt,
    handleVideoDialogueChange,
    handleVideoSettingChange,
    handleVideoSave,
    handleVideoStartOver,
    handleVideoEditAnswers,
  }
}
