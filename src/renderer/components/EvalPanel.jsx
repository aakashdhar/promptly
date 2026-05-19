import { useState, useEffect } from 'react'
import { evalScoreColor, evalVerdict } from '../utils/promptUtils.js'

export default function EvalPanel({ transcript, prompt, cachedResult, onResult }) {
  const [isOpen, setIsOpen] = useState(false)
  const [evalData, setEvalData] = useState(cachedResult || null)
  const [evalFailed, setEvalFailed] = useState(false)

  useEffect(() => {
    if (cachedResult) return
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
  }, [])

  const delta = evalData ? evalData.promptlyScore - evalData.rawScore : 0
  const deltaLabel = delta >= 0 ? `Δ +${delta} points` : `Δ ${delta} points`

  return (
    <div>
      <button
        onClick={evalFailed ? undefined : () => setIsOpen(v => !v)}
        style={{
          fontSize: '12px',
          color: evalFailed ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.50)',
          background: 'none', border: 'none',
          cursor: evalFailed ? 'default' : 'pointer',
          padding: 0, WebkitAppRegion: 'no-drag',
        }}
      >
        ↗ Eval
      </button>

      <div style={{
        overflow: 'hidden',
        maxHeight: isOpen && !evalFailed ? '500px' : '0',
        opacity: isOpen && !evalFailed ? 1 : 0,
        transition: 'max-height 150ms ease, opacity 150ms ease',
      }}>
        <div style={{
          marginTop: 10,
          background: 'rgba(255,255,255,0.03)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: 16,
        }}>
          {!evalData ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'rgba(255,255,255,0.4)',
                animation: 'pulse-ring 1.2s ease-in-out infinite',
              }} />
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Evaluating...</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { label: 'Without Promptly', score: evalData.rawScore, reasons: evalData.rawReasons, isPromptly: false },
                  { label: 'With Promptly', score: evalData.promptlyScore, reasons: evalData.promptlyReasons, isPromptly: true },
                ].map(({ label, score, reasons, isPromptly }) => (
                  <div key={label}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
                      {label}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                        <div style={{ width: `${score}%`, height: 4, background: evalScoreColor(score, isPromptly), borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', minWidth: 24 }}>{score}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {(reasons || []).map((r) => (
                        <div key={r} style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>• {r}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {evalData.dimensions && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>
                    Dimensions
                  </div>
                  {['clarity', 'specificity', 'context', 'actionability'].map((key, i, arr) => {
                    const dim = evalData.dimensions[key]
                    const labels = { clarity: 'Clarity', specificity: 'Specificity', context: 'Context', actionability: 'Actionability' }
                    if (!dim) return null
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i === arr.length - 1 ? 0 : 5 }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', width: 90, flexShrink: 0 }}>{labels[key]}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                          <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                            <div style={{ width: `${Math.min(100, Math.max(0, dim.raw))}%`, height: 3, background: 'rgba(255,255,255,0.22)', borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', minWidth: 18, textAlign: 'right' }}>{dim.raw}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                          <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                            <div style={{ width: `${Math.min(100, Math.max(0, dim.structured))}%`, height: 3, background: evalScoreColor(dim.structured, true), borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', minWidth: 18, textAlign: 'right' }}>{dim.structured}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {evalData.critique && (
                <div style={{
                  marginTop: 12, paddingTop: 10,
                  borderTop: '0.5px solid rgba(255,255,255,0.06)',
                  fontSize: 12, color: 'rgba(255,255,255,0.45)',
                  fontStyle: 'italic', lineHeight: 1.6,
                }}>
                  {evalData.critique}
                </div>
              )}

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 10, paddingTop: 10,
                borderTop: '0.5px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  {deltaLabel}
                </span>
                <span style={{
                  background: 'rgba(255,255,255,0.06)', borderRadius: 20,
                  padding: '2px 10px', fontSize: 11, color: 'rgba(255,255,255,0.6)',
                }}>
                  {evalVerdict(delta)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

