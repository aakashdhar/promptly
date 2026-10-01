import { PROMPT_TARGETS } from '../utils/modes.js'

// "For: Claude ▾" beside Copy on a finished prompt. Picking another AI rewrites the prompt for it.
export default function PromptTargetPicker({ targets }) {
  if (!targets.enabled) return null
  const busyLabel = PROMPT_TARGETS.find((t) => t.key === targets.busy)?.label
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
      {targets.error && !busyLabel && <span role="alert" style={{ fontSize: '12px', color: 'color-mix(in oklab, rgb(255,69,58) var(--accent-text-strength), rgb(var(--ink)))', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={targets.error}>{targets.error}</span>}
      <label htmlFor="prompt-target" style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>For</label>
      <select
        id="prompt-target"
        value={targets.busy || targets.target}
        disabled={!!targets.busy}
        onChange={(e) => targets.pick(e.target.value)}
        title={PROMPT_TARGETS.find((t) => t.key === targets.target)?.desc || 'The AI this prompt is written for'}
        style={{
          height: '32px', padding: '0 8px', borderRadius: '8px', fontFamily: 'inherit', fontSize: '12.5px',
          color: 'rgba(var(--ink),0.95)', background: 'rgba(var(--ink),0.06)',
          border: '0.5px solid rgba(var(--ink),0.14)', cursor: targets.busy ? 'default' : 'pointer',
        }}
      >
        {PROMPT_TARGETS.map((t) => <option key={t.key} value={t.key} title={t.desc}>{t.label}</option>)}
      </select>
    </span>
  )
}
