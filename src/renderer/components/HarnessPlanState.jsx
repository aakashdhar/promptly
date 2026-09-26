import { useEffect, useState } from 'react'
import { readableColor } from '../utils/promptUtils.js'
import { HARNESS_ACCENT } from '../hooks/useHarnessBuilder.js'
import ResultHeader, { ghostBtn } from './ResultHeader.jsx'

const MONO = "'SF Mono', ui-monospace, Menlo, monospace"
const PINK = readableColor(HARNESS_ACCENT)
const AMBER = readableColor('rgba(255,179,64,1)')
const GREEN = readableColor('rgba(48,209,88,1)')
const RED = readableColor('rgba(255,69,58,1)')
const LABEL = readableColor('rgba(100,170,255,1)')
const STOP_MARK = { done: ['✓', GREEN], stuck: ['✕', RED], limit: ['⏱', 'var(--text-secondary)'] }

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Which step is lit, moving along the plan so it reads as something that runs.
function useCycle(count, ms = 1300) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (count < 2 || reducedMotion()) return undefined
    const t = setInterval(() => setI((n) => (n + 1) % count), ms)
    return () => clearInterval(t)
  }, [count, ms])
  return i
}

const label = { fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: LABEL }
const box = (hot) => ({
  borderRadius: '11px', padding: '9px 12px', display: 'grid', gap: '3px',
  // Opaque, so the loop's ring and moving dot pass behind the steps rather than through them.
  background: hot ? 'color-mix(in oklab, rgb(242,155,203) 12%, var(--bg))' : 'color-mix(in oklab, rgb(var(--ink)) 4%, var(--bg))',
  border: `1px solid ${hot ? 'color-mix(in oklab, rgb(242,155,203) 45%, transparent)' : 'rgba(var(--ink),0.1)'}`,
  transition: 'border-color 300ms, background 300ms',
})

// ── The loop: steps around a ring, one pass of the job ──
const R = 118
const CX = 170
const CY = 172
const at = (deg) => [CX + R * Math.sin(deg * Math.PI / 180), CY - R * Math.cos(deg * Math.PI / 180)]

function LoopDiagram({ steps, limit }) {
  const hot = useCycle(steps.length)
  const angles = steps.map((_, i) => (360 / steps.length) * i)
  const arcs = angles.map((a) => [a + 360 / steps.length * 0.3, a + 360 / steps.length * 0.7])
  const [tx, ty] = at(0)
  return (
    <div style={{ position: 'relative', width: '340px', height: '344px', flexShrink: 0 }} role="img" aria-label={`A loop: ${steps.map((s) => s.title).join(', then ')}, then again`}>
      <svg viewBox="0 0 340 344" width="340" height="344" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        <defs>
          <marker id="harness-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 1L8 5L0 9" fill="none" strokeWidth="1.6" style={{ stroke: 'rgba(var(--ink),0.35)' }} />
          </marker>
        </defs>
        <circle cx={CX} cy={CY} r={R} fill="none" strokeWidth="1.5" strokeDasharray="3 5" style={{ stroke: 'rgba(var(--ink),0.14)' }} />
        {arcs.map(([a, b]) => {
          const [x1, y1] = at(a)
          const [x2, y2] = at(b)
          return <path key={a} d={`M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2}`} fill="none" strokeWidth="1.5" markerEnd="url(#harness-arrow)" style={{ stroke: 'rgba(var(--ink),0.35)' }} />
        })}
        {!reducedMotion() && (
          <circle r="4.5" fill={HARNESS_ACCENT}>
            <animateMotion dur={`${steps.length * 1.3}s`} repeatCount="indefinite" path={`M${tx} ${ty} A${R} ${R} 0 1 1 ${tx - 0.01} ${ty}`} />
          </circle>
        )}
      </svg>
      {steps.map((s, i) => {
        const [x, y] = at(angles[i])
        return (
          <div key={i} style={{ ...box(i === hot), position: 'absolute', left: x, top: y, width: '122px', transform: 'translate(-50%, -50%)' }}>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: '7px', fontWeight: 600, fontSize: '13px', color: 'rgba(var(--ink),0.95)' }}>
              <span style={{ fontFamily: MONO, fontSize: '11px', color: i === hot ? PINK : 'var(--text-tertiary)' }}>{i + 1}</span>{s.title}
            </span>
            {s.detail && <span style={{ fontSize: '12px', lineHeight: 1.4, color: 'var(--text-secondary)' }}>{s.detail}</span>}
          </div>
        )
      })}
      {limit && (
        <div style={{ position: 'absolute', left: CX, top: CY, transform: 'translate(-50%, -50%)', width: '104px', textAlign: 'center', fontSize: '12px', lineHeight: 1.4, color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>at most</div>{limit}
        </div>
      )}
    </div>
  )
}

// ── The pipeline: stages left to right, then the checks every change must pass ──
function PipelineDiagram({ steps, checks, onFailure }) {
  const hot = useCycle(steps.length + (checks.length ? 1 : 0))
  const arrow = <span aria-hidden="true" style={{ alignSelf: 'center', color: 'var(--text-secondary)', fontSize: '15px', flexShrink: 0 }}>→</span>
  return (
    <div>
      <div role="list" aria-label="Stages" style={{ display: 'flex', alignItems: 'stretch', gap: '10px', paddingBottom: '6px' }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'contents' }}>
            {i > 0 && arrow}
            <div role="listitem" style={{
              ...box(i === hot), flex: '1 1 0', minWidth: '96px', maxWidth: '190px', alignContent: 'start',
              boxShadow: s.parallel > 1 ? '4px 4px 0 -1px var(--bg), 4px 4px 0 0 rgba(var(--ink),0.12), 8px 8px 0 -1px var(--bg), 8px 8px 0 0 rgba(var(--ink),0.08)' : 'none',
              marginRight: s.parallel > 1 ? '8px' : 0, marginBottom: s.parallel > 1 ? '8px' : 0,
            }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '6px', fontWeight: 600, fontSize: '13px', color: 'rgba(var(--ink),0.95)' }}>
                {s.title}
                <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 400, color: i === hot ? PINK : 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                  {s.parallel > 1 ? `×${s.parallel}` : s.runs === 'once' ? 'once' : ''}
                </span>
              </span>
              {s.detail && <span style={{ fontSize: '12px', lineHeight: 1.4, color: 'var(--text-secondary)' }}>{s.detail}</span>}
              {s.parallel > 1 && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{s.parallel} at the same time</span>}
            </div>
          </div>
        ))}
        {checks.length > 0 && (
          <>
            {arrow}
            <div role="listitem" style={{ ...box(hot === steps.length), flex: '1.2 1 0', minWidth: '120px', maxWidth: '210px', alignContent: 'start' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: 'rgba(var(--ink),0.95)' }}>Checks</span>
              {checks.map((c, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(var(--ink),0.85)' }}>
                  <i aria-hidden="true" style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: hot === steps.length ? GREEN : 'rgba(var(--ink),0.2)', transition: `background 200ms ${i * 150}ms` }} />
                  {c.name}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
      {onFailure && (
        <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'baseline' }}>
          <span style={{ color: RED, fontWeight: 600, whiteSpace: 'nowrap' }}>↺ When a check fails</span>{onFailure}
        </div>
      )}
    </div>
  )
}

// A gap: an amber chip until it's answered, then the answer in green. Click to type.
function GapChip({ gap, value, onAnswer }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const commit = () => { const v = draft.trim(); if (v || value) onAnswer(gap.id, v); setEditing(false) }
  if (editing) {
    return (
      <input
        autoFocus
        aria-label={gap.label}
        value={draft}
        placeholder={gap.example ? `e.g. ${gap.example}` : ''}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value || ''); setEditing(false) } }}
        style={{ height: '26px', minWidth: '160px', padding: '0 8px', borderRadius: '6px', border: '1px solid rgba(10,132,255,0.8)', background: 'var(--bg)', color: 'rgba(var(--ink),0.95)', fontFamily: MONO, fontSize: '12px', outline: 'none', boxShadow: '0 0 0 3px rgba(10,132,255,0.18)', userSelect: 'text' }}
      />
    )
  }
  const filled = !!value
  return (
    <button
      type="button"
      onClick={() => { setDraft(value || ''); setEditing(true) }}
      aria-label={filled ? `${gap.label}: ${value}. Change` : `Fill in ${gap.label}`}
      style={{
        height: '26px', padding: '0 9px', borderRadius: '6px', cursor: 'pointer', maxWidth: '100%', flexShrink: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        border: filled ? '1px solid color-mix(in oklab, rgb(48,209,88) 40%, transparent)' : '1px dashed color-mix(in oklab, rgb(255,179,64) 60%, transparent)',
        background: filled ? 'rgba(48,209,88,0.08)' : 'rgba(255,179,64,0.08)',
        color: filled ? GREEN : AMBER, fontFamily: filled ? MONO : 'inherit', fontSize: '12px', fontWeight: filled ? 500 : 600,
      }}
    >
      {value || gap.label}
    </button>
  )
}

function Fact({ title, children }) {
  return (
    <div style={{ display: 'grid', gap: '6px', alignContent: 'start' }}>
      <span style={label}>{title}</span>
      {children}
    </div>
  )
}

const itemRow = { display: 'flex', gap: '9px', alignItems: 'baseline', fontSize: '13px', lineHeight: 1.5, color: 'rgba(var(--ink),0.9)' }
const code = { fontFamily: MONO, fontSize: '12px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(var(--ink),0.07)', color: 'rgba(var(--ink),0.9)' }

export default function HarnessPlanState({ plan, answers, onAnswer, onConfirm, onReiterate, onStartOver }) {
  if (!plan) return null
  const open = plan.gaps.filter((g) => !answers[g.id]).length
  const limit = plan.stopWhen.find((s) => s.kind === 'limit')?.text || ''
  const isLoop = plan.shape === 'loop'

  const facts = [
    plan.goal && <Fact key="goal" title="Goal"><p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: 'rgba(var(--ink),0.9)' }}>{plan.goal}</p></Fact>,
    plan.stopWhen.length > 0 && (
      <Fact key="stop" title="Stop when">
        {plan.stopWhen.map((s, i) => (
          <div key={i} style={itemRow}><span aria-hidden="true" style={{ width: '14px', flexShrink: 0, textAlign: 'center', fontWeight: 700, color: STOP_MARK[s.kind][1] }}>{STOP_MARK[s.kind][0]}</span>{s.text}</div>
        ))}
      </Fact>
    ),
    isLoop && plan.checks.length > 0 && (
      <Fact key="checks" title="Checks after each pass">
        {plan.checks.map((c, i) => (
          <div key={i} style={itemRow}><span aria-hidden="true" style={{ width: '14px', flexShrink: 0, textAlign: 'center', color: GREEN }}>●</span><span>{c.name}{c.command && <> <code style={code}>{c.command}</code></>}</span></div>
        ))}
      </Fact>
    ),
    plan.never.length > 0 && (
      <Fact key="never" title="Never">
        {plan.never.map((n, i) => (
          <div key={i} style={itemRow}><span aria-hidden="true" style={{ width: '14px', flexShrink: 0, textAlign: 'center', fontWeight: 700, color: RED }}>✕</span>{n}</div>
        ))}
      </Fact>
    ),
    plan.roles.length > 0 && (
      <Fact key="roles" title="Helper agents">
        {plan.roles.map((r, i) => <div key={i} style={itemRow}><b style={{ fontWeight: 600 }}>{r.name}</b><span style={{ color: 'var(--text-secondary)' }}>{r.job}</span></div>)}
      </Fact>
    ),
    (plan.gaps.length > 0 || plan.schedule) && (
      <Fact key="gaps" title={plan.gaps.length ? 'Needs you' : 'Runs'}>
        {plan.gaps.map((g) => (
          <div key={g.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px', minWidth: 0 }}>
            <span style={{ width: '112px', flexShrink: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{g.label}</span>
            <GapChip gap={g} value={answers[g.id]} onAnswer={onAnswer} />
          </div>
        ))}
        {plan.schedule && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {plan.gaps.length > 0 && <span style={{ width: '112px', flexShrink: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Runs</span>}
            <span style={{ fontSize: '13px', color: 'rgba(var(--ink),0.9)' }}>{plan.schedule}</span>
          </div>
        )}
      </Fact>
    ),
  ].filter(Boolean)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ResultHeader
        left={
          <>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <i aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', background: HARNESS_ACCENT, flexShrink: 0 }} />{plan.name}
            </span>
            {plan.gaps.length > 0 && (
              <span style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', padding: '2px 8px', borderRadius: '6px', color: open ? AMBER : GREEN, background: open ? 'rgba(255,179,64,0.1)' : 'rgba(48,209,88,0.08)', border: `1px solid ${open ? 'color-mix(in oklab, rgb(255,179,64) 35%, transparent)' : 'color-mix(in oklab, rgb(48,209,88) 35%, transparent)'}` }}>
                {open ? `${open} to fill` : 'All filled'}
              </span>
            )}
          </>
        }
        right={
          <>
            <button type="button" onClick={onReiterate} style={{ ...ghostBtn, color: readableColor('rgba(10,132,255,1)') }}>↻ Iterate</button>
            <button type="button" onClick={onStartOver} style={ghostBtn}>Start over</button>
          </>
        }
      />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px' }}>
        {plan.summary && <p style={{ margin: '0 0 16px', fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: '72ch' }}>{plan.summary}</p>}
        {isLoop ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px', alignItems: 'flex-start' }}>
            <LoopDiagram steps={plan.steps} limit={limit} />
            <div style={{ flex: '1 1 260px', minWidth: 0, display: 'grid', gap: '16px' }}>{facts}</div>
          </div>
        ) : (
          <>
            <PipelineDiagram steps={plan.steps} checks={plan.checks} onFailure={plan.onFailure} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px 28px', marginTop: '20px' }}>{facts}</div>
          </>
        )}
      </div>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px', borderTop: '0.5px solid rgba(var(--ink),0.08)' }}>
        {open > 0 && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Gaps you leave empty become TODOs in the files</span>}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onConfirm}
          style={{ height: '36px', padding: '0 24px', fontFamily: 'inherit', border: 'none', background: 'linear-gradient(135deg, rgba(10,132,255,0.95), rgba(10,100,220,0.95))', color: 'var(--on-accent)', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 16px rgba(10,132,255,0.35)' }}
        >
          Write the files
        </button>
      </div>
    </div>
  )
}
