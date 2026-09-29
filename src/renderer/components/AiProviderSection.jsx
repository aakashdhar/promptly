import { useEffect, useState } from 'react'
import { readableColor } from '../utils/promptUtils.js'

// Settings → AI (D-AI-PROVIDERS): who writes your prompts. Claude Code by default; your own
// OpenAI, Gemini or Grok key when Claude Code isn't set up, or always if you choose. The key is
// sent once to be checked and saved (encrypted, on this computer); it's never shown again, only
// its last four characters.

const groupLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: 0 }
const selectStyle = { height: 30, minWidth: 210, maxWidth: 280, padding: '0 10px', borderRadius: 8, border: '0.5px solid rgba(var(--ink),0.16)', background: 'rgba(var(--ink),0.05)', color: 'rgba(var(--ink),0.95)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', WebkitAppRegion: 'no-drag' }
const btn = { height: 28, padding: '0 12px', borderRadius: 8, border: '0.5px solid rgba(var(--ink),0.14)', background: 'rgba(var(--ink),0.05)', color: 'rgba(var(--ink),0.9)', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, WebkitAppRegion: 'no-drag' }
const primaryBtn = { ...btn, background: 'linear-gradient(135deg,rgba(10,132,255,0.92),rgba(10,100,220,0.92))', border: 'none', color: 'var(--on-accent)', fontWeight: 600 }
const keyInput = { flex: 1, minWidth: 0, height: 30, background: 'rgba(var(--ink),0.05)', border: '0.5px solid rgba(var(--ink),0.14)', borderRadius: 8, padding: '0 10px', fontSize: 12, color: 'rgba(var(--ink),0.95)', fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", outline: 'none', boxSizing: 'border-box', userSelect: 'text', WebkitAppRegion: 'no-drag' }
const linkBtn = { background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2, WebkitAppRegion: 'no-drag' }
const GOOD = readableColor('rgba(48,209,88,0.9)')
const BAD = readableColor('rgba(255,59,48,0.9)')

function Section({ title, children }) {
  return (
    <section style={{ display: 'grid', gap: 2, paddingTop: 18, borderTop: '0.5px solid rgba(var(--ink),0.1)' }}>
      <h3 style={groupLabel}>{title}</h3>
      {children}
    </section>
  )
}

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

const MODES = [
  ['auto', 'Automatic (recommended)', 'Claude Code when it’s set up, otherwise your API key.'],
  ['claude', 'Claude Code', 'Always Claude Code.'],
  ['api', 'My API key', 'Always your API key, even when Claude Code is set up.'],
]

export default function AiProviderSection() {
  const api = window.electronAPI
  const [s, setS] = useState(null)
  const [draftKey, setDraftKey] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // { ok, text }
  const [models, setModels] = useState([])
  const [test, setTest] = useState(null) // { ok, text } | 'running'

  const provider = s?.provider || s?.providers?.[0]?.id || 'openai'
  const info = s?.providers?.find((p) => p.id === provider)
  const saved = s?.keys?.[provider]
  const chosen = s?.models?.[provider] || {}

  useEffect(() => { api?.getAiSettings?.().then(setS).catch(() => {}) }, [api])
  // The model lists come from the provider with the saved key.
  useEffect(() => {
    setModels([])
    if (!saved?.saved) return
    api?.listAiModels?.(provider).then((r) => { if (r?.ok) setModels(r.models) }).catch(() => {})
  }, [api, provider, saved?.saved])

  if (!s) return null

  async function update(patch) {
    setTest(null)
    setS(await api.setAiSettings(patch))
  }

  async function saveKey() {
    if (!draftKey.trim()) return
    setBusy(true)
    setMsg(null)
    const r = await api.saveAiKey(provider, draftKey).catch(() => ({ ok: false, error: 'Couldn’t save the key.' }))
    setBusy(false)
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return }
    setDraftKey('')
    setReplacing(false)
    setS(r.settings)
    setModels(r.models || [])
    setMsg({ ok: true, text: `Key checked and saved. Using ${r.settings.models?.[provider]?.model || 'the default model'}.` })
  }

  async function removeKey() {
    const r = await api.removeAiKey(provider)
    if (r?.ok) { setS(r.settings); setMsg(null); setModels([]) }
  }

  async function runTest() {
    setTest('running')
    const r = await api.testAi().catch(() => ({ ok: false, error: 'The test didn’t run.' }))
    setTest(r.ok
      ? { ok: true, text: `${r.provider}${r.model ? ` (${r.model})` : ''} answered in ${(r.ms / 1000).toFixed(1)} s.` }
      : { ok: false, text: r.error })
  }

  // "My API key" needs a saved key for the chosen provider; until then it can't be picked.
  const apiUsable = !!(s.provider && s.keys?.[s.provider]?.saved)
  const activeLabel = s.active === 'claude' ? 'Claude Code' : `${info?.label || 'Your key'}${chosen.model ? ` (${chosen.model})` : ''}`
  const modelOptions = (current) => [...new Set([current, ...models].filter(Boolean))]

  return (
    <>
      <Section title="Who writes your prompts">
        <p style={{ margin: '8px 0 4px', fontSize: 13, color: 'rgba(var(--ink),0.95)' }}>
          Now answering: <strong style={{ fontWeight: 600 }}>{activeLabel}</strong>
        </p>
        <div role="radiogroup" aria-label="Who writes your prompts" style={{ display: 'grid', gap: 6, padding: '8px 0' }}>
          {MODES.map(([value, label, hint]) => {
            const off = value === 'api' && !apiUsable
            return (
              <label key={value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 9, cursor: off ? 'default' : 'pointer', opacity: off ? 0.55 : 1, border: `0.5px solid ${s.mode === value ? 'rgba(var(--ink),0.28)' : 'rgba(var(--ink),0.1)'}`, background: s.mode === value ? 'rgba(var(--ink),0.06)' : 'transparent', WebkitAppRegion: 'no-drag' }}>
                <input type="radio" name="ai-mode" value={value} checked={s.mode === value} disabled={off} onChange={() => update({ mode: value })} style={{ marginTop: 2 }} />
                <span style={{ display: 'grid', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(var(--ink),0.95)' }}>{label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{off ? 'Save a key below first.' : hint}</span>
                </span>
              </label>
            )
          })}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', paddingBottom: 8 }}>Harness always uses Claude Code.</span>
      </Section>

      <Section title="Your API key">
        <Row label="Provider" hint="OpenAI, Gemini or Grok. Uses your own account." htmlFor="settings-ai-provider">
          <select id="settings-ai-provider" value={provider} onChange={(e) => { setMsg(null); setReplacing(false); setDraftKey(''); update({ provider: e.target.value }) }} style={selectStyle}>
            {s.providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Row>

        {!s.canStoreKeys && (
          <p style={{ margin: '4px 0 8px', fontSize: 12, color: BAD }}>This computer can’t store keys securely, so Promptly won’t save one.</p>
        )}

        {saved?.saved && !replacing ? (
          <Row label={`${info?.label} key`} hint={`Saved, encrypted on this computer. Ends in ${saved.last4}.`}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={btn} onClick={() => { setReplacing(true); setMsg(null) }}>Replace</button>
              <button type="button" style={btn} onClick={removeKey}>Remove</button>
            </div>
          </Row>
        ) : (
          <div style={{ display: 'grid', gap: 6, padding: '10px 0' }}>
            <label htmlFor="settings-ai-key" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(var(--ink),0.95)' }}>{info?.label} key</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input id="settings-ai-key" type="password" autoComplete="off" spellCheck="false" value={draftKey} placeholder={info?.keyHint} onChange={(e) => setDraftKey(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveKey() }} style={keyInput} />
              <button type="button" style={primaryBtn} disabled={busy || !draftKey.trim() || !s.canStoreKeys} onClick={saveKey}>{busy ? 'Checking…' : 'Check and save'}</button>
              {replacing && <button type="button" style={btn} onClick={() => { setReplacing(false); setDraftKey('') }}>Cancel</button>}
            </div>
            {info?.keysUrl && <span><button type="button" style={linkBtn} onClick={() => api.splashOpenURL(info.keysUrl)}>Get a key from {info.label}</button></span>}
          </div>
        )}
        {msg && <p role="status" style={{ margin: '0 0 8px', fontSize: 12, color: msg.ok ? GOOD : BAD }}>{msg.text}</p>}

        {saved?.saved && (
          <>
            <Row label="Model" hint="Writes prompts, emails and builder results." htmlFor="settings-ai-model">
              <select id="settings-ai-model" value={chosen.model || ''} onChange={(e) => update({ model: e.target.value })} style={selectStyle}>
                {modelOptions(chosen.model).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Row>
            <Row label="Fast model" hint="Fixes misheard words in Dictation. A small, quick model keeps it snappy." htmlFor="settings-ai-fast-model">
              <select id="settings-ai-fast-model" value={chosen.fastModel || ''} onChange={(e) => update({ fastModel: e.target.value })} style={selectStyle}>
                {modelOptions(chosen.fastModel).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Row>
          </>
        )}
      </Section>

      <Section title="Check">
        <Row label="Test" hint={test && test !== 'running' ? <span role="status" style={{ color: test.ok ? GOOD : BAD }}>{test.text}</span> : 'Sends a one-word request to whoever answers now.'}>
          <button type="button" style={btn} disabled={test === 'running'} onClick={runTest}>{test === 'running' ? 'Testing…' : 'Test'}</button>
        </Row>
      </Section>
    </>
  )
}
