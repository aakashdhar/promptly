import { useState, useEffect, useRef, useCallback } from 'react'
import { PROMPT_TARGETS } from '../utils/modes.js'
import { getTargetVersions, saveTargetVersion } from '../utils/history.js'

const DEFAULT_TARGET = PROMPT_TARGETS[0]?.key

// The "For" picker on a finished prompt: shows it as Promptly wrote it (for Claude) until you pick
// another AI, then asks Promptly's AI to rewrite it for that one. Each version is made once and
// kept (here and on the history entry), so switching back and forth is instant.
export default function usePromptTargets({ prompt, transcript, mode, enabled }) {
  const [target, setTarget] = useState(DEFAULT_TARGET)
  const [versions, setVersions] = useState({})
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const opRef = useRef(0)

  // A new prompt (a new result, an edit, an iteration) starts again as written.
  useEffect(() => {
    opRef.current++
    setTarget(DEFAULT_TARGET)
    setVersions(enabled && prompt ? getTargetVersions(prompt) : {})
    setBusy(null)
    setError('')
  }, [prompt, enabled])

  const pick = useCallback(async (key) => {
    setError('')
    if (key === DEFAULT_TARGET || versions[key]) { opRef.current++; setBusy(null); setTarget(key); return }
    const id = ++opRef.current
    setBusy(key)
    const result = await window.electronAPI?.retargetPrompt?.(prompt, transcript, mode, key)
    if (id !== opRef.current) return
    setBusy(null)
    if (result?.success) {
      setVersions((v) => ({ ...v, [key]: result.prompt }))
      saveTargetVersion(prompt, key, result.prompt)
      setTarget(key)
    } else {
      setError(result?.error || 'Couldn’t rewrite it. Try again.')
    }
  }, [prompt, transcript, mode, versions])

  // Your edit to another AI's version stays with that version.
  const editVersion = useCallback((text) => {
    setVersions((v) => ({ ...v, [target]: text }))
    saveTargetVersion(prompt, target, text)
  }, [prompt, target])

  const isDefault = !enabled || target === DEFAULT_TARGET
  return {
    enabled: !!enabled && PROMPT_TARGETS.length > 1,
    target, isDefault, busy, error, pick, editVersion,
    shown: isDefault ? prompt : versions[target] ?? prompt,
    label: PROMPT_TARGETS.find((t) => t.key === target)?.label || '',
  }
}
