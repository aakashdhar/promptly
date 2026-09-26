import { useState, useEffect, useRef } from 'react'
import { evalVerdict, parseEvalReason, readableColor } from '../utils/promptUtils.js'

// "Score this prompt": what you said against the prompt Promptly wrote, scored by Claude
// (main/prompts/eval.txt). One number pair, one line per dimension with a dot for each version,
// the reasons, and what both still leave out.

const DIMENSIONS = [['clarity', 'Clarity'], ['specificity', 'Specificity'], ['context', 'Context'], ['actionability', 'Actionability']]
const MONO = "'SF Mono', ui-monospace, Menlo, monospace"
const BLUE = 'rgb(10,132,255)'
const GREEN = readableColor('rgb(48,209,88)')
const AMBER = readableColor('rgb(255,159,10)')
const RED = readableColor('rgb(255,69,58)')
const YOU_DOT = 'rgba(var(--ink),0.42)'
const clamp = (n) => Math.min(100, Math.max(0, Number(n) || 0))

const label = { fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }

function Reasons({ title, items }) {
  return (
    <div>
      <div style={label}>{title}</div>
      <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: '4px' }}>
        {items.map((raw) => {
          const { sign, text } = parseEvalReason(raw)
          return (
            <li key={raw} style={{ display: 'flex', gap: '8px', fontSize: '12.5px', lineHeight: 1.45, color: 'rgba(var(--ink),0.88)' }}>
              <span aria-label={sign === '+' ? 'Strength' : sign === '-' ? 'Weakness' : undefined} style={{ width: '12px', flexShrink: 0, textAlign: 'center', fontWeight: 700, color: sign === '+' ? GREEN : sign === '-' ? AMBER : 'var(--text-tertiary)' }}>
                {sign === '+' ? '+' : sign === '-' ? '−' : '·'}
              </span>
              {text}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function EvalPanel({ transcript, prompt, cachedResult, onResult, open, hideToggle = false }) {
  const [openState, setIsOpen] = useState(false)
  const isOpen = open ?? openState
  const [evalData, setEvalData] = useState(cachedResult || null)
  const [evalFailed, setEvalFailed] = useState(false)
  const [shown, setShown] = useState(false)

  // Scoring is a second Claude call, so it only runs when you open the panel (once per prompt),
  // not for every prompt you make.
  const started = useRef(!!cachedResult)
  function startEval() {
    if (started.current) return
    started.current = true
    setEvalFailed(false)
    window.electronAPI.evaluatePrompt({ transcript, prompt })
      .then((result) => {
        if (result?.success) {
          setEvalData(result.data)
          onResult?.(result.data)
        } else {
          setEvalFailed(true)
        }
      })
      .catch(() => setEvalFailed(true))
  }
  function retry() {
    started.current = false
    startEval()
  }

  // Opened from outside: score on first open.
  useEffect(() => { if (open) startEval() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // The dots slide from 0 to their scores once, when the result arrives.
  useEffect(() => {
    setShown(false)
    if (!evalData) return undefined
    const t = setTimeout(() => setShown(true), 50)
    return () => clearTimeout(t)
  }, [evalData])

  const raw = clamp(evalData?.rawScore)
  const scored = clamp(evalData?.promptlyScore)
  const delta = scored - raw
  const deltaColor = delta > 0 ? GREEN : delta < 0 ? AMBER : 'var(--text-secondary)'
  const verdictTone = delta >= 5 ? GREEN : delta > -5 ? 'var(--text-secondary)' : AMBER

  const rawWords = (transcript || '').split(/\s+/).filter(Boolean).length
  const promptWords = (prompt || '').split(/\s+/).filter(Boolean).length
  const ratio = rawWords > 0 ? promptWords / rawWords : 0
  const lengthLabel = ratio ? (ratio >= 1 ? `${ratio.toFixed(1)}× longer than what you said` : `${(1 / ratio).toFixed(1)}× shorter than what you said`) : ''

  const drift = evalData?.intentDrift
  const driftColor = drift === 'significant' ? RED : drift === 'minor' ? AMBER : GREEN

  return (
    <div>
      {!hideToggle && (
        <button
          type="button"
          onClick={() => { startEval(); setIsOpen((v) => !v) }}
          aria-expanded={isOpen}
          style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', WebkitAppRegion: 'no-drag' }}
        >
          {isOpen ? 'Hide score' : '↗ Score this prompt'}
        </button>
      )}

      {isOpen && (
        <section
          aria-label="Prompt score"
          style={{ marginTop: hideToggle ? 0 : '10px', background: 'var(--surface)', border: '0.5px solid rgba(var(--ink),0.1)', borderRadius: '12px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          {!evalData ? (
            evalFailed ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Couldn&apos;t score this prompt.
                <button type="button" onClick={retry} style={{ height: '26px', padding: '0 11px', borderRadius: '7px', border: '0.5px solid rgba(var(--ink),0.14)', background: 'rgba(var(--ink),0.05)', color: 'rgba(var(--ink),0.9)', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>Try again</button>
              </div>
            ) : (
              <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                <span className="working-hop" aria-hidden="true"><i /><i /><i /></span>
                Scoring what you said against the prompt…
              </div>
            )
          ) : (
            <>
              {/* The two scores, the gain, and the verdict */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', fontVariantNumeric: 'tabular-nums' }}>
                    <span aria-label={`What you said: ${raw}`} style={{ fontSize: '30px', fontWeight: 300, lineHeight: 1, color: 'var(--text-secondary)' }}>{raw}</span>
                    <span aria-hidden="true" style={{ fontSize: '17px', color: 'var(--text-tertiary)' }}>→</span>
                    <span aria-label={`The prompt: ${scored}`} style={{ fontSize: '30px', fontWeight: 400, lineHeight: 1, color: 'rgba(var(--ink),0.95)' }}>{scored}</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: deltaColor }}>{delta > 0 ? '+' : ''}{delta}</span>
                  </div>
                  <div style={{ display: 'grid', gap: '3px', minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(var(--ink),0.95)' }}>Score</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', padding: '2px 9px', borderRadius: '11px', color: verdictTone, border: `1px solid color-mix(in oklab, ${verdictTone} 35%, transparent)`, background: `color-mix(in oklab, ${verdictTone} 10%, transparent)` }}>
                        {evalVerdict(delta)}
                      </span>
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>How well Claude would understand and act on it</span>
                  </div>
                </div>
              </div>

              {/* One line per dimension: grey dot for what you said, blue for the prompt */}
              {evalData.dimensions && (
                <div style={{ display: 'grid', gap: '6px' }}>
                  <div aria-hidden="true" style={{ display: 'flex', gap: '14px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    <span><i style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: YOU_DOT, marginRight: '6px' }} />What you said</span>
                    <span><i style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: BLUE, marginRight: '6px' }} />The prompt</span>
                  </div>
                  {DIMENSIONS.map(([key, name]) => {
                    const d = evalData.dimensions[key]
                    if (!d) return null
                    const a = clamp(d.raw)
                    const b = clamp(d.structured)
                    const lo = Math.min(a, b)
                    return (
                      <div key={key} role="img" aria-label={`${name}: ${a} for what you said, ${b} for the prompt`} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 76px', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{name}</span>
                        <div style={{ position: 'relative', height: '10px' }}>
                          <span style={{ position: 'absolute', left: 0, right: 0, top: '4px', height: '2px', borderRadius: '1px', background: 'rgba(var(--ink),0.1)' }} />
                          <span style={{ position: 'absolute', top: '3px', height: '4px', borderRadius: '2px', background: 'rgba(10,132,255,0.22)', left: `${shown ? lo : 0}%`, width: `${shown ? Math.abs(b - a) : 0}%`, transition: 'left 500ms ease-out, width 500ms ease-out' }} />
                          <span style={{ position: 'absolute', top: 0, width: '10px', height: '10px', borderRadius: '50%', transform: 'translateX(-50%)', background: YOU_DOT, left: `${shown ? a : 0}%`, transition: 'left 500ms ease-out' }} />
                          <span style={{ position: 'absolute', top: 0, width: '10px', height: '10px', borderRadius: '50%', transform: 'translateX(-50%)', background: BLUE, boxShadow: '0 0 0 3px rgba(10,132,255,0.2)', left: `${shown ? b : 0}%`, transition: 'left 500ms ease-out' }} />
                        </div>
                        <span style={{ fontFamily: MONO, fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap' }}>{a} → <b style={{ fontWeight: 500, color: 'rgba(var(--ink),0.95)' }}>{b}</b></span>
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px 18px' }}>
                <Reasons title="What you said" items={evalData.rawReasons || []} />
                <Reasons title="The prompt" items={evalData.promptlyReasons || []} />
              </div>

              {evalData.gap && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', padding: '9px 12px', borderRadius: '10px', background: 'rgba(255,159,10,0.07)', border: '0.5px solid rgba(255,159,10,0.3)' }}>
                  <b style={{ fontSize: '12px', fontWeight: 600, color: AMBER, whiteSpace: 'nowrap' }}>Still missing</b>
                  <span style={{ fontSize: '12.5px', lineHeight: 1.5, color: 'rgba(var(--ink),0.88)' }}>{evalData.gap}</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px 14px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {evalData.intentDriftLabel && <span style={{ color: driftColor, fontWeight: 600 }}>{drift === 'none' || !drift ? '✓ ' : ''}{evalData.intentDriftLabel}</span>}
                {lengthLabel && <span>{lengthLabel}</span>}
                {evalData.critique && <span style={{ flex: '1 1 260px', lineHeight: 1.5 }}>{evalData.critique}</span>}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
