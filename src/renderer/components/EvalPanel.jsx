import { useState, useEffect } from 'react'
import { evalScoreColor, evalVerdict } from '../utils/promptUtils.js'

export default function EvalPanel({ transcript, prompt }) {
  const [isOpen, setIsOpen] = useState(false)
  const [evalData, setEvalData] = useState(null)
  const [evalFailed, setEvalFailed] = useState(false)

  useEffect(() => {
    window.electronAPI.evaluatePrompt({ transcript, prompt })
      .then((result) => {
        if (result?.success) {
          setEvalData(result.data)
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
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 12, paddingTop: 10,
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

