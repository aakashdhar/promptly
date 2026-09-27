import { useState, useRef, useEffect, useCallback } from 'react'

// Copy buttons: "Copied" only shows once the text is really on the clipboard, one timer per
// hook (a second copy restarts it, unmounting clears it). `copied` holds the key of the button
// that last copied, for screens with several.
// writer(text) replaces the default clipboard call when a screen copies through a prop.
export default function useCopy(ms = 1800) {
  const [copied, setCopied] = useState('')
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback(async (text, key = 'copied', writer) => {
    if (typeof text !== 'string' || !text) return false
    let ok
    try {
      const result = await (writer ? writer(text) : window.electronAPI?.copyToClipboard?.(text))
      ok = result !== false && result?.success !== false
    } catch {
      ok = false
    }
    if (!ok) return false
    clearTimeout(timer.current)
    setCopied(key)
    timer.current = setTimeout(() => setCopied(''), ms)
    return true
  }, [ms])

  // A new result on screen: nothing of it has been copied yet.
  const reset = useCallback(() => { clearTimeout(timer.current); setCopied('') }, [])

  return { copied, copy, reset }
}
