import { useState, useEffect } from 'react'

export default function SettingsPanel({ onClose }) {
  const [claudeVal, setClaudeVal] = useState('')
  const [whisperVal, setWhisperVal] = useState('')
  const [claudeStatus, setClaudeStatus] = useState(null) // null | { ok, path }
  const [whisperStatus, setWhisperStatus] = useState(null)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveMsgColor, setSaveMsgColor] = useState('rgba(255,255,255,0.35)')

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.getStoredPaths().then(({ claudePath, whisperPath }) => {
      setClaudeVal(claudePath || '')
      setWhisperVal(whisperPath || '')
      setClaudeStatus(claudePath ? { ok: true, path: claudePath } : { ok: false, path: '' })
      setWhisperStatus(whisperPath ? { ok: true, path: whisperPath } : { ok: false, path: '' })
    })
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

  async function handleSaveRecheck() {
    setSaveMsgColor('rgba(255,255,255,0.35)')
    setSaveMsg('Saving...')
    await window.electronAPI.savePaths({ claudePath: claudeVal.trim(), whisperPath: whisperVal.trim() })
    setSaveMsg('Rechecking...')
    const result = await window.electronAPI.recheckPaths()
    setClaudeStatus(result.claude)
    setWhisperStatus(result.whisper)
    if (result.claude.ok && result.whisper.ok) {
      setSaveMsgColor('rgba(48,209,88,0.75)')
      setSaveMsg('✓ Paths saved and verified')
    } else {
      const name = !result.claude.ok ? 'Claude CLI' : 'Whisper'
      setSaveMsgColor('rgba(255,59,48,0.7)')
      setSaveMsg(name + ' path not found — verify and try again')
    }
  }

  const dotStyle = (status) => ({
    width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginLeft: 4,
    background: status === null
      ? 'rgba(255,255,255,0.15)'
      : status.ok ? 'rgba(48,209,88,0.9)' : 'rgba(255,59,48,0.7)',
  })

  const inputBorder = (status) =>
    status === null ? 'rgba(255,255,255,0.12)'
    : status.ok ? 'rgba(48,209,88,0.3)' : 'rgba(255,59,48,0.3)'

  const hintText = (status, val) => {
    if (status === null) return ''
    if (status.ok) return '✓ Connected: ' + (status.path || val)
    return 'Not found — paste path manually or use Browse'
  }

  const hintColor = (status) =>
    status === null ? 'rgba(255,255,255,0.2)'
    : status.ok ? 'rgba(48,209,88,0.6)' : 'rgba(255,59,48,0.5)'

  const sectionLabel = { fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 5, fontFamily: 'inherit' }
  const inputStyle = (status) => ({ width: '100%', height: 32, background: 'rgba(255,255,255,0.05)', border: `0.5px solid ${inputBorder(status)}`, borderRadius: 8, padding: '0 10px', fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' })
  const browseBtn = { height: 32, padding: '0 11px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, outline: 'none' }

  return (
    <div style={{ padding: '16px 20px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.65)', fontFamily: 'inherit' }}>Path configuration</span>
        <button onClick={onClose} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}>← Back</button>
      </div>

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
        <div style={{ fontSize: 10, color: hintColor(claudeStatus), marginTop: 4, fontFamily: 'inherit', minHeight: 13 }}>{hintText(claudeStatus, claudeVal)}</div>
      </div>

      {/* Whisper */}
      <div style={{ marginBottom: 14 }}>
        <div style={sectionLabel}>Whisper path</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <input value={whisperVal} onChange={e => setWhisperVal(e.target.value)} placeholder="/usr/local/bin/whisper" style={inputStyle(whisperStatus)} />
            <div style={{ ...dotStyle(whisperStatus), position: 'absolute', right: 10 }} />
          </div>
          <button onClick={handleBrowseWhisper} style={browseBtn}>Browse</button>
        </div>
        <div style={{ fontSize: 10, color: hintColor(whisperStatus), marginTop: 4, fontFamily: 'inherit', minHeight: 13 }}>{hintText(whisperStatus, whisperVal)}</div>
      </div>

      {/* divider */}
      <div style={{ height: 0.5, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)', marginBottom: 12 }} />

      {/* save button */}
      <button
        onClick={handleSaveRecheck}
        style={{ width: '100%', height: 34, background: 'linear-gradient(135deg,rgba(10,132,255,0.9),rgba(10,100,220,0.9))', color: 'rgba(255,255,255,0.92)', border: '0.5px solid rgba(10,132,255,0.35)', borderRadius: 9, fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.01em' }}
      >
        Save &amp; Recheck
      </button>

      <div style={{ fontSize: 10.5, textAlign: 'center', marginTop: 8, minHeight: 14, fontFamily: 'inherit', color: saveMsgColor }}>{saveMsg}</div>
    </div>
  )
}
