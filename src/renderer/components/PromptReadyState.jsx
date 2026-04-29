import { useState, useRef, useEffect } from 'react'

// POLISH-008: section dividers between body and next label
// POLISH-003: label tracking 0.12em
// POLISH-009: label color 0.42 → 0.70 (blue), 0.7 → 0.85 (purple)
function renderPromptOutput(text, labelColor = 'rgba(100,170,255,0.70)') {
  if (!text) return null
  const lines = text.split('\n')
  const result = []
  let buf = []
  let key = 0
  let firstLabel = true

  function flush() {
    const t = buf.join('\n').trim()
    if (t) result.push(<span key={key++} className="block">{t}</span>)
    buf = []
  }

  for (const line of lines) {
    const m = line.trim().match(/^([A-Za-z][A-Za-z\s]*):\s*$/)
    if (m) {
      flush()
      if (!firstLabel) {
        // POLISH-008: divider between sections
        result.push(
          <div key={key++} style={{ height: '0.5px', background: 'rgba(255,255,255,0.04)', margin: '12px 0 14px' }} />
        )
      }
      firstLabel = false
      result.push(
        <span
          key={key++}
          className="block text-[8.5px] font-bold uppercase mb-[6px]"
          style={{ color: labelColor, letterSpacing: '0.12em' }}
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
  onIterate,
  isIterated,
  onCollapse,
}) {
  const [isCopied, setIsCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  // POLISH-004: button hover states
  const [iterateHovered, setIterateHovered] = useState(false)
  const [editHovered, setEditHovered] = useState(false)
  const [regenerateHovered, setRegenerateHovered] = useState(false)
  const [resetHovered, setResetHovered] = useState(false)
  const [exportHovered, setExportHovered] = useState(false)

  const promptRef = useRef(null)
  const preEditValue = useRef('')

  async function handleExport() {
    const content = `# Generated Prompt\n\n${generatedPrompt}\n\n---\n\n**You said:** ${originalTranscript}\n\n**Mode:** ${mode}\n\n**Generated:** ${new Date().toISOString()}`
    const filename = `prompt-${Date.now()}.md`
    if (window.electronAPI) await window.electronAPI.saveFile({ content, filename, format: 'md' })
  }

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

  useEffect(() => {
    document.addEventListener('export-prompt', handleExport)
    return () => document.removeEventListener('export-prompt', handleExport)
  }, [generatedPrompt, originalTranscript, mode])

  // Derived label and button colors
  const isRefine = mode === 'refine'
  // POLISH-009 label colors
  const labelColor = isRefine ? 'rgba(168,85,247,0.85)' : 'rgba(100,170,255,0.70)'

  return (
    <div
      id="panel-ready"
      className="relative z-[1] flex flex-col h-full"
      onClick={(e) => { if (e.target === e.currentTarget && !isEditing) onReset() }}
    >
      {/* Traffic light breathing room — drag region */}
      <div className="flex-shrink-0" style={{ height: '36px', WebkitAppRegion: 'drag' }} />

      {/* Collapse button — absolute top-right, does not affect flex layout */}
      <button
        onClick={onCollapse}
        title="Collapse"
        style={{
          position: 'absolute', top: '14px', right: '16px',
          width: '26px', height: '26px', borderRadius: '7px',
          background: 'rgba(255,255,255,0.05)',
          border: '0.5px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 10,
          WebkitAppRegion: 'no-drag', padding: 0,
          transition: 'background 150ms',
        }}
        onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
        onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
      >
        <svg width="12" height="10" viewBox="0 0 14 10" fill="none">
          <rect x="0" y="1" width="14" height="2" rx="1" fill="rgba(255,255,255,0.45)"/>
          <rect x="0" y="7" width="14" height="2" rx="1" fill="rgba(255,255,255,0.45)"/>
        </svg>
      </button>

      {/* TOP ROW */}
      <div
        className="flex justify-between items-center flex-shrink-0"
        style={{ padding: '20px 22px 16px' }}
      >
        {/* POLISH-003: status text — fontWeight 500, letterSpacing -0.01em, color 0.82 */}
        <div
          className="flex items-center text-[13px] font-medium"
          style={{ gap: '8px', color: 'rgba(255,255,255,0.82)', letterSpacing: '-0.01em', WebkitAppRegion: 'no-drag' }}
        >
          <span style={{ color: 'var(--color-green)', fontSize: '15px', textShadow: '0 0 8px rgba(48,209,88,0.5)' }}>✓</span>
          <span>{isRefine ? 'Refinement prompt ready' : 'Prompt ready'}</span>
          {isIterated && (
            <span style={{
              fontSize: '10px',
              color: 'rgba(10,132,255,0.72)',
              background: 'rgba(10,132,255,0.08)',
              border: '0.5px solid rgba(10,132,255,0.2)',
              borderRadius: '20px',
              padding: '1px 8px',
              letterSpacing: '.04em',
            }}>
              ↻ iterated
            </span>
          )}
        </div>
        <div className="flex" style={{ gap: '16px', WebkitAppRegion: 'no-drag' }}>
          {/* POLISH-004: ↻ Iterate hover with glow */}
          <button
            onClick={onIterate}
            onMouseEnter={() => setIterateHovered(true)}
            onMouseLeave={() => setIterateHovered(false)}
            style={{
              fontSize: '11px',
              color: iterateHovered ? 'rgba(10,132,255,1)' : 'rgba(10,132,255,0.85)',
              textShadow: iterateHovered ? '0 0 8px rgba(10,132,255,0.4)' : 'none',
              fontWeight: 500,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              letterSpacing: '0.01em',
              transition: 'all 120ms ease',
            }}
          >
            ↻ Iterate
          </button>
          {/* POLISH-004: Regenerate hover; POLISH-009: 0.20 → 0.50 default */}
          <button
            className="text-[11px] bg-transparent border-none cursor-pointer p-0 tracking-[0.01em]"
            style={{
              color: regenerateHovered ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.58)',
              transition: 'color 120ms ease',
            }}
            onMouseEnter={() => setRegenerateHovered(true)}
            onMouseLeave={() => setRegenerateHovered(false)}
            id="btn-regenerate"
            onClick={onRegenerate}
          >
            Regenerate
          </button>
          <button
            className="text-[11px] bg-transparent border-none cursor-pointer p-0 tracking-[0.01em]"
            style={{
              color: exportHovered ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.58)',
              transition: 'color 120ms ease',
            }}
            onMouseEnter={() => setExportHovered(true)}
            onMouseLeave={() => setExportHovered(false)}
            onClick={handleExport}
          >
            Export
          </button>
          {/* POLISH-004: Reset hover */}
          <button
            className="text-[11px] bg-transparent border-none cursor-pointer p-0 tracking-[0.01em]"
            style={{
              color: resetHovered ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.58)',
              transition: 'color 120ms ease',
            }}
            onMouseEnter={() => setResetHovered(true)}
            onMouseLeave={() => setResetHovered(false)}
            id="btn-reset"
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      </div>

      <Divider />

      {/* YOU SAID */}
      <div className="flex-shrink-0" style={{ padding: '20px 22px' }}>
        {/* POLISH-003: section label tracking 0.12em; POLISH-009: 0.16 → 0.45 */}
        <div
          className="text-[9px] font-bold uppercase"
          style={{ letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)', marginBottom: '10px' }}
        >
          YOU SAID
        </div>
        {/* POLISH-009: 0.26 → 0.58; POLISH-003: letterSpacing -0.01em */}
        <div
          className="text-[13px] overflow-hidden"
          style={{
            color: 'rgba(255,255,255,0.58)',
            lineHeight: '1.65',
            letterSpacing: '-0.01em',
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

      {/* PROMPT CONTENT */}
      <div
        ref={promptRef}
        className="overflow-y-auto flex-1 min-h-0"
        id="prompt-output"
        contentEditable={isEditing}
        suppressContentEditableWarning
        style={isEditing ? {
          padding: '20px 22px',
          fontSize: '13.5px',
          lineHeight: '1.85',
          color: 'rgba(255,255,255,0.82)',
          letterSpacing: '-0.01em',
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
          letterSpacing: '-0.01em',
          whiteSpace: 'pre-wrap',
          WebkitAppRegion: 'no-drag',
        }}
      >
        {isEditing ? generatedPrompt : renderPromptOutput(generatedPrompt, labelColor)}
      </div>

      {/* BUTTON ROW */}
      <div
        className="flex flex-shrink-0"
        style={{ gap: '10px', padding: '12px 22px 24px', WebkitAppRegion: 'no-drag' }}
      >
        {/* POLISH-004: Edit button hover — border brightens */}
        <button
          className="cursor-pointer text-[13px] tracking-[0.01em] rounded-[10px] transition-all duration-150"
          id="btn-edit"
          onClick={handleEdit}
          onMouseEnter={() => setEditHovered(true)}
          onMouseLeave={() => setEditHovered(false)}
          style={{
            height: '44px',
            padding: '0 24px',
            border: editHovered ? '0.5px solid rgba(255,255,255,0.16)' : '0.5px solid rgba(255,255,255,0.1)',
            background: editHovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.70)',
            transition: 'all 150ms ease',
          }}
        >
          {isEditing ? 'Done' : 'Edit'}
        </button>

        {/* POLISH-007: copy button smooth transition; POLISH-004: borderTop */}
        <button
          className={`flex-1 cursor-pointer text-[13px] font-semibold tracking-[0.02em] rounded-[10px] text-white ${
            isCopied
              ? 'hover:shadow-[0_4px_28px_rgba(48,209,88,0.65)]'
              : isRefine
                ? 'hover:shadow-[0_4px_28px_rgba(168,85,247,0.65)]'
                : 'hover:shadow-[0_4px_28px_rgba(10,132,255,0.65)]'
          }`}
          id="btn-copy"
          onClick={handleCopy}
          style={{
            height: '44px',
            border: 'none',
            borderTop: '0.5px solid rgba(255,255,255,0.20)',
            background: isCopied
              ? 'linear-gradient(135deg, rgba(48,209,88,0.85), rgba(30,168,70,0.85))'
              : isRefine
                ? 'linear-gradient(135deg, rgba(168,85,247,0.85), rgba(139,60,220,0.85))'
                : 'linear-gradient(135deg, rgba(10,132,255,0.92), rgba(10,100,220,0.92))',
            boxShadow: isCopied
              ? '0 2px 16px rgba(48,209,88,0.35)'
              : isRefine
                ? '0 2px 16px rgba(168,85,247,0.3)'
                : '0 2px 20px rgba(10,132,255,0.4)',
            transition: 'all 300ms ease',
          }}
        >
          {isCopied ? '✓ Copied' : 'Copy prompt'}
        </button>
      </div>
    </div>
  )
}
