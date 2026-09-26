import { useState, useRef, useEffect, useCallback } from 'react'
import { saveToHistory } from '../utils/history.js'

// Dictation and "Make it a prompt". A dictation result keeps both versions of what you said:
// the words as spoken (tidied locally, never rewritten) and, once asked for, a prompt built
// from them in your chosen prompt style. The result card switches between the two without
// asking Claude again.
export default function useDictation({ STATES, transitionRef, opIdRef, contextRef, setGeneratedPrompt, setThinkingLabel, setThinkTranscript, setResultMode = () => {} }) {
  const [dictation, setDictation] = useState(null) // { text, removed }
  const [resultView, setResultView] = useState('dictation') // 'dictation' | 'prompt'
  const [promptStyle, setPromptStyle] = useState('balanced')
  const promptVersionRef = useRef(null)
  const dictationRef = useRef(null)
  const promptVersionStyleRef = useRef(null)

  const refreshPromptStyle = useCallback(() => {
    window.electronAPI?.getPreferences?.().then((p) => { if (p?.promptStyle) setPromptStyle(p.promptStyle) })
  }, [])
  useEffect(() => { refreshPromptStyle() }, [refreshPromptStyle])

  function acceptDictation(genResult, transcript) {
    const next = { text: genResult.prompt, removed: genResult.dictation?.removed || [] }
    dictationRef.current = next
    promptVersionRef.current = null
    setDictation(next)
    setResultView('dictation')
    setGeneratedPrompt(next.text)
    setResultMode('dictate')
    window.electronAPI?.setLastPrompt?.(next.text)
    saveToHistory({ transcript, prompt: next.text, mode: 'dictate' })
    transitionRef.current(STATES.PROMPT_READY)
  }

  // A dictation reopened from history: shown as it was, with "As a prompt" one tap away.
  function openDictation(text) {
    const next = { text, removed: [] }
    dictationRef.current = next
    promptVersionRef.current = null
    setDictation(next)
    setResultView('dictation')
    setGeneratedPrompt(text)
    setResultMode('dictate')
    transitionRef.current(STATES.PROMPT_READY)
  }

  function showDictation() {
    if (!dictationRef.current) return
    setGeneratedPrompt(dictationRef.current.text)
    setResultView('dictation')
    setResultMode('dictate')
    window.electronAPI?.setLastPrompt?.(dictationRef.current.text)
  }

  // Turns the dictation into a prompt (once; afterwards the two versions switch instantly).
  async function makePrompt() {
    const source = dictationRef.current
    if (!source || !window.electronAPI) return
    if (promptVersionRef.current) {
      setGeneratedPrompt(promptVersionRef.current)
      setResultView('prompt')
      setResultMode(promptVersionStyleRef.current)
      window.electronAPI.setLastPrompt(promptVersionRef.current)
      return
    }
    const prefs = await window.electronAPI.getPreferences?.()
    const style = prefs?.promptStyle || promptStyle
    setPromptStyle(style)
    const opId = ++opIdRef.current
    setThinkingLabel('Making it a prompt')
    setThinkTranscript(source.text)
    transitionRef.current(STATES.THINKING)
    const result = await window.electronAPI.generatePrompt(source.text, style, contextRef.current ? { context: contextRef.current } : undefined)
    if (opId !== opIdRef.current) return
    setThinkingLabel('')
    if (!result?.success) {
      const message = result?.errorType === 'auth' ? 'Claude Code is signed out. Sign in from Settings (⌘/)' : "Couldn't write the prompt"
      transitionRef.current(STATES.ERROR, { message })
      return
    }
    promptVersionRef.current = result.prompt
    promptVersionStyleRef.current = style
    setGeneratedPrompt(result.prompt)
    setResultView('prompt')
    setResultMode(style)
    window.electronAPI.setLastPrompt(result.prompt)
    saveToHistory({ transcript: source.text, prompt: result.prompt, mode: style })
    transitionRef.current(STATES.PROMPT_READY)
  }

  // Typed text in Dictation mode goes straight to a prompt; "As I said it" shows what you typed.
  function promptFromTyping(text) {
    const next = { text, removed: [] }
    dictationRef.current = next
    promptVersionRef.current = null
    setDictation(next)
    return makePrompt()
  }

  // A new recording or typed request starts fresh.
  function clearDictation() {
    dictationRef.current = null
    promptVersionRef.current = null
    setDictation(null)
    setResultView('dictation')
  }

  return { dictation, resultView, promptStyle, acceptDictation, showDictation, makePrompt, promptFromTyping, clearDictation, refreshPromptStyle, openDictation }
}
