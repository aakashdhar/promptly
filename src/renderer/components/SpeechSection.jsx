import { useEffect, useState } from 'react'
import { readableColor } from '../utils/promptUtils.js'

// Settings → Speech recognition: the built-in model (fast, English) or "Best accuracy", a
// larger model downloaded once that copes far better with accents, fast speech and names, and
// understands Hindi and other languages. Downloading it switches to it; removing it switches back.

const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }
const smallBtn = {
  height: 28, padding: '0 11px', background: 'rgba(var(--ink),0.05)', border: '0.5px solid rgba(var(--ink),0.1)', borderRadius: 7,
  fontSize: 12, color: 'rgba(var(--ink),0.85)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, WebkitAppRegion: 'no-drag',
}
const primaryBtn = { ...smallBtn, background: 'linear-gradient(135deg,rgba(10,132,255,0.92),rgba(10,100,220,0.92))', border: 'none', color: 'var(--on-accent)', fontWeight: 600 }
const linkBtn = { background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2, WebkitAppRegion: 'no-drag' }

// One choice: the radio row, plus actions (download, progress) below it inside the same card.
// The actions sit outside the radio itself so they stay usable while the choice is unavailable.
function Option({ selected, disabled, onSelect, title, detail, children }) {
  return (
    <div style={{
      borderRadius: 9, WebkitAppRegion: 'no-drag',
      background: selected ? 'rgba(var(--ink),0.06)' : 'transparent',
      border: `0.5px solid ${selected ? 'rgba(var(--ink),0.28)' : 'rgba(var(--ink),0.1)'}`,
    }}>
      <div
        role="radio"
        aria-checked={selected}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && onSelect()}
        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect() } }}
        style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: children ? '10px 12px 0' : '10px 12px', cursor: disabled ? 'default' : 'pointer' }}
      >
        <span aria-hidden="true" style={{
          width: 14, height: 14, borderRadius: '50%', flexShrink: 0, marginTop: 1, boxSizing: 'border-box',
          border: selected ? '4px solid rgb(10,132,255)' : '1px solid rgba(var(--ink),0.3)',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(var(--ink),0.9)' }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 2 }}>{detail}</div>
        </div>
      </div>
      {children && <div style={{ padding: '0 12px 10px 36px' }}>{children}</div>}
    </div>
  )
}

export default function SpeechSection({ speech: initial, onSave }) {
  const [speech, setSpeech] = useState(initial)
  const [progress, setProgress] = useState(initial.downloading ? { percent: 0, mbDone: 0, mbTotal: initial.sizeMB } : null)
  const [error, setError] = useState('')

  useEffect(() => window.electronAPI?.onSpeechModelProgress?.((p) => setProgress(p)), [])

  async function download() {
    setError('')
    setProgress({ percent: 0, mbDone: 0, mbTotal: speech.sizeMB })
    const result = await window.electronAPI.downloadSpeechModel()
    setProgress(null)
    if (result.speech) setSpeech(result.speech)
    if (!result.success && !result.cancelled) setError(result.error || 'Download failed')
  }

  async function remove() {
    const result = await window.electronAPI.removeSpeechModel()
    if (result.speech) setSpeech(result.speech)
  }

  function choose(model) {
    setSpeech((s) => ({ ...s, model }))
    onSave({ speechModel: model })
  }

  function chooseLanguage(language) {
    setSpeech((s) => ({ ...s, language }))
    onSave({ speechLanguage: language })
  }

  const accurate = speech.model === 'accurate' && speech.installed

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={sectionLabel}>Speech recognition</div>
      <div role="radiogroup" aria-label="Speech recognition" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Option selected={!accurate} onSelect={() => choose('standard')} title="Standard" detail="Built in and fastest. English only." />
        <Option
          selected={accurate}
          disabled={!speech.installed}
          onSelect={() => choose('accurate')}
          title="Best accuracy"
          detail={'Much better with accents, fast speech and names. Understands Hindi and 90+ other languages. Takes a couple of seconds longer.'
            + (speech.appleSilicon ? '' : ' Slower on this Mac, which has no Apple chip.')}
        >
          {(!speech.installed || progress || error) && (<>
            {!speech.installed && !progress && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={download} style={primaryBtn}>Download ({speech.sizeMB} MB)</button>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Once. Runs on this Mac after that.</span>
              </div>
            )}
            {progress && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <div role="progressbar" aria-label="Downloading" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}
                  style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(var(--ink),0.1)', overflow: 'hidden' }}>
                  <div style={{ width: `${progress.percent}%`, height: '100%', background: 'rgb(10,132,255)', transition: 'width 200ms' }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{progress.mbDone} of {progress.mbTotal} MB</span>
                <button type="button" onClick={() => window.electronAPI.cancelSpeechModel()} style={smallBtn}>Cancel</button>
              </div>
            )}
            {error && <div role="alert" style={{ fontSize: 11, color: readableColor('rgba(255,59,48,0.9)'), marginTop: 6 }}>{error}</div>}
          </>)}
        </Option>
      </div>

      {accurate && (
        <div style={{ marginTop: 10 }}>
          <label htmlFor="settings-speechLanguage" style={{ display: 'block', fontSize: 12, color: 'rgba(var(--ink),0.85)', marginBottom: 5 }}>I speak</label>
          <select
            id="settings-speechLanguage"
            value={speech.language}
            onChange={(e) => chooseLanguage(e.target.value)}
            style={{
              width: '100%', height: 32, background: 'rgba(var(--ink),0.05)', border: '0.5px solid rgba(var(--ink),0.1)', borderRadius: 8,
              padding: '0 10px', fontSize: 12, color: 'rgba(var(--ink),0.95)', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', WebkitAppRegion: 'no-drag',
            }}
          >
            {speech.languages.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 5 }}>
            Dictation types what you said, in that language. Prompts are always written in English.
          </div>
        </div>
      )}

      {speech.installed && (
        <div style={{ marginTop: 8 }}>
          <button type="button" onClick={remove} style={linkBtn}>Remove the download ({speech.sizeMB} MB)</button>
        </div>
      )}
    </div>
  )
}
