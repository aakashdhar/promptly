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
      result.push(
        <span
          key={key++}
          className="block text-[8.5px] font-bold tracking-[0.14em] uppercase text-[rgba(100,170,255,0.42)] mb-[5px] mt-5 first:mt-0"
        >
          {m[1].trim()}
        </span>
      )
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
    <div id="panel-ready" className="relative z-[1]">
      <div className="h-7 [-webkit-app-region:drag]" />
      <div className="flex justify-between items-center px-[22px] pt-[26px] pb-5">
        <div className="flex items-center gap-2 text-[13px] text-white/40 tracking-[0.01em]">
          <span className="text-[#30D158] text-[15px] [text-shadow:0_0_8px_rgba(48,209,88,0.5)]">✓</span>
          <span>Prompt ready</span>
        </div>
        <div className="flex gap-[18px]">
          <button
            className="text-[11px] text-white/20 bg-transparent border-none cursor-pointer p-0 tracking-[0.01em] hover:text-[#0A84FF] transition-colors duration-150"
            id="btn-regenerate"
            onClick={onRegenerate}
          >
            Regenerate
          </button>
          <button
            className="text-[11px] text-white/20 bg-transparent border-none cursor-pointer p-0 tracking-[0.01em] hover:text-[#0A84FF] transition-colors duration-150"
            id="btn-reset"
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      </div>
      <div className="h-px mx-[18px] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
      <div className="px-[22px] pt-7 pb-0">
        <div className="block text-[9px] font-bold tracking-[0.14em] uppercase text-white/[0.14] mb-3">You said</div>
        <div className="text-[13px] text-white/55 leading-[1.7] line-clamp-2 mb-1" id="you-said-text">
          {originalTranscript}
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent mx-[22px] my-[26px]" />
      <div
        ref={promptRef}
        className="px-[22px] text-[13.5px] leading-[1.9] text-white/[0.82] tracking-[0.01em] max-h-[200px] overflow-y-auto mb-4 whitespace-pre-wrap scrollbar-thin"
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
      <div className="flex gap-[10px] px-[22px] pt-[32px] pb-7">
        <button
          className="h-11 px-6 border border-white/[0.10] rounded-[10px] bg-white/[0.04] text-[13px] text-white/40 cursor-pointer tracking-[0.01em] hover:bg-white/[0.08] hover:border-white/[0.18] transition-all duration-150"
          id="btn-edit"
          onClick={handleEdit}
        >
          {isEditing ? 'Done' : 'Edit'}
        </button>
        <button
          className={`flex-1 h-11 border-none rounded-[10px] text-[13px] font-semibold cursor-pointer tracking-[0.02em] border-t border-t-white/[0.18] transition-shadow duration-150 ${
            isCopied
              ? 'bg-gradient-to-br from-[#30D158]/90 to-[#1EA846]/90 shadow-[0_2px_20px_rgba(48,209,88,0.4)] text-white'
              : 'bg-gradient-to-br from-[#0A84FF]/92 to-[#0064DC]/92 shadow-[0_2px_20px_rgba(10,132,255,0.4)] hover:shadow-[0_4px_28px_rgba(10,132,255,0.65)] text-white'
          }`}
          id="btn-copy"
          onClick={handleCopy}
        >
          {isCopied ? 'Copied ✓' : 'Copy prompt'}
        </button>
      </div>
    </div>
  )
}
