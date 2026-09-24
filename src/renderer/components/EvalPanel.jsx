import { useState, useEffect, useRef } from 'react'
import { evalScoreColor, evalVerdict, readableColor } from '../utils/promptUtils.js'

const DIMENSION_LABELS = { clarity: 'Clarity', specificity: 'Specificity', context: 'Context', actionability: 'Actionability' }

function isAmberReason(r) {
  const l = r.toLowerCase()
  return l.includes('but') || l.includes('however') || l.includes('lacks') || l.includes('missing') || l.startsWith('no ')
}

export default function EvalPanel({ transcript, prompt, cachedResult, onResult }) {
  const [isOpen, setIsOpen] = useState(false)
  const [evalData, setEvalData] = useState(cachedResult || null)
  const [evalFailed, setEvalFailed] = useState(false)
  const [barsMounted, setBarsMounted] = useState(false)

  // Scoring is a second Claude call, so it only runs when you open the panel (once per prompt),
  // not for every prompt you make.
  const started = useRef(!!cachedResult)
  function startEval() {
    if (started.current) return
    started.current = true
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

  useEffect(() => {
    setBarsMounted(false)
    if (evalData) {
      const t = setTimeout(() => setBarsMounted(true), 50)
      return () => clearTimeout(t)
    }
  }, [evalData])

  const delta = evalData ? evalData.promptlyScore - evalData.rawScore : 0

  const rawWords = (transcript || '').split(/\s+/).filter(Boolean).length
  const promptWords = (prompt || '').split(/\s+/).filter(Boolean).length
  const showEfficiency = rawWords > 0
  const ratio = rawWords > 0 ? (promptWords / rawWords).toFixed(1) : null
  const efficiencyLabel = ratio ? (parseFloat(ratio) >= 1 ? `${ratio}× longer` : `${ratio}× shorter`) : null

  const driftColor = evalData?.intentDrift === 'significant' ? 'rgba(255,69,58,0.8)'
    : evalData?.intentDrift === 'minor' ? 'rgba(255,159,10,0.8)'
    : 'rgba(48,209,88,0.7)'
  const driftBg = evalData?.intentDrift === 'significant' ? 'rgba(255,69,58,0.08)'
    : evalData?.intentDrift === 'minor' ? 'rgba(255,159,10,0.08)'
    : 'rgba(48,209,88,0.08)'
  const driftBorder = evalData?.intentDrift === 'significant' ? '0.5px solid rgba(255,69,58,0.2)'
    : evalData?.intentDrift === 'minor' ? '0.5px solid rgba(255,159,10,0.2)'
    : '0.5px solid rgba(48,209,88,0.2)'

  return (
    <div>
      <button
        onClick={evalFailed ? undefined : () => { startEval(); setIsOpen(v => !v) }}
        style={{
          fontSize: '12px',
          color: evalFailed ? 'var(--text-tertiary)' : 'var(--text-secondary)',
          background: 'none', border: 'none',
          cursor: evalFailed ? 'default' : 'pointer',
          padding: 0, WebkitAppRegion: 'no-drag',
        }}
      >
        ↗ Score this prompt
      </button>

      <div style={{
        overflow: 'hidden',
        maxHeight: isOpen && !evalFailed ? '700px' : '0',
        opacity: isOpen && !evalFailed ? 1 : 0,
        transition: 'max-height 150ms ease, opacity 150ms ease',
      }}>
        <div style={{
          marginTop: 10,
          background: 'rgba(var(--ink),0.03)',
          border: '0.5px solid rgba(var(--ink),0.08)',
          borderRadius: 10,
          padding: 16,
        }}>
          {!evalData ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'rgba(var(--ink),0.4)',
                animation: 'pulse-ring 1.2s ease-in-out infinite',
              }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Evaluating...</span>
            </div>
          ) : (
            <>
              {/* HEADER */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: "'SF Mono', ui-monospace, monospace", fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-secondary)' }}>
                    Prompt Eval
                  </span>
                  <span style={{ width: 1, height: 10, background: 'rgba(var(--ink),0.12)', display: 'inline-block', verticalAlign: 'middle' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    How well would Claude understand and act on this?
                  </span>
                </div>
                <span style={{
                  background: 'rgba(var(--ink),0.06)', borderRadius: 20,
                  padding: '2px 10px', fontSize: 11, color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                }}>
                  {evalVerdict(delta)}
                </span>
              </div>

              {/* THREE-ZONE SCORECARD: raw | delta | promptly */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 1fr' }}>

                {/* RAW SIDE */}
                <div style={{ borderTop: '1.5px solid rgba(255,69,58,0.5)', paddingTop: 10, paddingRight: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                    Without Promptly
                  </div>
                  <div style={{ fontSize: 52, fontWeight: 300, lineHeight: 1, color: 'rgba(var(--ink),0.95)', marginBottom: 8, letterSpacing: '-0.02em' }}>
                    {evalData.rawScore}
                  </div>
                  <div style={{ height: 3, background: 'rgba(var(--ink),0.08)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
                    <div style={{ width: barsMounted ? `${evalData.rawScore}%` : '0%', height: 3, background: evalScoreColor(evalData.rawScore, false), borderRadius: 2, transition: 'width 500ms ease-out' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {(evalData.rawReasons || []).map((r) => (
                      <div key={r} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: isAmberReason(r) ? 'rgba(255,159,10,0.7)' : 'rgba(255,69,58,0.6)', flexShrink: 0, marginTop: 4 }} />
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DELTA CENTRE */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10 }}>
                  <div style={{ width: 1, height: 28, background: 'rgba(var(--ink),0.07)' }} />
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    background: delta >= 0 ? 'rgba(48,209,88,0.08)' : 'rgba(255,69,58,0.08)',
                    border: `0.5px solid ${delta >= 0 ? 'rgba(48,209,88,0.2)' : 'rgba(255,69,58,0.2)'}`,
                    borderRadius: 20, padding: '6px 0', width: 46,
                    gap: 1,
                  }}>
                    <span style={{ fontFamily: "'SF Mono', ui-monospace, monospace", fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: delta >= 0 ? 'color-mix(in oklab, rgb(48,209,88) var(--accent-text-strength), rgb(var(--ink)))' : 'color-mix(in oklab, rgb(255,69,58) var(--accent-text-strength), rgb(var(--ink)))', lineHeight: 1 }}>
                      delta
                    </span>
                    <span style={{ fontSize: 20, fontWeight: 400, color: delta >= 0 ? 'color-mix(in oklab, rgb(48,209,88) var(--accent-text-strength), rgb(var(--ink)))' : 'color-mix(in oklab, rgb(255,69,58) var(--accent-text-strength), rgb(var(--ink)))', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                      {delta >= 0 ? `+${delta}` : delta}
                    </span>
                    <span style={{ fontSize: 11, color: delta >= 0 ? 'color-mix(in oklab, rgb(48,209,88) var(--accent-text-strength), rgb(var(--ink)))' : 'color-mix(in oklab, rgb(255,69,58) var(--accent-text-strength), rgb(var(--ink)))', lineHeight: 1 }}>
                      pts
                    </span>
                  </div>
                  <div style={{ width: 1, flex: 1, background: 'rgba(var(--ink),0.07)', minHeight: 16 }} />
                </div>

                {/* PROMPTLY SIDE */}
                <div style={{ borderTop: '1.5px solid rgba(48,209,88,0.6)', paddingTop: 10, paddingLeft: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                    With Promptly
                  </div>
                  <div style={{ fontSize: 52, fontWeight: 300, lineHeight: 1, color: 'rgba(var(--ink),0.95)', marginBottom: 8, letterSpacing: '-0.02em' }}>
                    {evalData.promptlyScore}
                  </div>
                  <div style={{ height: 3, background: 'rgba(var(--ink),0.08)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
                    <div style={{ width: barsMounted ? `${evalData.promptlyScore}%` : '0%', height: 3, background: evalScoreColor(evalData.promptlyScore, true), borderRadius: 2, transition: 'width 500ms ease-out', transitionDelay: barsMounted ? '0.15s' : '0s' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {(evalData.promptlyReasons || []).map((r) => (
                      <div key={r} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: isAmberReason(r) ? 'rgba(255,159,10,0.7)' : 'rgba(48,209,88,0.65)', flexShrink: 0, marginTop: 4 }} />
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* DIMENSIONS */}
              {evalData.dimensions && (
                <div style={{ marginTop: 14, paddingTop: 10, borderTop: '0.5px solid rgba(var(--ink),0.06)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                    Dimensions
                  </div>
                  {['clarity', 'specificity', 'context', 'actionability'].map((key, i, arr) => {
                    const dim = evalData.dimensions[key]
                    if (!dim) return null
                    return (
                      <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 1fr', alignItems: 'center', marginBottom: i === arr.length - 1 ? 0 : 5 }}>
                        {/* left: label + raw bar — bounded to left 1fr, won't cross delta column */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 14, minWidth: 0 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 80, flexShrink: 0 }}>{DIMENSION_LABELS[key]}</span>
                          <div style={{ flex: 1, height: 3, background: 'rgba(var(--ink),0.06)', borderRadius: 2, overflow: 'hidden', minWidth: 0 }}>
                            <div style={{ width: barsMounted ? `${Math.min(100, Math.max(0, dim.raw))}%` : '0%', height: 3, background: evalScoreColor(dim.raw, false), borderRadius: 2, transition: 'width 500ms ease-out' }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 16, textAlign: 'right', flexShrink: 0 }}>{dim.raw}</span>
                        </div>
                        {/* center: aligns with delta pill — empty */}
                        <div />
                        {/* right: promptly bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 14, minWidth: 0 }}>
                          <div style={{ flex: 1, height: 3, background: 'rgba(var(--ink),0.06)', borderRadius: 2, overflow: 'hidden', minWidth: 0 }}>
                            <div style={{ width: barsMounted ? `${Math.min(100, Math.max(0, dim.structured))}%` : '0%', height: 3, background: evalScoreColor(dim.structured, true), borderRadius: 2, transition: 'width 500ms ease-out', transitionDelay: barsMounted ? '0.15s' : '0s' }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 16, textAlign: 'right', flexShrink: 0 }}>{dim.structured}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* FOOTER */}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '0.5px solid rgba(var(--ink),0.06)' }}>
                {/* Two-cell row: what's missing + efficiency */}
                {(evalData.gap || showEfficiency) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: evalData.critique || evalData.intentDrift ? 10 : 0 }}>
                    {evalData.gap ? (
                      <div style={{ padding: '7px 9px', background: 'rgba(255,159,10,0.05)', border: '0.5px solid rgba(255,159,10,0.12)', borderRadius: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'color-mix(in oklab, rgb(255,159,10) var(--accent-text-strength), rgb(var(--ink)))', marginBottom: 3 }}>
                          What&apos;s missing
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {evalData.gap}
                        </div>
                      </div>
                    ) : <div />}
                    {showEfficiency ? (
                      <div style={{ padding: '7px 9px', background: 'rgba(var(--ink),0.025)', border: '0.5px solid rgba(var(--ink),0.06)', borderRadius: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--text-tertiary)', marginBottom: 3 }}>
                          Efficiency
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {efficiencyLabel} · {delta >= 0 ? `+${delta}` : delta} pts
                        </div>
                      </div>
                    ) : <div />}
                  </div>
                )}
                {/* Full-width verdict row: critique left, drift badge right */}
                {(evalData.critique || evalData.intentDrift) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    {evalData.critique && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.55, flex: 1 }}>
                        {evalData.critique}
                      </div>
                    )}
                    {evalData.intentDrift && (
                      <span style={{
                        background: driftBg, border: driftBorder,
                        borderRadius: 20, padding: '2px 8px',
                        fontSize: 11, color: readableColor(driftColor), whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        {evalData.intentDriftLabel || 'Intent evaluated'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
