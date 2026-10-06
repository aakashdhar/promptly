import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readableColor } from '../utils/promptUtils.js'
import { titleBarPadding } from '../utils/keys.js'
import { loadProjects } from '../utils/projects.js'

// Project modes (D-PROJECT-MODES §A–B): connecting a folder (what's in it, two questions, the
// summary) and, for a project already connected, changing its folders or reading and editing its
// summary. A full-window panel like Settings. Main picks every folder; this only names projects by id.

const KINDS = [
  ['overview', 'Overview'],
  ['conversations', 'Conversations'],
  ['agreements', 'Agreements'],
  ['build', 'How it’s built'],
  ['reference', 'Reference'],
  ['exclude', 'Leave out'],
]
const ROLES = [['manager', 'Manager'], ['developer', 'Developer'], ['designer', 'Designer'], ['sales', 'Sales'], ['other', 'Other']]
const WRITES = [['client-emails', 'Client emails'], ['team-prompts', 'Prompts for the team'], ['status-updates', 'Status updates'], ['other', 'Something else']]
const KIND_TINT = { overview: '236,236,240', conversations: '64,200,190', agreements: '227,179,65', build: '10,132,255', reference: '170,140,255', exclude: '140,140,150' }

const BLUE = readableColor('rgb(10,132,255)')
const AMBER = readableColor('rgb(255,179,64)')
const btn = { height: 30, padding: '0 14px', borderRadius: 8, border: '0.5px solid rgba(var(--ink),0.14)', background: 'rgba(var(--ink),0.05)', color: 'rgba(var(--ink),0.92)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', WebkitAppRegion: 'no-drag' }
const primary = { ...btn, background: 'linear-gradient(135deg,rgba(10,132,255,0.92),rgba(10,100,220,0.92))', border: 'none', color: 'var(--on-accent)', fontWeight: 600 }
const label = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }
const card = { background: 'var(--surface)', border: '0.5px solid rgba(var(--ink),0.1)', borderRadius: 12 }

function day(ms) {
  if (!ms) return ''
  const d = new Date(ms)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }) })
}

// What the scan left out, so nothing is skipped silently (spec §A2, §8).
const LEFT_OUT = { code: 'code', 'code-root': 'code folders', media: 'images, audio and video', 'too-big': 'over 2 MB', binary: 'not text', unsupported: 'other file types (PDF, Excel…)', ignored: 'in your ignore files', builtin: 'build and tool folders', hidden: 'hidden', empty: 'empty', symlink: 'links', unreadable: 'unreadable' }
function LeftOut({ skipped = {}, tooMany = 0 }) {
  const parts = Object.entries(skipped).filter(([reason, n]) => n > 0 && LEFT_OUT[reason]).map(([reason, n]) => `${n} ${LEFT_OUT[reason]}`)
  if (!parts.length && !tooMany) return null
  return (
    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--text-tertiary)' }}>
      Not read: {parts.join(', ')}{tooMany ? `${parts.length ? '; ' : ''}${tooMany} older files past the 5,000-file limit` : ''}.
    </p>
  )
}

function Segmented({ value, options, onChange, ariaLabel }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} style={{ display: 'inline-flex', gap: 2, padding: 2, borderRadius: 9, background: 'rgba(var(--ink),0.06)', flexWrap: 'wrap' }}>
      {options.map(([key, text]) => (
        <button key={key} type="button" role="radio" aria-checked={value === key} onClick={() => onChange(key)}
          style={{ height: 28, padding: '0 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: value === key ? 600 : 400, background: value === key ? 'var(--surface)' : 'transparent', boxShadow: value === key ? '0 1px 2px rgba(0,0,0,0.12)' : 'none', color: value === key ? 'rgba(var(--ink),0.95)' : 'var(--text-secondary)' }}>
          {text}
        </button>
      ))}
    </div>
  )
}

// The map: one row per top-level folder (and the top-level files), what Promptly thinks it is,
// and whether it is read.
function FolderMap({ folders, onChange }) {
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) 54px 70px 44px', gap: 12, alignItems: 'center', padding: '8px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)' }}>
        <span>Folder</span><span>Looks like</span><span>Files</span><span>Newest</span><span style={{ justifySelf: 'end' }}>Read</span>
      </div>
      {folders.map((f, i) => {
        const off = !f.on || f.kind === 'exclude'
        const name = f.rel === '' ? 'Top-level files' : f.rel
        return (
          <div key={f.rel || '(root)'} style={{ borderTop: '0.5px solid rgba(var(--ink),0.07)', padding: '8px 16px', display: 'grid', gap: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) 54px 70px 44px', gap: 12, alignItems: 'center', fontSize: 13, color: off ? 'var(--text-tertiary)' : 'rgba(var(--ink),0.92)' }}>
              <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name}</span>
              {f.codeRoot ? (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Left out: code</span>
              ) : (
                <select aria-label={`What ${name} holds`} value={f.kind === 'unsure' ? '' : f.kind}
                  onChange={(e) => onChange(i, { kind: e.target.value, on: e.target.value !== 'exclude', question: undefined })}
                  style={{ height: 26, maxWidth: 170, borderRadius: 6, padding: '0 6px', fontFamily: 'inherit', fontSize: 12, color: `rgb(${KIND_TINT[f.kind] || '236,236,240'})`, background: `rgba(${KIND_TINT[f.kind] || '236,236,240'},0.12)`, border: '0.5px solid rgba(var(--ink),0.12)' }}>
                  {f.kind === 'unsure' && <option value="" disabled>Not sure: choose…</option>}
                  {KINDS.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
                </select>
              )}
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{f.count ?? 0}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{day(f.newestMs)}</span>
              <input type="checkbox" aria-label={`Read ${name}`} checked={!!f.on && f.kind !== 'exclude' && !f.codeRoot} disabled={!!f.codeRoot || f.kind === 'exclude'}
                onChange={(e) => onChange(i, { on: e.target.checked })} style={{ justifySelf: 'end', width: 16, height: 16, accentColor: 'rgb(10,132,255)' }} />
            </div>
            {f.kind === 'unsure' && f.question && <div style={{ fontSize: 12, color: AMBER }}>{f.question}</div>}
          </div>
        )
      })}
    </div>
  )
}

// **bold** in a summary line (names), as text nodes only: nothing from the file becomes markup.
function withBold(text) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).map((part, i) => (/^\*\*[^*]+\*\*$/.test(part) ? <strong key={i} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong> : part))
}

// The summary, read view: headings, bullets, and each line's sources as small labels.
const TAG = /\s*[[(]sources?:\s*([^\])]*)[\])]\s*$/i
function SummaryView({ text }) {
  const lines = String(text || '').split('\n')
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {lines.map((line, i) => {
        if (/^#{1,6}\s/.test(line)) return <h3 key={i} style={{ margin: '10px 0 2px', fontSize: 13, fontWeight: 700, color: BLUE }}>{line.replace(/^#+\s*/, '')}</h3>
        if (!line.trim()) return null
        const m = TAG.exec(line)
        const body = (m ? line.slice(0, m.index) : line).replace(/^\s*[-*•]\s*/, '')
        return (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13.5, lineHeight: 1.5, color: 'rgba(var(--ink),0.9)' }}>
            <span style={{ flex: 1, minWidth: 0 }}>{withBold(body)}</span>
            {m && <span style={{ flexShrink: 0, maxWidth: '40%', overflowWrap: 'anywhere', fontSize: 11.5, lineHeight: 1.4, color: 'var(--text-tertiary)', border: '0.5px solid rgba(var(--ink),0.12)', borderRadius: 5, padding: '1px 6px' }}>{m[1]}</span>}
          </div>
        )
      })}
    </div>
  )
}

export default function ProjectConnectPanel({ panel, onClose }) {
  const [step, setStep] = useState(panel.kind === 'summary' ? 'summary' : 'loading')
  const [error, setError] = useState('')
  const [scan, setScan] = useState(null)          // { token, dir, name, warnings, skipped, tooMany }
  const [folders, setFolders] = useState([])
  const [mapError, setMapError] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('manager')
  const [writes, setWrites] = useState(['client-emails'])
  const [calls, setCalls] = useState(0)
  const [projectId, setProjectId] = useState(panel.id || null)
  const [progress, setProgress] = useState(null)  // { done, total, stage } | { finished, error }
  const [summary, setSummary] = useState(null)    // { text, updatedAt, fileCount, building }
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [keepInFolder, setKeepInFolder] = useState(false)
  const started = useRef(false)
  const closeRef = useRef(null)
  // Focus moves into the panel, so the keyboard isn't left on the (now unreachable) window behind it.
  useEffect(() => { closeRef.current?.focus() }, [])

  // Claude sorts the folders. When that fails the map shows every folder as Reference, and the
  // summary waits until a retry works (spec §A3).
  const sortFolders = useCallback(async (token) => {
    setStep('sorting')
    const map = await window.electronAPI.classifyProject(token)
    if (!map || map.cancelled) { onClose(); return }
    if (map.error && !map.folders) { setError(typeof map.error === 'string' ? map.error : map.error.message || ''); setStep('error'); return }
    setFolders(map.folders || [])
    setMapError(map.error ? map.error.message || 'Promptly couldn’t sort these; check them' : '')
    setStep('map')
  }, [onClose])

  // Start: pick and scan a folder (connect), or load the current map (folders).
  useEffect(() => {
    if (started.current) return
    started.current = true
    const api = window.electronAPI
    if (panel.kind === 'connect') {
      (async () => {
        const picked = await api?.connectProjectFolder?.()
        if (!picked || picked.cancelled) { onClose(); return }
        if (picked.error) { setError(picked.error); setStep('error'); return }
        setScan(picked)
        setName(picked.name || '')
        await sortFolders(picked.token)
      })()
    } else if (panel.kind === 'folders') {
      api?.getProjectFolders?.(panel.id).then((r) => {
        if (!r || r.error) { setError(r?.error || 'Promptly couldn’t read the folder'); setStep('error'); return }
        setFolders(r.folders || [])
        setStep('map')
      })
    }
  }, [panel, onClose, sortFolders])


  // How many Claude calls the first summary takes, for the button.
  const folderMap = useMemo(() => Object.fromEntries(folders.map((f) => [f.rel, { kind: f.kind === 'unsure' ? 'reference' : f.kind, on: !!f.on && f.kind !== 'exclude' && !f.codeRoot }])), [folders])
  useEffect(() => {
    if (panel.kind !== 'connect' || !scan) return undefined
    let live = true
    window.electronAPI?.estimateProjectCalls?.(scan.token, folderMap).then((n) => { if (live && typeof n === 'number') setCalls(n) })
    return () => { live = false }
  }, [panel.kind, scan, folderMap])

  // Summary progress for this project.
  useEffect(() => {
    if (!projectId) return undefined
    return window.electronAPI?.onProjectProgress?.((e) => {
      if (!e || e.id !== projectId) return
      setProgress(e)
      if (e.finished) loadSummary(projectId)
    })
  }, [projectId])

  async function loadSummary(id) {
    const s = await window.electronAPI?.getProjectSummary?.(id)
    if (s && !s.error) {
      setSummary(s)
      setDraft(s.text || '')
      if (s.building) setProgress((p) => p || { done: 0, total: 0, stage: 'reading' })
    }
    const list = await loadProjects()
    const p = list.find((x) => x.id === id)
    if (p) setKeepInFolder(!!p.keepInFolder)
  }
  useEffect(() => { if (panel.kind === 'summary' && panel.id) loadSummary(panel.id) }, [panel])

  const unsure = folders.some((f) => f.kind === 'unsure' && f.on)
  const nothingReadable = step === 'map' && panel.kind === 'connect' && !folders.some((f) => (f.count || 0) > 0)
  const readsSomething = folders.some((f) => f.on && f.kind !== 'exclude' && !f.codeRoot)

  async function saveMap() {
    if (panel.kind === 'folders') {
      const r = await window.electronAPI?.updateProject?.(panel.id, { folders: folderMap })
      if (r && r.error) { setError(r.error); return }
      onClose()
      return
    }
    const r = await window.electronAPI?.saveProject?.({ token: scan.token, name, role, writes, folders: folderMap, keepInFolder: false })
    if (!r || r.error) { setError(r?.error || 'Promptly couldn’t save the project'); return }
    setProjectId(r.id)
    setProgress({ done: 0, total: calls || 1, stage: 'reading' })
    setStep('summary')
  }

  async function saveEdit() {
    const s = await window.electronAPI?.setProjectSummary?.(projectId, draft)
    if (s && !s.error) { setSummary(s); setEditing(false) }
  }

  async function chooseKeep(inFolder) {
    setKeepInFolder(inFolder)
    await window.electronAPI?.updateProject?.(projectId, { keepInFolder: inFolder })
  }

  const building = progress && !progress.finished
  const failed = progress && progress.finished && progress.error
  const title = panel.kind === 'folders' ? 'Folders it reads' : panel.kind === 'summary' ? 'Project summary' : 'Connect a project'
  const stepLine = panel.kind === 'connect' ? (step === 'summary' ? 'Step 2 of 2 · What Promptly knows' : 'Step 1 of 2 · What’s in the folder') : ''

  return (
    <div role="dialog" aria-modal="true" aria-label={title} onKeyDown={(e) => { if (e.key === 'Escape' && !editing) { e.stopPropagation(); onClose() } }}
      style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: titleBarPadding('0 18px 0 96px', 18), borderBottom: '0.5px solid rgba(var(--ink),0.1)', WebkitAppRegion: 'drag' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(var(--ink),0.95)' }}>{title}</span>
        {stepLine && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{stepLine}</span>}
        <button ref={closeRef} type="button" onClick={onClose} style={{ ...btn, marginLeft: 'auto' }}>
          {step === 'summary' ? (building ? 'Close' : 'Done') : 'Cancel'}
        </button>
      </div>

      <div data-scroll-region style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '22px 28px 28px', display: 'grid', gap: 16 }}>
          {(step === 'loading' || step === 'sorting') && (
            <p role="status" style={{ margin: '40px 0', textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
              {step === 'sorting' ? 'Looking at the folder names and a few files to see what each folder holds…' : 'Opening the folder…'}
            </p>
          )}

          {step === 'error' && (
            <div style={{ display: 'grid', gap: 12, justifyItems: 'start', margin: '30px 0' }}>
              <p role="alert" style={{ margin: 0, fontSize: 14, color: 'rgba(var(--ink),0.92)' }}>{error}</p>
              <button type="button" onClick={onClose} style={btn}>Close</button>
            </div>
          )}

          {step === 'map' && (
            <>
              {panel.kind === 'connect' && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={label}>Project name</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
                      style={{ height: 30, width: 260, padding: '0 10px', borderRadius: 8, border: '0.5px solid rgba(var(--ink),0.16)', background: 'var(--surface)', color: 'rgba(var(--ink),0.95)', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }} />
                  </label>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', overflowWrap: 'anywhere' }}>{scan?.dir}</span>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                    Promptly looked at the folder names and the first lines of a few files to work out what each folder holds. Check it, switch off anything it shouldn’t read, and answer the two questions.
                  </p>
                </div>
              )}
              {scan?.warnings?.length > 0 && (
                <p role="alert" style={{ margin: 0, fontSize: 12.5, color: AMBER }}>
                  {scan.warnings.map((w) => `${w.rel}: ${w.reason}`).join(' · ')}. Those ignore rules weren’t applied.
                </p>
              )}
              {mapError && (
                <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: AMBER }}>{mapError}</p>
                  {panel.kind === 'connect' && <button type="button" style={{ ...btn, marginLeft: 'auto' }} onClick={() => sortFolders(scan.token)}>Sort again</button>}
                </div>
              )}
              {panel.kind === 'connect' && scan && <LeftOut skipped={scan.skipped} tooMany={scan.tooMany} />}

              {panel.kind === 'connect' && (
                <div style={{ ...card, padding: '14px 16px', display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <span style={{ ...label, width: 180 }}>Your role on this project</span>
                    <Segmented value={role} options={ROLES} onChange={setRole} ariaLabel="Your role on this project" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <span style={{ ...label, width: 180 }}>What you’ll mostly write</span>
                    <div role="group" aria-label="What you'll mostly write" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {WRITES.map(([key, text]) => {
                        const on = writes.includes(key)
                        return (
                          <button key={key} type="button" aria-pressed={on} onClick={() => setWrites((w) => (on ? w.filter((x) => x !== key) : [...w, key]))}
                            style={{ height: 28, padding: '0 12px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 600 : 400, color: on ? BLUE : 'var(--text-secondary)', background: on ? 'rgba(10,132,255,0.12)' : 'transparent', border: `0.5px solid ${on ? 'rgba(10,132,255,0.5)' : 'rgba(var(--ink),0.14)'}` }}>
                            {text}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {nothingReadable && <p role="alert" style={{ margin: 0, fontSize: 13, color: AMBER }}>Nothing Promptly can read here: it reads .md, .txt, .eml, .mbox and .html files{navigator.platform.startsWith('Mac') ? ', and Word and RTF documents' : ''}.</p>}
              <FolderMap folders={folders} onChange={(i, patch) => setFolders((list) => list.map((f, j) => (j === i ? { ...f, ...patch } : f)))} />

              {error && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: AMBER }}>{error}</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: 'var(--text-tertiary)', maxWidth: 520 }}>
                  Files stay on this Mac. Claude reads the switched-on folders on your own account, only when it writes the summary or something you ask for.
                </p>
                <button type="button" onClick={saveMap} disabled={!readsSomething || unsure || (panel.kind === 'connect' && !!mapError)} style={{ ...primary, marginLeft: 'auto', opacity: !readsSomething || unsure || (panel.kind === 'connect' && mapError) ? 0.5 : 1 }}>
                  {panel.kind === 'folders' ? 'Save' : `Write the summary${calls ? ` (about ${calls} Claude call${calls === 1 ? '' : 's'})` : ''}`}
                </button>
              </div>
              {unsure && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'right' }}>Choose what each “Not sure” folder holds first.</p>}
            </>
          )}

          {step === 'summary' && (
            <>
              {building && (
                <div role="status" style={{ ...card, padding: '16px 18px', display: 'grid', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(var(--ink),0.92)' }}>
                    {progress.stage === 'merging' ? 'Writing the summary…' : `Reading the files… ${progress.done || 0} of ${progress.total || 0}`}
                  </span>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(var(--ink),0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, Math.round(((progress.done || 0) / Math.max(1, progress.total || 1)) * 100))}%`, background: 'rgb(10,132,255)', transition: 'width 300ms' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>You can close this; Promptly keeps going and the project is ready when it finishes.</span>
                    <button type="button" style={{ ...btn, marginLeft: 'auto' }} onClick={() => window.electronAPI?.cancelProjectBuild?.(projectId)}>Stop</button>
                  </div>
                </div>
              )}
              {failed && (
                <div role="alert" style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'rgba(var(--ink),0.9)', flex: 1 }}>The summary stopped: {progress.error}</span>
                  <button type="button" style={btn} onClick={() => { setProgress({ done: 0, total: 1, stage: 'reading' }); window.electronAPI?.refreshProject?.(projectId) }}>Try again</button>
                </div>
              )}
              {summary && !building && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 240px', gap: 22, alignItems: 'start' }}>
                  <div style={{ ...card, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '0.5px solid rgba(var(--ink),0.08)' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {summary.fileCount ? `Written from ${summary.fileCount} file${summary.fileCount === 1 ? '' : 's'}` : 'Not written yet'}{summary.updatedAt ? ` · ${day(summary.updatedAt)}` : ''}
                      </span>
                      {editing ? (
                        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                          <button type="button" style={btn} onClick={() => { setEditing(false); setDraft(summary.text || '') }}>Cancel</button>
                          <button type="button" style={primary} onClick={saveEdit}>Save</button>
                        </span>
                      ) : (
                        <button type="button" style={{ ...btn, marginLeft: 'auto' }} onClick={() => setEditing(true)}>Edit</button>
                      )}
                    </div>
                    <div style={{ padding: '12px 16px 16px' }}>
                      {editing ? (
                        <textarea aria-label="Project summary" value={draft} onChange={(e) => setDraft(e.target.value)}
                          style={{ width: '100%', minHeight: 360, boxSizing: 'border-box', resize: 'vertical', padding: 10, borderRadius: 8, border: '0.5px solid rgba(var(--ink),0.16)', background: 'var(--bg)', color: 'rgba(var(--ink),0.92)', fontSize: 13, lineHeight: 1.55, fontFamily: 'inherit' }} />
                      ) : summary.text ? <SummaryView text={summary.text} /> : <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>No summary yet.</p>}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 16 }}>
                    <div role="radiogroup" aria-label="Keep the summary" style={{ display: 'grid', gap: 6 }}>
                      <span style={label}>Keep the summary</span>
                      {[[false, 'In Promptly', 'Nothing is added to your folder.'], [true, 'In the folder too', 'Saved as PROMPTLY.md so others and other tools can read it.']].map(([value, text, hint]) => (
                        <button key={text} type="button" role="radio" aria-checked={keepInFolder === value} onClick={() => chooseKeep(value)}
                          style={{ textAlign: 'left', padding: '9px 11px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', background: keepInFolder === value ? 'rgba(10,132,255,0.08)' : 'transparent', border: `0.5px solid ${keepInFolder === value ? 'rgba(10,132,255,0.55)' : 'rgba(var(--ink),0.12)'}` }}>
                          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(var(--ink),0.92)' }}>{text}</span>
                          <span style={{ display: 'block', fontSize: 12, lineHeight: 1.4, color: 'var(--text-secondary)' }}>{hint}</span>
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <span style={label}>When it’s used</span>
                      <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>Only in this project’s mode, or when you pick it after a dictation. Dictation itself never uses it.</span>
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <span style={label}>Your edits win</span>
                      <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>Anything you change is kept as you wrote it. Refresh adds what’s new around it.</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
