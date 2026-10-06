import { OUTPUT_LABELS } from '../utils/projects.js'

// Under a result written in a project mode (D-PROJECT-MODES §17, §21): which project, Write as
// (redo it as an email, a prompt or polished text) and the files it was based on, each one
// removable ("leave this file out and redo").
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function shortDate(date) {
  const m = DAY.exec(String(date || ''))
  if (!m) return String(date || '')
  const year = Number(m[1]) === new Date().getFullYear() ? '' : ` ${m[1]}`
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}${year}`
}

const chip = {
  display: 'inline-flex', alignItems: 'center', gap: '4px', maxWidth: '100%', height: '26px', padding: '0 4px 0 10px',
  borderRadius: '7px', fontSize: '12px', color: 'var(--text-secondary)',
  background: 'rgba(var(--ink),0.05)', border: '0.5px solid rgba(var(--ink),0.1)',
}

export default function ProjectResultBar({ result, onWriteAs, onExclude, busy = false }) {
  if (!result) return null
  const { project, output, sources = [] } = result
  return (
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 24px', borderTop: '0.5px solid rgba(var(--ink),0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 600, color: 'rgba(var(--ink),0.9)' }}>
          <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', background: project.color }} />
          {project.name}
        </span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          Write as
          <select
            value={output}
            disabled={busy}
            onChange={(e) => onWriteAs?.(e.target.value)}
            style={{ height: '26px', padding: '0 6px', borderRadius: '7px', fontFamily: 'inherit', fontSize: '12px', color: 'rgba(var(--ink),0.92)', background: 'var(--surface)', border: '0.5px solid rgba(var(--ink),0.16)' }}
          >
            {Object.entries(OUTPUT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
          {sources.length ? `Based on the ${project.name} summary and ${sources.length} file${sources.length === 1 ? '' : 's'}` : `Based on the ${project.name} summary`}
        </span>
      </div>
      {sources.length > 0 && (
        <div aria-label="Files used" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {sources.map((s) => (
            <span key={s.rel} style={chip} title={s.rel}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.rel}{s.date ? ` · ${shortDate(s.date)}` : ''}</span>
              <button
                type="button"
                disabled={busy}
                aria-label={`Leave ${s.rel} out and redo`}
                title="Leave this file out and redo"
                onClick={() => onExclude?.(s.rel)}
                style={{ width: '20px', height: '20px', flexShrink: 0, border: 'none', borderRadius: '5px', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}
              >×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// After a dictation that names someone from a project (§26): "As an Infer360 email".
export function ProjectSuggestion({ suggestion, onUse }) {
  if (!suggestion) return null
  const what = (OUTPUT_LABELS[suggestion.output] || 'Prompt').toLowerCase()
  const article = /^[aeiou]/i.test(suggestion.name) ? 'an' : 'a'
  return (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 24px', borderTop: '0.5px solid rgba(var(--ink),0.08)' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>This sounds like your {suggestion.name} project.</span>
      <button
        type="button"
        onClick={onUse}
        style={{ marginLeft: 'auto', height: '30px', padding: '0 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, color: 'rgba(var(--ink),0.92)', background: 'rgba(var(--ink),0.06)', border: '0.5px solid rgba(var(--ink),0.16)' }}
      >
        As {article} {suggestion.name} {what}
      </button>
    </div>
  )
}
