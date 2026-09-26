import { useState, useEffect } from 'react'
import { readableColor } from '../utils/promptUtils.js'
import YouSection from './YouSection.jsx'
import SpeechSection from './SpeechSection.jsx'

// Settings, one short tab at a time: icon tabs down the side, and in each tab sections of rows
// (the setting and a line about it on the left, its control on the right). Changes save as you
// make them; only tool paths wait for "Check again".

const ICONS = {
  general: <path d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4" />,
  dictation: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  speech: <path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2" />,
  prompts: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.8 2.2 2.2.8-2.2.8L19 22l-.8-2.2-2.2-.8 2.2-.8z" /></>,
  you: <><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" /></>,
  setup: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M7 9l3 3-3 3M12 15h5" /></>,
}
const TABS = [
  ['general', 'General', 'How Promptly looks and starts.'],
  ['dictation', 'Dictation', 'Your words, typed where your cursor is. Nothing is rewritten.'],
  ['speech', 'Speech', 'How your voice becomes text. Everything runs on this Mac.'],
  ['prompts', 'Prompts', 'How Prompt, Code and Design write for you.'],
  ['you', 'You', 'Notes that help Promptly write like you. They stay on this Mac.'],
  ['setup', 'Setup', 'The tools Promptly uses. You rarely need this.'],
]
const BLUE_TEXT = readableColor('rgb(10,132,255)')
const GREEN_TEXT = readableColor('rgba(48,209,88,0.9)')
const groupLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: 0 }
const selectStyle = { height: 30, minWidth: 210, maxWidth: 280, padding: '0 10px', borderRadius: 8, border: '0.5px solid rgba(var(--ink),0.16)', background: 'rgba(var(--ink),0.05)', color: 'rgba(var(--ink),0.95)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', WebkitAppRegion: 'no-drag' }
const btn = { height: 28, padding: '0 12px', borderRadius: 8, border: '0.5px solid rgba(var(--ink),0.14)', background: 'rgba(var(--ink),0.05)', color: 'rgba(var(--ink),0.9)', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, WebkitAppRegion: 'no-drag' }

function Section({ title, children }) {
  return (
    <section style={{ display: 'grid', gap: 2, paddingTop: 18, borderTop: '0.5px solid rgba(var(--ink),0.1)' }}>
      <h3 style={groupLabel}>{title}</h3>
      {children}
    </section>
  )
}

// One setting: what it is (and a line about it) on the left, its control on the right.
function Row({ label, hint, htmlFor, children }) {
  const Label = htmlFor ? 'label' : 'span'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: '10px 0', minHeight: 48 }}>
      <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <Label htmlFor={htmlFor} style={{ fontSize: 13, fontWeight: 500, color: 'rgba(var(--ink),0.95)' }}>{label}</Label>
        {hint && <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Switch({ id, checked, onChange, label }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{ width: 36, height: 22, borderRadius: 11, border: 'none', padding: 0, flexShrink: 0, cursor: 'pointer', position: 'relative', background: checked ? 'rgb(48,209,88)' : 'rgba(var(--ink),0.2)', transition: 'background 150ms', WebkitAppRegion: 'no-drag' }}
    >
      <span aria-hidden="true" style={{ position: 'absolute', top: 2, left: checked ? 16 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.3)', transition: 'left 150ms' }} />
    </button>
  )
}

const dotStyle = (status) => ({
  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
  background: status === null
    ? 'rgba(var(--ink),0.15)'
    : status.ok ? 'rgba(48,209,88,0.9)' : 'rgba(255,59,48,0.7)',
})

const inputBorder = (status) =>
  status === null ? 'rgba(var(--ink),0.14)'
  : status.ok ? 'rgba(48,209,88,0.35)' : 'rgba(255,59,48,0.35)'

const hintText = (status, val) => {
  if (status === null) return ''
  if (status.ok) return '✓ Found: ' + (status.path || val)
  return 'Not found. Paste the path, or use Browse.'
}

const hintColor = (status) =>
  status === null ? 'var(--text-tertiary)'
  : status.ok ? 'rgba(48,209,88,0.9)' : 'rgba(255,59,48,0.9)'

const pathInput = (status) => ({ flex: 1, minWidth: 0, height: 30, background: 'rgba(var(--ink),0.05)', border: `0.5px solid ${inputBorder(status)}`, borderRadius: 8, padding: '0 26px 0 10px', fontSize: 12, color: 'rgba(var(--ink),0.95)', fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", outline: 'none', boxSizing: 'border-box', userSelect: 'text', WebkitAppRegion: 'no-drag' })

// A tool path with its found/not-found state. Lives outside the panel so typing keeps focus.
function PathField({ id, label, value, onChange, status, placeholder, onBrowse }) {
  return (
    <div style={{ display: 'grid', gap: 6, padding: '10px 0' }}>
      <label htmlFor={id} style={{ fontSize: 13, fontWeight: 500, color: 'rgba(var(--ink),0.95)' }}>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={pathInput(status)} />
          <span style={{ ...dotStyle(status), position: 'absolute', right: 10 }} />
        </div>
        <button type="button" onClick={onBrowse} style={btn}>Browse</button>
      </div>
      {status && <div style={{ fontSize: 12, color: readableColor(hintColor(status)), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hintText(status, value)}</div>}
    </div>
  )
}


export default function SettingsPanel({ onClose }) {
  const [tab, setTab] = useState('general')
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

  const hotkeyHint = !prefs ? '' : prefs.hotkey === 'double-control'
    ? (prefs.accessibility?.tap
      ? 'Double-tap Control to start, tap it once to stop. Or double-tap and hold while you talk.'
      : 'Needs Accessibility (General → Permissions). Until then, tap ⌥ Space to start and stop.')
    : (prefs.accessibility?.tap
      ? 'Hold it while you talk and let go to finish, or tap it to start and stop.'
      : 'Tap to start and stop. Allow Accessibility (General → Permissions) to hold it while you talk.')
    + (prefs.hotkey === 'fn' ? ' Set System Settings → Keyboard → "Press 🌐 key to" to "Do Nothing" first.' : '')

  const [, tabTitle, tabHint] = TABS.find(([k]) => k === tab)

  function renderTab() {
    if (!prefs && tab !== 'setup') return <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading…</div>
    if (tab === 'general') return (
      <>
        <Section title="Appearance">
          <Row label="Theme">
            <div role="radiogroup" aria-label="Appearance" style={{ display: 'inline-flex', gap: 2, padding: 2, borderRadius: 9, background: 'rgba(var(--ink),0.06)', border: '0.5px solid rgba(var(--ink),0.1)' }}>
              {[['system', 'Match macOS'], ['light', 'Light'], ['dark', 'Dark']].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={themeVal === value}
                  onClick={() => handleThemeChange(value)}
                  style={{
                    height: 26, padding: '0 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, whiteSpace: 'nowrap',
                    fontWeight: themeVal === value ? 600 : 400,
                    background: themeVal === value ? 'var(--surface-raised)' : 'transparent',
                    boxShadow: themeVal === value ? '0 1px 2px rgba(0,0,0,0.14)' : 'none',
                    color: themeVal === value ? 'rgb(var(--ink))' : 'var(--text-secondary)',
                    WebkitAppRegion: 'no-drag',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </Row>
        </Section>
        <Section title="Talk shortcut">
          <Row label="Start talking with" hint={hotkeyHint} htmlFor="settings-hotkey">
            <select id="settings-hotkey" value={prefs.hotkey} onChange={e => savePrefs({ hotkey: e.target.value })} style={selectStyle}>
              {prefs.hotkeyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Row>
        </Section>
        <Section title="When Promptly runs">
          <Row label="Open Promptly when I log in">
            <Switch id="settings-launchAtLogin" label="Open Promptly when I log in" checked={!!prefs.launchAtLogin} onChange={v => savePrefs({ launchAtLogin: v })} />
          </Row>
          <Row label="Copy prompts to the clipboard automatically">
            <Switch id="settings-autoCopy" label="Copy prompts to the clipboard automatically" checked={!!prefs.autoCopy} onChange={v => savePrefs({ autoCopy: v })} />
          </Row>
        </Section>
        <Section title="Permissions">
          <Row label="Hold to talk and selected text" hint="Promptly only watches your talk shortcut, and reads selected text when you start talking.">
            {prefs.accessibility?.trusted
              ? <span style={{ fontSize: 13, fontWeight: 500, color: GREEN_TEXT, whiteSpace: 'nowrap' }}>✓ Allowed</span>
              : <button type="button" onClick={handleAllowAccessibility} style={btn}>Allow</button>}
          </Row>
        </Section>
      </>
    )
    if (tab === 'dictation') return (
      <>
        <Section title="While you dictate">
          <Row label="Type into the app I'm in" hint={prefs.accessibility?.trusted ? 'Otherwise it waits on the clipboard for ⌘V.' : "Needs Accessibility (General → Permissions). Until then it's copied for ⌘V."}>
            <Switch id="settings-dictationTypeIn" label="Type into the app I'm in" checked={!!prefs.dictationTypeIn} onChange={v => savePrefs({ dictationTypeIn: v })} />
          </Row>
          <Row label="Remove um, uh and similar" hint="Nothing else is changed.">
            <Switch id="settings-dictationRemoveFillers" label="Remove um, uh and similar" checked={!!prefs.dictationRemoveFillers} onChange={v => savePrefs({ dictationRemoveFillers: v })} />
          </Row>
          <Row label="Write money and percentages as symbols" hint="₹12,450 and 25% instead of words.">
            <Switch id="settings-dictationSymbols" label="Write money and percentages as symbols" checked={!!prefs.dictationSymbols} onChange={v => savePrefs({ dictationSymbols: v })} />
          </Row>
        </Section>
        <Section title="Dictionary">
          <div style={{ display: 'grid', gap: 6, padding: '10px 0' }}>
            <label htmlFor="settings-dictionary" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(var(--ink),0.95)' }}>Names and terms to spell right</label>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Used when transcribing and when writing prompts. Separate them with commas.</span>
            <textarea
              id="settings-dictionary"
              value={dictionaryDraft}
              onChange={e => setDictionaryDraft(e.target.value)}
              onBlur={() => dictionaryDraft !== prefs.dictionary && savePrefs({ dictionary: dictionaryDraft })}
              placeholder="e.g. Supabase, Kubernetes, Aakash"
              rows={3}
              style={{ padding: '8px 10px', borderRadius: 8, border: '0.5px solid rgba(var(--ink),0.16)', background: 'rgba(var(--ink),0.05)', color: 'rgba(var(--ink),0.95)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5, outline: 'none', userSelect: 'text', WebkitAppRegion: 'no-drag' }}
            />
          </div>
        </Section>
      </>
    )
    if (tab === 'speech') return (
      <Section title="Speech recognition">
        <div style={{ padding: '10px 0' }}>
          {prefs.speech?.builtIn
            ? <SpeechSection speech={prefs.speech} onSave={savePrefs} bare />
            : <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>This copy of Promptly uses Whisper from your Mac; set its path in Setup.</span>}
        </div>
      </Section>
    )
    if (tab === 'prompts') return (
      <>
        <Section title="Writing">
          <Row label={'"Make it a prompt" uses'} hint="Turns a dictation into this kind of prompt." htmlFor="settings-promptStyle">
            <select id="settings-promptStyle" value={prefs.promptStyle} onChange={e => savePrefs({ promptStyle: e.target.value })} style={selectStyle}>
              {(prefs.promptStyles || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Row>
          <Row label="Prompt detail" hint="Detailed covers requirements, edge cases and success criteria. Quick keeps small requests short." htmlFor="settings-promptDetail">
            <select id="settings-promptDetail" value={prefs.promptDetail} onChange={e => savePrefs({ promptDetail: e.target.value })} style={selectStyle}>
              <option value="detailed">Detailed</option>
              <option value="quick">Quick</option>
            </select>
          </Row>
        </Section>
        {modelOptions.length > 0 && (
          <Section title="Model">
            <Row label="Claude model" hint={saveMsg && tab === 'prompts' ? <span style={{ color: readableColor(saveMsgColor) }}>{saveMsg}</span> : 'Runs through your Claude Code sign-in.'} htmlFor="settings-model">
              <select id="settings-model" value={modelVal} onChange={e => handleModelChange(e.target.value)} style={selectStyle}>
                {modelOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Row>
          </Section>
        )}
      </>
    )
    if (tab === 'you') return (
      <Section title="Your notes">
        <div style={{ padding: '10px 0' }}>
          <YouSection prefs={prefs} onSave={savePrefs} onEditCount={(editCount) => setPrefs((p) => ({ ...p, editCount }))} bare />
        </div>
      </Section>
    )
    return (
      <>
        <Section title="Claude Code">
          <PathField id="settings-claudePath" label="Claude Code" value={claudeVal} onChange={setClaudeVal} status={claudeStatus} placeholder="/usr/local/bin/claude" onBrowse={handleBrowseClaude} />
        </Section>
        <Section title="Speech to text">
          {speechBuiltIn ? (
            <Row label="Built in" hint="Runs on this Mac, nothing to install.">
              <span style={{ fontSize: 13, fontWeight: 500, color: GREEN_TEXT, whiteSpace: 'nowrap' }}>✓ Ready</span>
            </Row>
          ) : (
            <>
              <PathField id="settings-whisperPath" label="Whisper" value={whisperVal} onChange={setWhisperVal} status={whisperStatus} placeholder="/usr/local/bin/whisper" onBrowse={handleBrowseWhisper} />
              <PathField id="settings-ffmpegPath" label="ffmpeg" value={ffmpegVal} onChange={setFfmpegVal} status={ffmpegStatus} placeholder="/opt/homebrew/bin/ffmpeg" onBrowse={handleBrowseFfmpeg} />
            </>
          )}
        </Section>
        <Section title="Check">
          <Row label="Check the tools again" hint={saveMsg && tab === 'setup' ? <span style={{ color: readableColor(saveMsgColor) }}>{saveMsg}</span> : 'Saves the paths above and checks each one.'}>
            <button type="button" onClick={handleSaveRecheck} style={{ ...btn, background: 'linear-gradient(135deg,rgba(10,132,255,0.92),rgba(10,100,220,0.92))', border: 'none', color: 'var(--on-accent)', fontWeight: 600 }}>Check again</button>
          </Row>
          <Row label="Run setup again" hint="The first-time setup: microphone, Claude Code and permissions.">
            <button type="button" onClick={() => window.electronAPI?.reopenWizard?.()} style={btn}>Run setup</button>
          </Row>
        </Section>
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Title bar: the traffic lights sit on the left; the whole bar drags the window. */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px 0 96px', borderBottom: '0.5px solid rgba(var(--ink),0.1)', WebkitAppRegion: 'drag' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(var(--ink),0.95)' }}>Settings</span>
        <button type="button" onClick={onClose} style={{ ...btn, height: 30, marginLeft: 'auto', fontSize: 13 }}>Done</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <nav role="tablist" aria-label="Settings" aria-orientation="vertical" style={{ width: 92, flexShrink: 0, borderRight: '0.5px solid rgba(var(--ink),0.1)', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
          {TABS.map(([key, label]) => {
            const on = tab === key
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={`settings-tab-${key}`}
                aria-selected={on}
                aria-controls="settings-pane"
                onClick={() => { setTab(key); setSaveMsg('') }}
                style={{
                  height: 58, borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5,
                  display: 'grid', justifyItems: 'center', alignContent: 'center', gap: 5,
                  background: on ? 'rgba(var(--ink),0.08)' : 'transparent',
                  color: on ? BLUE_TEXT : 'var(--text-secondary)', fontWeight: on ? 600 : 400,
                  WebkitAppRegion: 'no-drag',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[key]}</svg>
                {label}
              </button>
            )
          })}
        </nav>
        <div id="settings-pane" role="tabpanel" aria-labelledby={`settings-tab-${tab}`} data-scroll-region style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          <div style={{ maxWidth: 620, margin: '0 auto', padding: '22px 28px 32px', display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 3 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: 'rgba(var(--ink),0.95)' }}>{tabTitle}</h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{tabHint}</p>
            </div>
            {renderTab()}
          </div>
        </div>
      </div>
    </div>
  )
}
