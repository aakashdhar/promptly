// "Parameters applied" beside a finished image or video prompt: one line per choice that was
// made. entries are [label, value] pairs; accent is the builder's colour for the labels.
export default function ParamSummary({ entries, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0, overflowY: 'auto' }}>
      <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', margin: 0, fontWeight: 600 }}>Parameters applied</p>
      {entries.length === 0 && (
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No parameters selected</p>
      )}
      {entries.map(([label, value], i) => (
        <div key={`${i}-${label}`} style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
          <span style={{ fontSize: '11px', color: `color-mix(in oklab, rgb(${accent}) var(--accent-text-strength), rgb(var(--ink)))`, minWidth: '90px', textTransform: 'capitalize', flexShrink: 0 }}>{label}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{value}</span>
        </div>
      ))}
    </div>
  )
}
