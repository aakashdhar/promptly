import { useState, useCallback } from 'react'
import { QUESTIONS as IMAGE_QUESTIONS } from '../components/ImageBuilderState.jsx'
import { saveToHistory } from '../utils/history.js'

export default function useImageBuilder({
  STATES,
  STATE_HEIGHTS,
  transitionRef,
  isExpandedRef,
  originalTranscript,
  resizeWindow,
  setThinkTranscript,
}) {
  const [imageAnswers, setImageAnswers] = useState({})
  const [imageQuestionIndex, setImageQuestionIndex] = useState(0)
  const [imageBuiltPrompt, setImageBuiltPrompt] = useState('')

  function calcImageBuilderHeight(answers, tier) {
    const base = tier === 1 ? 380 : tier === 2 ? 420 : 400
    const answeredRows = Math.ceil(Object.keys(answers).length / 3)
    return Math.min(base + Math.max(0, answeredRows - 1) * 28, 520)
  }

  const assembleImagePrompt = useCallback(async (answers) => {
    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
      return
    }
    setThinkTranscript(originalTranscript.current)
    transitionRef.current(STATES.THINKING)
    const paramsJson = JSON.stringify(answers, null, 2)
    const modelLine = answers.model ? `The user has selected the following model: ${answers.model}` : ''
    const useCaseLine = answers.use_case ? `The use case is: ${answers.use_case}` : ''
    const proLine = answers.model === 'Nano Banana Pro'
      ? `Since Nano Banana Pro was selected, add 'high fidelity' and 'precise text rendering' to the prompt.`
      : ''
    const resolutionLine = answers.resolution && answers.resolution !== 'Standard quality'
      ? `A resolution level was specified ('${answers.resolution}'). Weave those keywords into the prompt naturally rather than appending them.`
      : ''
    const systemPrompt = `You are an expert image prompt engineer for Nano Banana (Google Gemini image generation) and ChatGPT image generation. The user has spoken a rough image idea and selected parameters through a guided interview.

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
Selected parameters: ${paramsJson}

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
    saveToHistory({ transcript: originalTranscript.current, prompt: genResult.prompt, mode: 'image' })
    window.electronAPI?.setLastPrompt?.(genResult.prompt)
    transitionRef.current(STATES.IMAGE_BUILDER_DONE)
  }, [])

  function handleImageSelect(param, value) {
    setImageAnswers((prev) => ({ ...prev, [param]: value }))
  }

  function handleImageNext(customValue) {
    const q = IMAGE_QUESTIONS[imageQuestionIndex]
    const resolvedAnswers = customValue != null
      ? { ...imageAnswers, [q.param]: customValue }
      : imageAnswers
    const hasSelection = resolvedAnswers[q.param] != null
    if (q.tier <= 2 && !hasSelection) return
    if (customValue != null) setImageAnswers(resolvedAnswers)
    if (imageQuestionIndex === IMAGE_QUESTIONS.length - 1) {
      assembleImagePrompt(resolvedAnswers)
      return
    }
    const nextIndex = imageQuestionIndex + 1
    const nextTier = IMAGE_QUESTIONS[nextIndex].tier
    const nextHeight = calcImageBuilderHeight(resolvedAnswers, nextTier)
    setImageQuestionIndex(nextIndex)
    if (!isExpandedRef.current) resizeWindow(nextHeight)
  }

  function handleImageBack() {
    if (imageQuestionIndex === 0) return
    const prevIndex = imageQuestionIndex - 1
    const prevTier = IMAGE_QUESTIONS[prevIndex].tier
    const prevHeight = calcImageBuilderHeight(imageAnswers, prevTier)
    setImageQuestionIndex(prevIndex)
    if (!isExpandedRef.current) resizeWindow(prevHeight)
  }

  function handleImageSkip() {
    const q = IMAGE_QUESTIONS[imageQuestionIndex]
    const newAnswers = { ...imageAnswers }
    delete newAnswers[q.param]
    setImageAnswers(newAnswers)
    if (imageQuestionIndex === IMAGE_QUESTIONS.length - 1) {
      assembleImagePrompt(newAnswers)
      return
    }
    const nextIndex = imageQuestionIndex + 1
    const nextTier = IMAGE_QUESTIONS[nextIndex].tier
    const nextHeight = calcImageBuilderHeight(newAnswers, nextTier)
    setImageQuestionIndex(nextIndex)
    if (!isExpandedRef.current) resizeWindow(nextHeight)
  }

  function handleImageCopyNow() {
    assembleImagePrompt(imageAnswers)
  }

  function handleImageStartOver() {
    setImageAnswers({})
    setImageQuestionIndex(0)
    if (!isExpandedRef.current) resizeWindow(STATE_HEIGHTS.IMAGE_BUILDER)
  }

  function handleImageEditAnswers() {
    setImageQuestionIndex(0)
    if (!isExpandedRef.current) resizeWindow(STATE_HEIGHTS.IMAGE_BUILDER)
    transitionRef.current(STATES.IMAGE_BUILDER)
  }

  return {
    imageAnswers,
    setImageAnswers,
    imageQuestionIndex,
    setImageQuestionIndex,
    imageBuiltPrompt,
    assembleImagePrompt,
    handleImageSelect,
    handleImageNext,
    handleImageBack,
    handleImageSkip,
    handleImageCopyNow,
    handleImageStartOver,
    handleImageEditAnswers,
  }
}
