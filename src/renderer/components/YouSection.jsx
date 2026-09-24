import { useState } from 'react'

// Settings → You: the two notes that make results sound like the user ("How you write" for
// Polish and Email, "About you" for prompts), and two ways to draft the first one with Claude:
// from pasted writing samples, or from the edits the user has made to results. A draft is only
// ever a suggestion — nothing changes until the user picks "Use these".

const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }
const fieldLabel = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, fontWeight: 500, color: 'rgba(var(--ink),0.86)', marginBottom: 5 }
const hint = { fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }
const textarea = {
  width: '100%', boxSizing: 'border-box', background: 'rgba(var(--ink),0.05)', border: '0.5px solid rgba(var(--ink),0.1)',
  borderRadius: 8, padding: '8px 10px', fontSize: 12, lineHeight: 1.5, color: 'rgba(var(--ink),0.95)', fontFamily: 'inherit',
  outline: 'none', resize: 'vertical', userSelect: 'text', WebkitAppRegion: 'no-drag',
}
const smallBtn = {
  height: 28, padding: '0 11px', background: 'rgba(var(--ink),0.05)', border: '0.5px solid rgba(var(--ink),0.1)', borderRadius: 7,
  fontSize: 12, color: 'rgba(var(--ink),0.85)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', WebkitAppRegion: 'no-drag',
}
const primaryBtn = { ...smallBtn, background: 'linear-gradient(135deg,rgba(10,132,255,0.92),rgba(10,100,220,0.92))', border: 'none', color: 'var(--on-accent)', fontWeight: 600 }
const linkBtn = { background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2, WebkitAppRegion: 'no-drag' }

// Grows with the notes so none are hidden, within reason (roughly 70 characters a line here).
function fitRows(text, min) {
  const lines = String(text || '').split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 70)), 0)
  return Math.min(10, Math.max(min, lines + 1))
}

export default function YouSection({ prefs, onSave, onEditCount }) {
  const [voiceDraft, setVoiceDraft] = useState(prefs.voiceNotes || '')
  const [aboutDraft, setAboutDraft] = useState(prefs.aboutMe || '')
  const [showSamples, setShowSamples] = useState(false)
  const [samples, setSamples] = useState('')
  const [busy, setBusy] = useState(false)
  const [suggestion, setSuggestion] = useState('')
  const [error, setError] = useState('')
  const editCount = prefs.editCount || 0

  async function learn(fromSamples) {
    setBusy(true)
    setError('')
    setSuggestion('')
    const result = await window.electronAPI.learnStyle(fromSamples ? samples : '')
    setBusy(false)
    if (result?.success && result.notes) setSuggestion(result.notes)
    else setError(result?.error ? `Couldn't draft notes: ${result.error}` : "Couldn't draft notes. Try again.")
  }

  function useSuggestion() {
    setVoiceDraft(suggestion)
    onSave({ voiceNotes: suggestion })
    setSuggestion('')
    setShowSamples(false)
    setSamples('')
  }

  async function forgetEdits() {
    const { editCount: count } = await window.electronAPI.clearEdits()
    onEditCount(count)
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={sectionLabel}>You</div>

      <label htmlFor="settings-voice" style={fieldLabel}>
        How you write <span style={hint}>used for Polish and Email</span>
      </label>
      <textarea
        id="settings-voice"
        value={voiceDraft}
        onChange={(e) => setVoiceDraft(e.target.value)}
        onBlur={() => voiceDraft !== (prefs.voiceNotes || '') && onSave({ voiceNotes: voiceDraft })}
        placeholder={'e.g. Short sentences. British spelling. Sign off "Cheers, Sam". Never "I hope this finds you well".'}
        rows={fitRows(voiceDraft, 4)}
        maxLength={2000}
        style={textarea}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <button type="button" style={smallBtn} onClick={() => { setShowSamples((v) => !v); setError('') }} disabled={busy}>
          Learn from my writing
        </button>
        {editCount > 0 && (
          <button type="button" style={smallBtn} onClick={() => learn(false)} disabled={busy}>
            Suggest from my {editCount} {editCount === 1 ? 'edit' : 'edits'}
          </button>
        )}
        {editCount > 0 && <button type="button" style={linkBtn} onClick={forgetEdits}>Forget my edits</button>}
      </div>

      {showSamples && !suggestion && (
        <div style={{ marginTop: 8 }}>
          <textarea
            id="settings-samples"
            value={samples}
            onChange={(e) => setSamples(e.target.value)}
            placeholder="Paste two or three things you've written: emails, messages, posts. They're only used to draft your notes and aren't saved."
            rows={5}
            style={textarea}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" style={primaryBtn} onClick={() => learn(true)} disabled={busy || samples.trim().length < 40}>
              Draft my notes
            </button>
          </div>
        </div>
      )}

      {busy && <div style={{ ...hint, fontSize: 12, marginTop: 8 }} role="status">Reading your writing…</div>}
      {error && <div style={{ fontSize: 12, marginTop: 8, color: 'color-mix(in oklab, rgb(255,69,58) var(--accent-text-strength), rgb(var(--ink)))' }}>{error}</div>}

      {suggestion && (
        <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(10,132,255,0.06)', border: '0.5px solid rgba(10,132,255,0.25)' }}>
          <div style={{ ...fieldLabel, marginBottom: 6 }}>Suggested notes</div>
          <div className="selectable" style={{ fontSize: 12, lineHeight: 1.55, color: 'rgba(var(--ink),0.9)', whiteSpace: 'pre-wrap' }}>{suggestion}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <button type="button" style={smallBtn} onClick={() => setSuggestion('')}>Dismiss</button>
            <button type="button" style={primaryBtn} onClick={useSuggestion}>Use these</button>
          </div>
        </div>
      )}

      <label htmlFor="settings-about" style={{ ...fieldLabel, marginTop: 14 }}>
        About you <span style={hint}>used for prompts</span>
      </label>
      <textarea
        id="settings-about"
        value={aboutDraft}
        onChange={(e) => setAboutDraft(e.target.value)}
        onBlur={() => aboutDraft !== (prefs.aboutMe || '') && onSave({ aboutMe: aboutDraft })}
        placeholder="e.g. Product manager at a fintech startup. Our stack is TypeScript, Next.js and Postgres. I write for a non-technical audience."
        rows={fitRows(aboutDraft, 3)}
        maxLength={2000}
        style={textarea}
      />
    </div>
  )
}
