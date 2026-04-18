import { useState, useRef, useEffect } from 'react'

function renderPromptOutput(text) {
  if (!text) return null
  const lines = text.split('\n')
  const result = []
  let buf = []
  let key = 0

  function flush() {
    const t = buf.join('\n').trim()
    if (t) {
      result.push(<span key={key++}>{t}</span>)
    }
    buf = []
  }

  for (const line of lines) {
    const m = line.trim().match(/^([A-Za-z][A-Za-z\s]*):\s*$/)
    if (m) {
      flush()
      result.push(<span key={key++} className="pt-sl">{m[1].trim()}</span>)
    } else {
      buf.push(line)
    }
  }
  flush()
  return result
}

export default function PromptReadyState({
  originalTranscript,
  generatedPrompt,
  setGeneratedPrompt,
  onRegenerate,
  onReset,
}) {
  const [isCopied, setIsCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const promptRef = useRef(null)
  const preEditValue = useRef('')

  function handleCopy() {
    if (window.electronAPI) window.electronAPI.copyToClipboard(generatedPrompt)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 1800)
  }

  function handleEdit() {
    if (!isEditing) {
      preEditValue.current = generatedPrompt
      setIsEditing(true)
    } else {
      if (promptRef.current) {
        setGeneratedPrompt(promptRef.current.textContent)
      }
      setIsEditing(false)
    }
  }

  // Focus prompt div when entering edit mode
  useEffect(() => {
    if (isEditing && promptRef.current) {
      promptRef.current.focus()
      const range = document.createRange()
      range.selectNodeContents(promptRef.current)
      range.collapse(false)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }, [isEditing])

  // Escape to cancel edit, Cmd+C to copy
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && isEditing) {
        if (promptRef.current) {
          promptRef.current.textContent = preEditValue.current
        }
        setIsEditing(false)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !isEditing) {
        if (window.electronAPI) window.electronAPI.copyToClipboard(generatedPrompt)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isEditing, generatedPrompt])

  return (
    <div id="panel-ready">
      <div className="traf" />
      <div className="top-row">
        <div className="pr-status">
          <span className="pr-check">✓</span>
          <span>Prompt ready</span>
        </div>
        <div className="pr-actions">
          <button className="pr-btn" id="btn-regenerate" onClick={onRegenerate}>Regenerate</button>
          <button className="pr-btn" id="btn-reset" onClick={onReset}>Reset</button>
        </div>
      </div>
      <div className="div-line" />
      <div className="you-said-block">
        <div className="ys-label">You said</div>
        <div className="ys-text" id="you-said-text">{originalTranscript}</div>
      </div>
      <div className="inner-div" />
      <div
        ref={promptRef}
        className="prompt-out"
        id="prompt-output"
        contentEditable={isEditing}
        suppressContentEditableWarning
        style={isEditing ? {
          outline: '1.5px solid rgba(10,132,255,0.6)',
          outlineOffset: '4px',
          borderRadius: '6px',
        } : {}}
      >
        {isEditing ? generatedPrompt : renderPromptOutput(generatedPrompt)}
      </div>
      <div className="btn-row">
        <button className="btn-edit" id="btn-edit" onClick={handleEdit}>
          {isEditing ? 'Done' : 'Edit'}
        </button>
        <button
          className={`btn-copy${isCopied ? ' copied' : ''}`}
          id="btn-copy"
          onClick={handleCopy}
        >
          {isCopied ? 'Copied ✓' : 'Copy prompt'}
        </button>
      </div>
    </div>
  )
}
