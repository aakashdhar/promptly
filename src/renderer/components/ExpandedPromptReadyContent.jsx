import { useState, useRef, useEffect } from 'react'
import { parseSections } from '../utils/promptUtils.js'

export default function ExpandedPromptReadyContent({
  generatedPrompt,
  setGeneratedPrompt,
  isPolishMode,
  polishResult,
  mode,
  onIterate,
  onRegenerate,
  onReset,
  isIterated,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editHovered, setEditHovered] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const promptRef = useRef(null)
  const preEditValue = useRef('')

  const isRefine = mode === 'refine'
  const labelColor = isRefine ? 'rgba(168,85,247,0.85)' : 'rgba(100,170,255,0.55)'

  useEffect(() => {
    setIsEditing(false)
    setIsCopied(false)
  }, [generatedPrompt])

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
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isEditing])

  function handleCopy() {
    const text = isPolishMode ? (polishResult?.polished || generatedPrompt) : generatedPrompt
    if (window.electronAPI) window.electronAPI.copyToClipboard(text)
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

  const sections = parseSections(generatedPrompt)
  const mid = Math.ceil(sections.length / 2)
  const leftSections = sections.slice(0, mid)
  const rightSections = sections.slice(mid)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.82)' }}>
          <span style={{ color: 'var(--color-green, #30D158)', fontSize: '17px', textShadow: '0 0 8px rgba(48,209,88,0.5)' }}>✓</span>
          <span>Prompt ready</span>
          {isIterated && (
            <span style={{
              fontSize: '10px', color: 'rgba(10,132,255,0.72)',
              background: 'rgba(10,132,255,0.08)', border: '0.5px solid rgba(10,132,255,0.2)',
              borderRadius: '20px', padding: '1px 8px', letterSpacing: '.04em',
            }}>↻ iterated</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '18px' }}>
          <button onClick={onIterate} style={{ fontSize: '12px', color: 'rgba(10,132,255,0.85)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>↻ Iterate</button>
          <button onClick={onRegenerate} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.50)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Regenerate</button>
          <button onClick={onReset} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.50)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Reset</button>
        </div>
      </div>

      <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '0 28px', flexShrink: 0 }} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px' }}>
        {isEditing ? (
          <div
            ref={promptRef}
            contentEditable
            suppressContentEditableWarning
            style={{
              fontSize: '13px', lineHeight: '1.75', color: 'rgba(255,255,255,0.78)',
              whiteSpace: 'pre-wrap', outline: '1.5px solid rgba(10,132,255,0.6)',
              outlineOffset: '4px', borderRadius: '6px', minHeight: '100px',
            }}
          >
            {generatedPrompt}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
            <div>
              {leftSections.map((s, i) => (
                <div key={i} style={{ marginBottom: i < leftSections.length - 1 ? '18px' : 0 }}>
                  {s.label && (
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: labelColor, marginBottom: '6px' }}>
                      {s.label}
                    </div>
                  )}
                  <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.78)', lineHeight: '1.8' }}>{s.body}</div>
                </div>
              ))}
            </div>
            <div>
              {rightSections.map((s, i) => (
                <div key={i} style={{ marginBottom: i < rightSections.length - 1 ? '18px' : 0 }}>
                  {s.label && (
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: labelColor, marginBottom: '6px' }}>
                      {s.label}
                    </div>
                  )}
                  <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.78)', lineHeight: '1.8' }}>{s.body}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0 }}>
        <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '0 28px' }} />
        <div style={{ display: 'flex', gap: '10px', padding: '14px 24px 20px', alignItems: 'center' }}>
          <button
            onClick={handleEdit}
            onMouseEnter={() => setEditHovered(true)}
            onMouseLeave={() => setEditHovered(false)}
            style={{
              height: '40px', padding: '0 20px',
              border: editHovered ? '0.5px solid rgba(255,255,255,0.16)' : '0.5px solid rgba(255,255,255,0.1)',
              background: editHovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.70)', borderRadius: '8px',
              fontSize: '13px', cursor: 'pointer', transition: 'all 150ms ease',
            }}
          >
            {isEditing ? 'Save' : 'Edit'}
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleCopy}
            style={{
              height: '40px', padding: '0 32px',
              border: 'none', borderTop: '0.5px solid rgba(255,255,255,0.20)',
              background: isCopied
                ? 'linear-gradient(135deg, rgba(48,209,88,0.85), rgba(30,168,70,0.85))'
                : 'linear-gradient(135deg, rgba(10,132,255,0.92), rgba(10,100,220,0.92))',
              color: 'white', borderRadius: '8px',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              boxShadow: isCopied ? '0 2px 16px rgba(48,209,88,0.35)' : '0 2px 20px rgba(10,132,255,0.4)',
              transition: 'all 300ms ease',
            }}
          >
            {isCopied ? '✓ Copied' : 'Copy prompt'}
          </button>
        </div>
      </div>
    </div>
  )
}
