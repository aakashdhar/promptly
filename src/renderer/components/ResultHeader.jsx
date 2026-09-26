// The result area's header row and its quiet text buttons, shared by every result view.
export default function ResultHeader({ left, right }) {
  return (
    <div style={{ minHeight: '56px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '0 24px', borderBottom: '0.5px solid rgba(var(--ink),0.08)', fontSize: '13px', color: 'rgba(var(--ink),0.95)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>{left}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>{right}</div>
    </div>
  )
}

export const ghostBtn = { height: '30px', padding: '0 10px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }
