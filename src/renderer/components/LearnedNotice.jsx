import { useCallback, useEffect, useRef, useState } from 'react'

// "Learned from your edit": what Promptly just added to How you write or Your words, with Undo.
// Main sends one per thing learned (D-AUTO-LEARN); each stays a few seconds, longer while hovered.
const SHOW_MS = 9000

export default function LearnedNotice() {
  const [notes, setNotes] = useState([])
  const timers = useRef(new Map())

  const drop = useCallback((id) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setNotes((list) => list.filter((n) => n.id !== id))
  }, [])
  const schedule = useCallback((id) => { clearTimeout(timers.current.get(id)); timers.current.set(id, setTimeout(() => drop(id), SHOW_MS)) }, [drop])

  useEffect(() => {
    const off = window.electronAPI?.onLearned?.((note) => {
      setNotes((list) => [...list.slice(-2), { ...note, undone: false }])
      schedule(note.id)
    })
    const all = timers.current
    return () => { off?.(); all.forEach(clearTimeout) }
  }, [schedule])

  async function undo(note) {
    await window.electronAPI?.undoLearned?.(note.id)
    setNotes((list) => list.map((n) => (n.id === note.id ? { ...n, undone: true } : n)))
    schedule(note.id)
  }

  if (!notes.length) return null
  return (
    <div style={{ position: 'absolute', left: '50%', bottom: '84px', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 40, width: 'min(560px, calc(100% - 48px))' }}>
      {notes.map((n) => (
        <div
          key={n.id}
          role="status"
          onMouseEnter={() => clearTimeout(timers.current.get(n.id))}
          onMouseLeave={() => schedule(n.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 10px 10px 14px', borderRadius: '12px',
            background: 'var(--surface)', border: '0.5px solid rgba(var(--ink),0.14)', boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
            fontSize: '13px', color: 'rgba(var(--ink),0.95)', animation: 'stateIn 220ms ease-out',
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: n.undone ? 'rgba(var(--ink),0.3)' : 'rgb(42,63,201)' }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 600 }}>{n.undone ? 'Undone. ' : n.kind === 'word' ? 'Added to Your words: ' : 'Learned from your edit: '}</span>
            <span style={{ color: 'var(--text-secondary)', textDecoration: n.undone ? 'line-through' : 'none' }}>{n.text}</span>
          </span>
          {!n.undone && (
            <button type="button" onClick={() => undo(n)} style={{ height: '28px', padding: '0 12px', borderRadius: '8px', border: '0.5px solid rgba(var(--ink),0.14)', background: 'rgba(var(--ink),0.05)', color: 'rgba(var(--ink),0.92)', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0, WebkitAppRegion: 'no-drag' }}>
              Undo
            </button>
          )}
          <button type="button" aria-label="Dismiss" onClick={() => drop(n.id)} style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: '15px', cursor: 'pointer', flexShrink: 0, WebkitAppRegion: 'no-drag' }}>×</button>
        </div>
      ))}
    </div>
  )
}
