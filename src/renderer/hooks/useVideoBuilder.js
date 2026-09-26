import { useState, useRef, useCallback } from 'react'
import { saveToHistory, bookmarkHistoryItem } from '../utils/history.js'
import { parseVideoDefaults } from '../utils/promptUtils.js'
import { CHIP_ROWS, chipOptionsText } from '../components/VideoBuilderState.constants.js'

const EMPTY_DEFAULTS = {
  cameraMovement: [],
  shotType: [],
  aspectRatio: '16:9 landscape',
  resolution: '1080p',
  duration: '8 seconds',
  cinematicStyle: [],
  lighting: [],
  colourGrade: [],
  pacing: [],
  audio: [],
}

// Claude's picks, matched to the chips on screen ("16:9" → "16:9 landscape", "4K" → "4K ✦");
// anything that matches no chip is dropped, so every value can be seen and changed.
function matchChips(defaults) {
  const out = { ...defaults }
  for (const { key, multi, options } of CHIP_ROWS) {
    const find = (v) => options.find((o) => o.toLowerCase() === String(v).toLowerCase())
      || options.find((o) => o.toLowerCase().startsWith(String(v).toLowerCase()))
    if (multi) out[key] = [...new Set((Array.isArray(out[key]) ? out[key] : []).map(find).filter(Boolean))]
    else out[key] = (out[key] && find(out[key])) || EMPTY_DEFAULTS[key] || ''
  }
  return out
}

// Chip/select params used in reiterate merge (excludes text inputs and booleans)
export const VIDEO_PARAM_CONFIG = [
  { key: 'cameraMovement', multi: true },
  { key: 'shotType', multi: true },
  { key: 'aspectRatio', multi: false },
  { key: 'resolution', multi: false },
  { key: 'duration', multi: false },
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
  startRecordingRef,
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
  const lastHistoryIdRef = useRef(null)

  const assembleVideoPrompt = useCallback(async (answers, dialogueText, settingDetail) => {
    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
      return
    }
    setThinkingLabel('Assembling prompt...')
    setThinkingAccentColor?.(ORANGE)
    setThinkTranscript(originalTranscript.current)
    transitionRef.current(STATES.THINKING)

    const mergedAnswers = { ...answers, ...(dialogueText.trim() && { dialogueText }), settingDetail }
    const genResult = await window.electronAPI.builderStep('video-assemble', { TRANSCRIPT: originalTranscript.current, ANSWERS: JSON.stringify(mergedAnswers, null, 2) })
    if (genResult?.cancelled) return
    if (!genResult.success) {
      transitionRef.current(STATES.ERROR, { message: "Couldn't write the video prompt. Try again." })
      return
    }
    setVideoBuiltPrompt(genResult.prompt)
    setIsSaved(false)
    lastHistoryIdRef.current = saveToHistory({ transcript: originalTranscript.current, prompt: genResult.prompt, mode: 'video' })
    window.electronAPI?.setLastPrompt?.(genResult.prompt)
    transitionRef.current(STATES.VIDEO_BUILDER_DONE)
  }, [])

  // Phase 1: pre-selection Claude call. isReiterate=true → merge with existing answers.
  const runPreSelection = useCallback(async (transcript, isReiterate = false) => {
    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
      return
    }

    const genResult = await window.electronAPI.builderStep('video-analyse', { TRANSCRIPT: transcript, OPTIONS: chipOptionsText() })
    if (genResult?.cancelled) return
    if (!genResult.success) {
      setVideoDefaults(deepCopy(EMPTY_DEFAULTS))
      setVideoAnswers(deepCopy(EMPTY_DEFAULTS))
      transitionRef.current(STATES.ERROR, { message: "Couldn't read your video idea. Try again." })
      return
    }

    const parsedDefaults = parseVideoDefaults(genResult.prompt, EMPTY_DEFAULTS)
    const newDefaults = matchChips(parsedDefaults.defaults)
    const newSettingDetail = parsedDefaults.settingDetail

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

  // In VIDEO_BUILDER_DONE: copies assembled prompt
  function handleVideoCopyPrompt() {
    window.electronAPI?.copyToClipboard?.(videoBuiltPrompt)
  }

  function handleVideoDialogueChange(text) { setVideoDialogueText(text) }
  function handleVideoSettingChange(text) { setVideoSettingDetail(text) }

  // Save = keep it in history's Saved list, the same as every other mode.
  function handleVideoSave() {
    if (!lastHistoryIdRef.current) return
    setIsSaved(!!bookmarkHistoryItem(lastHistoryIdRef.current))
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

  const videoBuilderProps = {
    transcript: originalTranscript.current,
    videoDefaults,
    videoAnswers,
    showAdvanced: showVideoAdvanced,
    activePickerParam: videoActivePickerParam,
    dialogueText: videoDialogueText,
    settingDetail: videoSettingDetail,
    videoBuiltPrompt,
    isSaved,
    onChipRemove: handleVideoChipRemove,
    onChipAdd: handleVideoChipAdd,
    onParamChange: handleVideoParamChange,
    onToggleAdvanced: handleVideoToggleAdvanced,
    onOpenPicker: handleVideoOpenPicker,
    onClosePicker: handleVideoClosePicker,
    onDialogueChange: handleVideoDialogueChange,
    onSettingChange: handleVideoSettingChange,
    onConfirm: handleVideoConfirm,
    onCopyPrompt: handleVideoCopyPrompt,
    onReiterate: () => { isReiteratingRef.current = true; startRecordingRef?.current?.() },
    onEditAnswers: handleVideoEditAnswers,
    onStartOver: handleVideoStartOver,
    onSave: handleVideoSave,
  }

  return {
    isReiteratingRef,
    runPreSelection,
    handleVideoStartOver,
    videoBuilderProps,
  }
}
