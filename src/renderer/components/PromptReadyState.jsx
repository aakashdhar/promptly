import { useState, useRef, useEffect } from 'react'
import ExportPanel from './ExportPanel.jsx'

function renderPromptOutput(text) {
  if (!text) return null
  const lines = text.split('\n')
  const result = []
  let buf = []
  let key = 0

  function flush() {
    const t = buf.join('\n').trim()
    if (t) result.push(<span key={key++} className="block">{t}</span>)
    buf = []
  }

  for (const line of lines) {
    const m = line.trim().match(/^([A-Za-z][A-Za-z\s]*):\s*$/)
    if (m) {
      flush()
      result.push(
        <span
          key={key++}
          className="block text-[8.5px] font-bold tracking-[0.14em] uppercase mb-[6px] mt-5 first:mt-0"
          style={{ color: 'rgba(100,170,255,0.42)' }}
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

function Divider() {
  return (
    <div
      className="flex-shrink-0"
      style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '0 22px' }}
    />
  )
}

export default function PromptReadyState({
  originalTranscript,
  generatedPrompt,
  setGeneratedPrompt,
  onRegenerate,
  onReset,
  mode,
}) {
  const [isCopied, setIsCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showExport, setShowExport] = useState(false)
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
      if (promptRef.current) setGeneratedPrompt(promptRef.current.textContent)
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
        if (promptRef.current) promptRef.current.textContent = preEditValue.current
        setIsEditing(false)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !isEditing) {
        if (window.electronAPI) window.electronAPI.copyToClipboard(generatedPrompt)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isEditing, generatedPrompt])

  // Resize window when export panel opens/closes
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.resizeWindow(showExport ? 650 : 560)
    }
  }, [showExport])

  // Listen for ⌘E export-prompt custom event dispatched by App.jsx keydown handler
  useEffect(() => {
    function onExportPrompt() { setShowExport(s => !s) }
    document.addEventListener('export-prompt', onExportPrompt)
    return () => document.removeEventListener('export-prompt', onExportPrompt)
  }, [])

  return (
    <div
      id="panel-ready"
      className="relative z-[1] flex flex-col h-full"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Traffic light breathing room */}
      <div className="flex-shrink-0" style={{ height: '36px' }} />

      {/* TOP ROW — 20px top / 22px sides / 16px bottom */}
      <div
        className="flex justify-between items-center flex-shrink-0"
        style={{ padding: '20px 22px 16px' }}
      >
        <div
          className="flex items-center text-[13px] tracking-[0.01em]"
          style={{ gap: '8px', color: 'rgba(255,255,255,0.4)', WebkitAppRegion: 'no-drag' }}
        >
          <span style={{ color: '#30D158', fontSize: '15px', textShadow: '0 0 8px rgba(48,209,88,0.5)' }}>✓</span>
          <span>Prompt ready</span>
        </div>
        <div className="flex" style={{ gap: '16px', WebkitAppRegion: 'no-drag' }}>
          <button
            className="text-[11px] bg-transparent border-none cursor-pointer p-0 tracking-[0.01em] hover:text-[#0A84FF] transition-colors duration-150"
            style={{ color: 'rgba(255,255,255,0.2)' }}
            id="btn-regenerate"
            onClick={onRegenerate}
          >
            Regenerate
          </button>
          <button
            className="text-[11px] bg-transparent border-none cursor-pointer p-0 tracking-[0.01em] transition-colors duration-150"
            style={{ color: showExport ? 'rgba(100,180,255,0.85)' : 'rgba(255,255,255,0.2)' }}
            onClick={() => setShowExport(s => !s)}
          >
            Export
          </button>
          <button
            className="text-[11px] bg-transparent border-none cursor-pointer p-0 tracking-[0.01em] hover:text-[#0A84FF] transition-colors duration-150"
            style={{ color: 'rgba(255,255,255,0.2)' }}
            id="btn-reset"
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      </div>

      <Divider />

      {/* YOU SAID — 22px sides / 20px top / 20px bottom */}
      <div className="flex-shrink-0" style={{ padding: '20px 22px' }}>
        <div
          className="text-[9px] font-bold uppercase"
          style={{ letterSpacing: '0.14em', color: 'rgba(255,255,255,0.16)', marginBottom: '10px' }}
        >
          YOU SAID
        </div>
        <div
          className="text-[13px] overflow-hidden"
          style={{
            color: 'rgba(255,255,255,0.26)',
            lineHeight: '1.65',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            WebkitAppRegion: 'no-drag',
          }}
          id="you-said-text"
        >
          {originalTranscript}
        </div>
      </div>

      <Divider />

      {/* PROMPT CONTENT — fills remaining space, scrollable */}
      <div
        ref={promptRef}
        className="overflow-y-auto scrollbar-thin flex-1 min-h-0"
        id="prompt-output"
        contentEditable={isEditing}
        suppressContentEditableWarning
        style={isEditing ? {
          padding: '20px 22px',
          fontSize: '13.5px',
          lineHeight: '1.85',
          color: 'rgba(255,255,255,0.82)',
          letterSpacing: '0.01em',
          whiteSpace: 'pre-wrap',
          outline: '1.5px solid rgba(10,132,255,0.6)',
          outlineOffset: '4px',
          borderRadius: '6px',
          WebkitAppRegion: 'no-drag',
        } : {
          padding: '20px 22px',
          fontSize: '13.5px',
          lineHeight: '1.85',
          color: 'rgba(255,255,255,0.82)',
          letterSpacing: '0.01em',
          whiteSpace: 'pre-wrap',
          WebkitAppRegion: 'no-drag',
        }}
      >
        {isEditing ? generatedPrompt : renderPromptOutput(generatedPrompt)}
      </div>

      {/* EXPORT PANEL — shown above button row when showExport=true */}
      {showExport && (
        <ExportPanel
          prompt={generatedPrompt}
          transcript={originalTranscript}
          mode={mode}
          onExportDone={() => setShowExport(false)}
        />
      )}

      {/* BUTTON ROW — 12px top / 22px sides / 24px bottom */}
      <div
        className="flex flex-shrink-0"
        style={{ gap: '10px', padding: '12px 22px 24px', WebkitAppRegion: 'no-drag' }}
      >
        <button
          className="cursor-pointer text-[13px] tracking-[0.01em] rounded-[10px] hover:bg-white/[0.08] transition-all duration-150"
          id="btn-edit"
          onClick={handleEdit}
          style={{
            height: '44px',
            padding: '0 24px',
            border: '0.5px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          {isEditing ? 'Done' : 'Edit'}
        </button>
        <button
          onClick={() => setShowExport(true)}
          className="h-[44px] px-[16px] rounded-[10px] flex items-center gap-[6px] text-[12px] font-medium cursor-pointer"
          style={{
            border: '0.5px solid rgba(10,132,255,0.25)',
            background: 'rgba(10,132,255,0.08)',
            color: 'rgba(100,180,255,0.85)',
          }}
        >
          ↓ Export
        </button>
        <button
          className={`flex-1 cursor-pointer text-[13px] font-semibold tracking-[0.02em] rounded-[10px] text-white transition-shadow duration-150 ${
            isCopied
              ? 'hover:shadow-[0_4px_28px_rgba(48,209,88,0.65)]'
              : 'hover:shadow-[0_4px_28px_rgba(10,132,255,0.65)]'
          }`}
          id="btn-copy"
          onClick={handleCopy}
          style={{
            height: '44px',
            border: 'none',
            borderTop: '0.5px solid rgba(255,255,255,0.18)',
            background: isCopied
              ? 'linear-gradient(135deg, rgba(48,209,88,0.92), rgba(30,168,70,0.92))'
              : 'linear-gradient(135deg, rgba(10,132,255,0.92), rgba(10,100,220,0.92))',
            boxShadow: isCopied
              ? '0 2px 20px rgba(48,209,88,0.4)'
              : '0 2px 20px rgba(10,132,255,0.4)',
          }}
        >
          {isCopied ? 'Copied ✓' : 'Copy prompt'}
        </button>
      </div>
    </div>
  )
}
