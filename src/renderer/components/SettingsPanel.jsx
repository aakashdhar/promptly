import { useState, useEffect } from 'react'
import { readableColor } from '../utils/promptUtils.js'
import YouSection from './YouSection.jsx'

export default function SettingsPanel({ onClose }) {
  const [claudeVal, setClaudeVal] = useState('')
  const [whisperVal, setWhisperVal] = useState('')
  const [ffmpegVal, setFfmpegVal] = useState('')
  const [claudeStatus, setClaudeStatus] = useState(null) // null | { ok, path }
  const [whisperStatus, setWhisperStatus] = useState(null)
  const [ffmpegStatus, setFfmpegStatus] = useState(null)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveMsgColor, setSaveMsgColor] = useState('rgba(var(--ink),0.35)')
  const [themeVal, setThemeVal] = useState('system')
  const [prefs, setPrefs] = useState(null)
  const [dictionaryDraft, setDictionaryDraft] = useState('')
  const [speechBuiltIn, setSpeechBuiltIn] = useState(false)
  const [modelVal, setModelVal] = useState('')
  const [modelOptions, setModelOptions] = useState([])

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.getThemeSetting?.().then(({ theme }) => setThemeVal(theme))
    window.electronAPI.getPreferences?.().then((p) => { setPrefs(p); setDictionaryDraft(p.dictionary || '') })
    const unsubAccess = window.electronAPI.onAccessibilityChanged?.((accessibility) => setPrefs((p) => p && { ...p, accessibility }))
    window.electronAPI.getStoredPaths().then(({ claudePath, whisperPath, ffmpegPath, claudeModel, modelOptions: options, speechBuiltIn: builtIn }) => {
      setSpeechBuiltIn(!!builtIn)
      setModelVal(claudeModel || '')
      setModelOptions(options || [])
      setClaudeVal(claudePath || '')
      setWhisperVal(whisperPath || '')
      setFfmpegVal(ffmpegPath || '')
      setClaudeStatus(claudePath ? { ok: true, path: claudePath } : { ok: false, path: '' })
      setWhisperStatus(whisperPath ? { ok: true, path: whisperPath } : { ok: false, path: '' })
      setFfmpegStatus(ffmpegPath ? { ok: true, path: ffmpegPath } : { ok: false, path: '' })
    })
    return () => unsubAccess?.()
  }, [])

  async function handleBrowseClaude() {
    const result = await window.electronAPI.browseForBinary()
    if (result.path) {
      setClaudeVal(result.path)
      setClaudeStatus({ ok: true, path: result.path })
    }
  }

  async function handleBrowseWhisper() {
    const result = await window.electronAPI.browseForBinary()
    if (result.path) {
      setWhisperVal(result.path)
      setWhisperStatus({ ok: true, path: result.path })
    }
  }

  async function handleBrowseFfmpeg() {
    const result = await window.electronAPI.browseForBinary()
    if (result.path) {
      setFfmpegVal(result.path)
      setFfmpegStatus({ ok: true, path: result.path })
    }
  }

  async function savePrefs(patch) {
    setPrefs((p) => ({ ...p, ...patch }))
    await window.electronAPI.setPreferences(patch)
  }

  async function handleAllowAccessibility() {
    const accessibility = await window.electronAPI.requestAccessibility()
    setPrefs((p) => ({ ...p, accessibility }))
  }

  async function handleThemeChange(value) {
    setThemeVal(value)
    await window.electronAPI.setThemeSetting(value)
  }

  async function handleModelChange(value) {
    setModelVal(value)
    await window.electronAPI.savePaths({ claudeModel: value })
    setSaveMsgColor('rgba(48,209,88,0.75)')
    setSaveMsg('✓ Model saved — used for the next prompt')
  }

  async function handleSaveRecheck() {
    setSaveMsgColor('rgba(var(--ink),0.35)')
    setSaveMsg('Saving...')
    await window.electronAPI.savePaths({ claudePath: claudeVal.trim(), whisperPath: whisperVal.trim(), ffmpegPath: ffmpegVal.trim() })
    setSaveMsg('Rechecking...')
    const result = await window.electronAPI.recheckPaths()
    setClaudeStatus(result.claude)
    setWhisperStatus(result.whisper)
    setFfmpegStatus(result.ffmpeg)
    if (result.claude.ok && result.whisper.ok) {
      if (!result.ffmpeg.ok) {
        setSaveMsgColor('rgba(255,189,46,0.75)')
        setSaveMsg('✓ Saved — ffmpeg not found (optional)')
      } else {
        setSaveMsgColor('rgba(48,209,88,0.75)')
        setSaveMsg('✓ Paths saved and verified')
      }
    } else {
      const name = !result.claude.ok ? 'Claude CLI' : 'Whisper'
      setSaveMsgColor('rgba(255,59,48,0.7)')
      setSaveMsg(name + ' path not found — verify and try again')
    }
  }

  const dotStyle = (status) => ({
    width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginLeft: 4,
    background: status === null
      ? 'rgba(var(--ink),0.15)'
      : status.ok ? 'rgba(48,209,88,0.9)' : 'rgba(255,59,48,0.7)',
  })

  const inputBorder = (status) =>
    status === null ? 'rgba(var(--ink),0.12)'
    : status.ok ? 'rgba(48,209,88,0.3)' : 'rgba(255,59,48,0.3)'

  const hintText = (status, val) => {
    if (status === null) return ''
    if (status.ok) return '✓ Connected: ' + (status.path || val)
    return 'Not found — paste path manually or use Browse'
  }

  const hintColor = (status) =>
    status === null ? 'rgba(var(--ink),0.2)'
    : status.ok ? 'rgba(48,209,88,0.6)' : 'rgba(255,59,48,0.5)'

  const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5, fontFamily: 'inherit' }
  const inputStyle = (status) => ({ width: '100%', height: 32, background: 'rgba(var(--ink),0.05)', border: `0.5px solid ${inputBorder(status)}`, borderRadius: 8, padding: '0 10px', fontSize: 11, color: 'rgba(var(--ink),0.95)', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', WebkitAppRegion: 'no-drag' })
  const browseBtn = { height: 32, padding: '0 11px', background: 'rgba(var(--ink),0.05)', border: '0.5px solid rgba(var(--ink),0.1)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, outline: 'none' }

  return (
    <div style={{ padding: '16px 20px 18px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(var(--ink),0.86)', fontFamily: 'inherit' }}>Settings</span>
        <button onClick={onClose} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'rgba(var(--ink),0.05)', border: '0.5px solid rgba(var(--ink),0.1)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}>← Back</button>
      </div>

      {/* Appearance */}
      <div style={{ marginBottom: 14 }}>
        <div style={sectionLabel}>Appearance</div>
        <div role="radiogroup" aria-label="Appearance" style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 9, background: 'rgba(var(--ink),0.05)' }}>
          {[['system', 'Match macOS'], ['light', 'Light'], ['dark', 'Dark']].map(([value, label]) => (
            <button
              key={value}
              role="radio"
              aria-checked={themeVal === value}
              onClick={() => handleThemeChange(value)}
              style={{
                flex: 1, height: 26, borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                fontWeight: themeVal === value ? 600 : 400,
                background: themeVal === value ? 'var(--surface-raised)' : 'transparent',
                boxShadow: themeVal === value ? '0 1px 2px rgba(0,0,0,0.12), inset 0 0 0 0.5px rgba(var(--ink),0.18)' : 'none',
                color: themeVal === value ? 'rgb(var(--ink))' : 'var(--text-secondary)',
                WebkitAppRegion: 'no-drag',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {prefs && (
        <>
          {/* Hotkey + hold to talk */}
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="settings-hotkey" style={{ ...sectionLabel, display: 'block' }}>Talk shortcut</label>
            <select
              id="settings-hotkey"
              value={prefs.hotkey}
              onChange={e => savePrefs({ hotkey: e.target.value })}
              style={{ ...inputStyle(null), fontFamily: 'inherit', cursor: 'pointer' }}
            >
              {prefs.hotkeyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 5, lineHeight: 1.5 }}>
              {prefs.hotkey === 'double-control'
                ? (prefs.accessibility?.tap
                  ? 'Double-tap Control to start, tap it once to stop. Or double-tap and hold while you talk.'
                  : 'Needs Accessibility (below). Until then, tap ⌥ Space to start and stop.')
                : prefs.accessibility?.tap
                  ? 'Hold it while you talk and let go to finish, or tap it to start and stop.'
                  : 'Tap to start and stop. Allow Accessibility below to hold it while you talk.'}
              {prefs.hotkey === 'fn' && ' Set System Settings → Keyboard → "Press 🌐 key to" to "Do Nothing" first.'}
            </div>
          </div>

          {/* Dictation and "Make it a prompt" */}
          <div style={{ marginBottom: 14 }}>
            <div style={sectionLabel}>Dictation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['dictationTypeIn', prefs.accessibility?.trusted
                  ? 'Type into the app I\'m in'
                  : 'Type into the app I\'m in (needs Accessibility, below; until then it\'s copied for ⌘V)'],
                ['dictationRemoveFillers', 'Remove um, uh and similar (nothing else is changed)'],
              ].map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'rgba(var(--ink),0.85)', lineHeight: 1.45, cursor: 'pointer', WebkitAppRegion: 'no-drag' }}>
                  <input type="checkbox" id={`settings-${key}`} checked={!!prefs[key]} onChange={e => savePrefs({ [key]: e.target.checked })} style={{ marginTop: 2 }} />
                  {label}
                </label>
              ))}
            </div>
            <label htmlFor="settings-promptStyle" style={{ display: 'block', fontSize: 12, color: 'rgba(var(--ink),0.85)', margin: '12px 0 5px' }}>
              "Make it a prompt" writes a
            </label>
            <select
              id="settings-promptStyle"
              value={prefs.promptStyle}
              onChange={e => savePrefs({ promptStyle: e.target.value })}
              style={{ ...inputStyle(null), fontFamily: 'inherit', cursor: 'pointer' }}
            >
              {(prefs.promptStyles || []).map(o => <option key={o.value} value={o.value}>{o.label} prompt</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={sectionLabel}>Hold to talk and selected text</div>
            {prefs.accessibility?.trusted ? (
              <div style={{ fontSize: 12, color: readableColor('rgba(48,209,88,0.9)') }}>✓ Allowed — Promptly can use your selection as context.</div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Needs Accessibility permission. Promptly only watches your talk shortcut and reads selected text when you start recording.
                </div>
                <button onClick={handleAllowAccessibility} style={{ ...browseBtn, color: 'rgba(var(--ink),0.85)' }}>Allow</button>
              </div>
            )}
          </div>

          <YouSection prefs={prefs} onSave={savePrefs} onEditCount={(editCount) => setPrefs((p) => ({ ...p, editCount }))} />

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="settings-dictionary" style={{ ...sectionLabel, display: 'block' }}>Dictionary</label>
            <textarea
              id="settings-dictionary"
              value={dictionaryDraft}
              onChange={e => setDictionaryDraft(e.target.value)}
              onBlur={() => dictionaryDraft !== prefs.dictionary && savePrefs({ dictionary: dictionaryDraft })}
              placeholder="Names and terms to spell right, e.g. Supabase, Kubernetes, Aakash"
              rows={2}
              style={{ ...inputStyle(null), height: 'auto', padding: '7px 10px', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5, userSelect: 'text' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {[
              ['autoCopy', 'Copy prompts to the clipboard automatically'],
              ['launchAtLogin', 'Open Promptly when I log in'],
            ].map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(var(--ink),0.85)', cursor: 'pointer', WebkitAppRegion: 'no-drag' }}>
                <input type="checkbox" id={`settings-${key}`} checked={!!prefs[key]} onChange={e => savePrefs({ [key]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
        </>
      )}

      {/* Claude CLI */}
      <div style={{ marginBottom: 12 }}>
        <div style={sectionLabel}>Claude CLI path</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <input value={claudeVal} onChange={e => setClaudeVal(e.target.value)} placeholder="/usr/local/bin/claude" style={inputStyle(claudeStatus)} />
            <div style={{ ...dotStyle(claudeStatus), position: 'absolute', right: 10 }} />
          </div>
          <button onClick={handleBrowseClaude} style={browseBtn}>Browse</button>
        </div>
        <div style={{ fontSize: 11, color: readableColor(hintColor(claudeStatus)), marginTop: 4, fontFamily: 'inherit', minHeight: 13 }}>{hintText(claudeStatus, claudeVal)}</div>
      </div>

      {speechBuiltIn ? (
        <div style={{ marginBottom: 14 }}>
          <div style={sectionLabel}>Speech-to-text</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>Built in — runs on this Mac, nothing to install.</div>
        </div>
      ) : (<>
      {/* Whisper */}
      <div style={{ marginBottom: 12 }}>
        <div style={sectionLabel}>Whisper path</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <input value={whisperVal} onChange={e => setWhisperVal(e.target.value)} placeholder="/usr/local/bin/whisper" style={inputStyle(whisperStatus)} />
            <div style={{ ...dotStyle(whisperStatus), position: 'absolute', right: 10 }} />
          </div>
          <button onClick={handleBrowseWhisper} style={browseBtn}>Browse</button>
        </div>
        <div style={{ fontSize: 11, color: readableColor(hintColor(whisperStatus)), marginTop: 4, fontFamily: 'inherit', minHeight: 13 }}>{hintText(whisperStatus, whisperVal)}</div>
      </div>

      {/* ffmpeg */}
      <div style={{ marginBottom: 14 }}>
        <div style={sectionLabel}>ffmpeg path</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <input value={ffmpegVal} onChange={e => setFfmpegVal(e.target.value)} placeholder="/opt/homebrew/bin/ffmpeg" style={inputStyle(ffmpegStatus)} />
            <div style={{ ...dotStyle(ffmpegStatus), position: 'absolute', right: 10 }} />
          </div>
          <button onClick={handleBrowseFfmpeg} style={browseBtn}>Browse</button>
        </div>
        <div style={{ fontSize: 11, color: readableColor(hintColor(ffmpegStatus)), marginTop: 4, fontFamily: 'inherit', minHeight: 13 }}>{hintText(ffmpegStatus, ffmpegVal)}</div>
      </div>

      </>)}

      {/* Claude model */}
      {modelOptions.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="settings-model" style={{ ...sectionLabel, display: 'block' }}>Claude model</label>
          <select
            id="settings-model"
            value={modelVal}
            onChange={e => handleModelChange(e.target.value)}
            style={{ ...inputStyle(null), fontFamily: 'inherit', cursor: 'pointer' }}
          >
            {modelOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}

      {/* divider */}
      <div style={{ height: 0.5, background: 'linear-gradient(90deg,transparent,rgba(var(--ink),0.07),transparent)', marginBottom: 12 }} />

      {/* save button */}
      <button
        onClick={handleSaveRecheck}
        style={{ width: '100%', height: 34, background: 'linear-gradient(135deg,rgba(10,132,255,0.9),rgba(10,100,220,0.9))', color: 'var(--on-accent)', border: '0.5px solid rgba(10,132,255,0.35)', borderRadius: 9, fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.01em' }}
      >
        Save &amp; Recheck
      </button>

      <div style={{ fontSize: 11, textAlign: 'center', marginTop: 8, minHeight: 14, fontFamily: 'inherit', color: readableColor(saveMsgColor) }}>{saveMsg}</div>

      {/* divider */}
      <div style={{ height: 0.5, background: 'linear-gradient(90deg,transparent,rgba(var(--ink),0.07),transparent)', margin: '12px 0' }} />

      {/* recheck setup */}
      <button
        onClick={() => window.electronAPI?.reopenWizard?.()}
        style={{ width: '100%', height: 30, background: 'rgba(var(--ink),0.04)', color: 'var(--text-secondary)', border: '0.5px solid rgba(var(--ink),0.1)', borderRadius: 8, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}
      >
        Recheck setup ↺
      </button>
    </div>
  )
}
