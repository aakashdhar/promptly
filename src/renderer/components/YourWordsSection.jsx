import { useEffect, useState } from 'react'
import { readableColor } from '../utils/promptUtils.js'

// Settings → Your words: names and terms Whisper listens for, and fixes for words it keeps
// mishearing ("N10 → n8n", applied to every transcript). Stored as one entry per line in the
// dictionary setting, the same format main/words.js reads. Fixes the user keeps making by hand
// are offered here; nothing is added without a click.

const ARROW = /\s*(?:→|->)\s*/
const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }
const smallBtn = {
  height: 26, padding: '0 10px', background: 'rgba(var(--ink),0.05)', border: '0.5px solid rgba(var(--ink),0.1)', borderRadius: 7,
  fontSize: 12, color: 'rgba(var(--ink),0.85)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, WebkitAppRegion: 'no-drag',
}
const primaryBtn = { ...smallBtn, background: 'linear-gradient(135deg,rgba(10,132,255,0.92),rgba(10,100,220,0.92))', border: 'none', color: 'var(--on-accent)', fontWeight: 600 }

export function parseEntries(dictionary) {
  return String(dictionary || '').split(/[\n,]/).map((e) => e.trim()).filter(Boolean).map((e) => {
    const parts = e.split(ARROW)
    return parts.length === 2 && parts[0] && parts[1] ? `${parts[0]} → ${parts[1]}` : e
  })
}

export default function YourWordsSection({ dictionary, onSave, bare = false }) {
  const entries = parseEntries(dictionary)
  const [draft, setDraft] = useState('')
  const [suggestions, setSuggestions] = useState([])

  useEffect(() => {
    window.electronAPI?.wordSuggestions?.().then((s) => setSuggestions(Array.isArray(s) ? s : []))
  }, [])

  const save = (next) => onSave([...new Set(next)].join('\n'))
  const add = (entry) => {
    const [clean] = parseEntries(entry)
    if (!clean || entries.some((e) => e.toLowerCase() === clean.toLowerCase())) return
    save([...entries, clean])
  }

  function commitDraft() {
    if (!draft.trim()) return
    add(draft)
    setDraft('')
  }

  function acceptSuggestion(s) {
    add(`${s.from} → ${s.to}`)
    setSuggestions((list) => list.filter((x) => x !== s))
  }

  function dismissSuggestion(s) {
    window.electronAPI?.dismissWordSuggestion?.(s.from)
    setSuggestions((list) => list.filter((x) => x !== s))
  }

  return (
    <div style={{ marginBottom: bare ? 0 : 14 }}>
      {!bare && <label htmlFor="settings-your-words" style={{ ...sectionLabel, display: 'block' }}>Your words</label>}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
        Names and terms to listen for, in every mode. Add a fix like <span style={{ fontFamily: 'monospace', color: 'rgba(var(--ink),0.85)' }}>N10 → n8n</span> for a word it keeps mishearing.
      </div>

      {entries.length > 0 && (
        <div role="list" aria-label="Your words" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {entries.map((e) => (
            <span key={e} role="listitem" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 4px 0 10px', borderRadius: 7, background: 'rgba(var(--ink),0.06)', border: '0.5px solid rgba(var(--ink),0.12)', fontSize: 12, color: 'rgba(var(--ink),0.9)', maxWidth: '100%' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e}</span>
              <button
                type="button"
                aria-label={`Remove ${e}`}
                onClick={() => save(entries.filter((x) => x !== e))}
                style={{ width: 20, height: 20, border: 'none', borderRadius: 5, background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, WebkitAppRegion: 'no-drag' }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          id="settings-your-words"
          aria-label="Add a word"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitDraft() } }}
          placeholder="Add a word, e.g. Supabase"
          style={{ flex: 1, minWidth: 0, height: 28, background: 'rgba(var(--ink),0.05)', border: '0.5px solid rgba(var(--ink),0.12)', borderRadius: 7, padding: '0 10px', fontSize: 12, color: 'rgba(var(--ink),0.95)', fontFamily: 'inherit', outline: 'none', userSelect: 'text', WebkitAppRegion: 'no-drag' }}
        />
        <button type="button" onClick={commitDraft} disabled={!draft.trim()} style={{ ...smallBtn, opacity: draft.trim() ? 1 : 0.5, cursor: draft.trim() ? 'pointer' : 'default' }}>Add</button>
      </div>

      {suggestions.map((s) => (
        <div key={`${s.from}→${s.to}`} role="group" aria-label="Suggested fix" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: '8px 10px', borderRadius: 9, background: 'rgba(10,132,255,0.07)', border: '0.5px solid rgba(10,132,255,0.3)' }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.5, color: 'rgba(var(--ink),0.85)' }}>
            You changed <s style={{ color: 'var(--text-secondary)' }}>{s.from}</s> to <b style={{ color: readableColor('rgba(100,170,255,1)'), fontWeight: 600 }}>{s.to}</b> {s.count} times. Fix it automatically?
          </div>
          <button type="button" onClick={() => dismissSuggestion(s)} style={smallBtn}>Not now</button>
          <button type="button" onClick={() => acceptSuggestion(s)} style={primaryBtn}>Add fix</button>
        </div>
      ))}
    </div>
  )
}
