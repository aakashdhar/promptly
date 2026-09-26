import { useState, useRef, useEffect } from 'react'
import { parseSections, readableColor } from '../utils/promptUtils.js'
import EvalPanel from './EvalPanel.jsx'
import ResultHeader, { ghostBtn } from './ResultHeader.jsx'
import MODE_REGISTRY from '../../../shared/modes.json'

// Modes whose result is text Claude wrote from what you said, so it can be iterated on or
// regenerated. Dictations are your own words; builders have their own start-over flows.
const REWORKABLE = new Set(MODE_REGISTRY.modes.filter((m) => m.kind === 'template' || m.kind === 'standalone').map((m) => m.key))

// "um ×2, uh": the only words a dictation drops, listed so nothing is changed silently.
function describeRemoved(removed) {
  const counts = new Map()
  for (const word of removed) counts.set(word, (counts.get(word) || 0) + 1)
  return [...counts].map(([word, n]) => (n > 1 ? `${word} ×${n}` : word)).join(', ')
}

export default function ExpandedPromptReadyContent({
  transcript,
  generatedPrompt,
  setGeneratedPrompt,
  isPolishMode,
  polishResult,
  mode,
  onIterate,
  onRegenerate,
  onReset,
  isIterated,
  dictation = null,
  resultView = 'dictation',
  onShowDictation,
  onMakePrompt,
  displayMode,
}) {
  // What's on screen: a dictation (your words), a polish, or a prompt (possibly made from a
  // dictation, which keeps the switch back to "As I said it").
  const shownMode = displayMode || mode
  const isDictation = shownMode === 'dictate'
  const canRework = !isDictation && REWORKABLE.has(shownMode)
  const plainText = isDictation || isPolishMode
  const [isEditing, setIsEditing] = useState(false)
  const [editHovered, setEditHovered] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [scoreOpen, setScoreOpen] = useState(false)
  const promptRef = useRef(null)
  const preEditValue = useRef('')

  const isRefine = shownMode === 'refine'
  const labelColor = isRefine ? 'rgba(168,85,247,0.85)' : 'rgba(100,170,255,0.55)'

  useEffect(() => {
    setIsEditing(false)
    setIsCopied(false)
    setScoreOpen(false)
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
      if (promptRef.current) {
        const edited = promptRef.current.textContent
        setGeneratedPrompt(edited)
        // Your edits teach Promptly what you prefer (Settings → You).
        window.electronAPI?.recordEdit?.(shownMode, preEditValue.current, edited)
      }
      setIsEditing(false)
    }
  }

  const evalPrompt = isPolishMode ? (polishResult?.polished || generatedPrompt) : generatedPrompt

  const sections = parseSections(generatedPrompt)
  const mid = Math.ceil(sections.length / 2)
  const leftSections = sections.slice(0, mid)
  const rightSections = sections.slice(mid)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ResultHeader
        left={<>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
            <span style={{ color: readableColor('rgb(48,209,88)'), fontSize: '16px' }}>✓</span>
            {isDictation ? 'Dictated' : isPolishMode ? 'Polished' : 'Prompt ready'}
          </span>
          {isIterated && (
            <span style={{
              fontSize: '11px', color: 'color-mix(in oklab, rgb(10,132,255) var(--accent-text-strength), rgb(var(--ink)))',
              background: 'rgba(10,132,255,0.08)', border: '0.5px solid rgba(10,132,255,0.2)',
              borderRadius: '20px', padding: '1px 8px', letterSpacing: '.04em', whiteSpace: 'nowrap',
            }}>↻ iterated</span>
          )}
          {dictation && (
            <div role="tablist" aria-label="Show as" style={{ display: 'inline-flex', gap: '2px', padding: '2px', borderRadius: '9px', background: 'rgba(var(--ink),0.06)', border: '0.5px solid rgba(var(--ink),0.1)' }}>
              {[['dictation', 'As I said it', onShowDictation], ['prompt', 'As a prompt', onMakePrompt]].map(([view, label, onPick]) => (
                <button
                  key={view}
                  role="tab"
                  aria-selected={resultView === view}
                  onClick={() => { if (resultView !== view) onPick?.() }}
                  style={{
                    height: '28px', padding: '0 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: '12.5px', fontWeight: resultView === view ? 600 : 400, whiteSpace: 'nowrap',
                    background: resultView === view ? 'var(--surface)' : 'transparent',
                    boxShadow: resultView === view ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
                    color: resultView === view ? 'rgba(var(--ink),0.95)' : 'var(--text-secondary)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </>}
        right={<>
          {canRework && <button type="button" onClick={onIterate} style={{ ...ghostBtn, color: 'color-mix(in oklab, rgb(10,132,255) var(--accent-text-strength), rgb(var(--ink)))', fontWeight: 500 }}>↻ Iterate</button>}
          {canRework && <button type="button" onClick={onRegenerate} style={ghostBtn}>Regenerate</button>}
          <button type="button" onClick={onReset} style={ghostBtn}>Reset</button>
        </>}
      />

      <div className="selectable" id="prompt-output" style={{ flex: 1, overflowY: 'auto', padding: '22px 28px 18px' }}>
        {isEditing ? (
          <div
            ref={promptRef}
            contentEditable
            suppressContentEditableWarning
            style={{
              fontSize: '13px', lineHeight: '1.75', color: 'rgba(var(--ink),0.95)',
              whiteSpace: 'pre-wrap', outline: '1.5px solid rgba(10,132,255,0.6)',
              outlineOffset: '4px', borderRadius: '6px', minHeight: '100px',
            }}
          >
            {generatedPrompt}
          </div>
        ) : plainText ? (
          // Dictation and polished text read as written, not as prompt sections.
          <div style={{ fontSize: '15px', lineHeight: '1.8', color: 'rgba(var(--ink),0.95)', whiteSpace: 'pre-wrap', maxWidth: '72ch' }}>
            {isPolishMode ? (polishResult?.polished || generatedPrompt) : generatedPrompt}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
            <div>
              {leftSections.map((s, i) => (
                <div key={i} style={{ marginBottom: i < leftSections.length - 1 ? '18px' : 0 }}>
                  {s.label && (
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: readableColor(labelColor), marginBottom: '6px' }}>
                      {s.label}
                    </div>
                  )}
                  <div style={{ fontSize: '14px', color: 'rgba(var(--ink),0.95)', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{s.body}</div>
                </div>
              ))}
            </div>
            <div>
              {rightSections.map((s, i) => (
                <div key={i} style={{ marginBottom: i < rightSections.length - 1 ? '18px' : 0 }}>
                  {s.label && (
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: readableColor(labelColor), marginBottom: '6px' }}>
                      {s.label}
                    </div>
                  )}
                  <div style={{ fontSize: '14px', color: 'rgba(var(--ink),0.95)', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{s.body}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isDictation && dictation?.removed?.length > 0 && (
        <div style={{ padding: '0 28px 10px', fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
          Removed: {describeRemoved(dictation.removed)}. Nothing else was changed.
        </div>
      )}
      {isPolishMode && polishResult?.changes?.length > 0 && (
        <div style={{ margin: '0 28px 12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(48,209,88,0.06)', border: '0.5px solid rgba(48,209,88,0.18)', flexShrink: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: readableColor('rgb(48,209,88)'), marginBottom: '4px' }}>What changed</div>
          {polishResult.changes.map((c, i) => <div key={i} style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{c.replace(/^[·•-]\s*/, '· ')}</div>)}
        </div>
      )}

      {!plainText && (
        <div style={{ padding: scoreOpen ? '0 24px 12px' : 0, flexShrink: 0, maxHeight: '46%', overflowY: 'auto' }}>
          <EvalPanel key={evalPrompt} transcript={transcript} prompt={evalPrompt} open={scoreOpen} hideToggle />
        </div>
      )}

      {/* One action bar: change it on the left, take it on the right. */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px', borderTop: '0.5px solid rgba(var(--ink),0.08)' }}>
        <button
          type="button"
          onClick={handleEdit}
          onMouseEnter={() => setEditHovered(true)}
          onMouseLeave={() => setEditHovered(false)}
          style={{
            height: '36px', padding: '0 18px', fontFamily: 'inherit',
            border: editHovered ? '0.5px solid rgba(var(--ink),0.18)' : '0.5px solid rgba(var(--ink),0.12)',
            background: editHovered ? 'rgba(var(--ink),0.09)' : 'rgba(var(--ink),0.05)',
            color: 'rgba(var(--ink),0.92)', borderRadius: '10px',
            fontSize: '13px', cursor: 'pointer', transition: 'all 150ms ease',
          }}
        >
          {isEditing ? 'Save' : 'Edit'}
        </button>
        {!plainText && (
          <button type="button" onClick={() => setScoreOpen((v) => !v)} aria-expanded={scoreOpen} style={ghostBtn}>
            {scoreOpen ? 'Hide score' : '↗ Score this prompt'}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={handleCopy}
          style={{
            height: '36px', padding: '0 24px', fontFamily: 'inherit',
            border: 'none',
            background: isCopied
              ? 'linear-gradient(135deg, rgba(48,209,88,0.85), rgba(30,168,70,0.85))'
              : 'linear-gradient(135deg, rgba(10,132,255,0.95), rgba(10,100,220,0.95))',
            color: 'var(--on-accent)', borderRadius: '10px',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            boxShadow: isCopied ? '0 2px 16px rgba(48,209,88,0.35)' : '0 4px 16px rgba(10,132,255,0.35)',
            transition: 'all 300ms ease',
          }}
        >
          {isCopied ? '✓ Copied' : isDictation ? 'Copy' : isPolishMode ? 'Copy text' : 'Copy prompt'}
        </button>
      </div>
    </div>
  )
}
