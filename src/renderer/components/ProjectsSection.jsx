import { useState } from 'react'
import useProjects from '../hooks/useProjects.js'
import { readableColor } from '../utils/promptUtils.js'

// Settings › Projects (D-PROJECT-MODES §29–30): each connected folder, whether its summary is up
// to date, and what can be done with it. Folders are picked in main; this only names project ids.

const AMBER = readableColor('rgb(255,179,64)')
const btn = { height: 28, padding: '0 12px', borderRadius: 8, border: '0.5px solid rgba(var(--ink),0.14)', background: 'rgba(var(--ink),0.05)', color: 'rgba(var(--ink),0.9)', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, WebkitAppRegion: 'no-drag' }
const primary = { ...btn, background: 'linear-gradient(135deg,rgba(10,132,255,0.92),rgba(10,100,220,0.92))', border: 'none', color: 'var(--on-accent)', fontWeight: 600 }
const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', borderTop: '0.5px solid rgba(var(--ink),0.07)', fontSize: 12.5 }
const key = { width: 130, flexShrink: 0, color: 'var(--text-secondary)' }

function day(ms) {
  if (!ms) return ''
  const d = new Date(ms)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }) })
}

function status(p) {
  if (p.missing) return { text: 'Folder not found', warn: true }
  if (p.building) return { text: 'Writing the summary…' }
  if (!p.summaryUpdatedAt) return { text: 'No summary yet', warn: true }
  if (p.newFiles > 0) return { text: `${p.newFiles} new file${p.newFiles === 1 ? '' : 's'} since your last refresh`, warn: true }
  return { text: `Up to date · ${day(p.summaryUpdatedAt)}` }
}

function ProjectCard({ p, open, onToggle, onPanel }) {
  const [confirming, setConfirming] = useState(false)
  const [alsoMd, setAlsoMd] = useState(false)
  const [message, setMessage] = useState('')
  const api = window.electronAPI
  const st = status(p)
  const folders = Object.entries(p.folders || {}).filter(([, f]) => f.on && f.kind !== 'exclude').map(([rel]) => (rel === '' ? 'top-level files' : rel))

  async function act(promise) {
    setMessage('')
    const r = await promise
    if (r && r.error) setMessage(r.error)
  }

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid rgba(var(--ink),0.1)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
        <button type="button" onClick={onToggle} aria-expanded={open} style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 650, color: 'rgba(var(--ink),0.95)' }}>{p.name}</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.dir}>{p.dir}</span>
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: st.warn ? AMBER : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{st.text}</span>
        {p.missing
          ? <button type="button" style={btn} onClick={() => act(api?.locateProject?.(p.id))}>Locate…</button>
          : <button type="button" style={p.newFiles > 0 || !p.summaryUpdatedAt ? primary : btn} disabled={p.building} onClick={() => act(api?.refreshProject?.(p.id))}>Refresh</button>}
      </div>
      {open && (
        <>
          <div style={rowStyle}>
            <span style={key}>Summary</span>
            <span style={{ color: 'rgba(var(--ink),0.88)' }}>{p.summaryUpdatedAt ? `Updated ${day(p.summaryUpdatedAt)} from ${p.summaryFileCount} file${p.summaryFileCount === 1 ? '' : 's'}` : 'Not written yet'}</span>
            <button type="button" style={{ ...btn, marginLeft: 'auto' }} onClick={() => onPanel({ kind: 'summary', id: p.id })}>Open and edit</button>
          </div>
          <div style={rowStyle}>
            <span style={key}>Folders it reads</span>
            <span style={{ color: 'rgba(var(--ink),0.88)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={folders.join(', ')}>{folders.join(', ') || 'None'}</span>
            <button type="button" style={{ ...btn, marginLeft: 'auto' }} disabled={p.missing} onClick={() => onPanel({ kind: 'folders', id: p.id })}>Change</button>
          </div>
          <div style={rowStyle}>
            <label htmlFor={`project-writes-${p.id}`} style={key}>Usually writes</label>
            <select id={`project-writes-${p.id}`} value={p.defaultOutput} onChange={(e) => act(api?.updateProject?.(p.id, { defaultOutput: e.target.value }))}
              style={{ height: 28, padding: '0 8px', borderRadius: 7, border: '0.5px solid rgba(var(--ink),0.16)', background: 'rgba(var(--ink),0.05)', color: 'rgba(var(--ink),0.95)', fontSize: 12.5, fontFamily: 'inherit' }}>
              <option value="email">Email</option><option value="prompt">Prompt</option><option value="polish">Polish</option>
            </select>
            <span style={{ color: 'var(--text-tertiary)' }}>“Reply to…” still makes an email, “write a prompt for…” a prompt.</span>
          </div>
          <div style={rowStyle}>
            <label htmlFor={`project-deeper-${p.id}`} style={key}>Look deeper</label>
            <input id={`project-deeper-${p.id}`} type="checkbox" checked={!!p.lookDeeper} onChange={(e) => act(api?.updateProject?.(p.id, { lookDeeper: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'rgb(10,132,255)' }} />
            <span style={{ color: 'var(--text-tertiary)' }}>With Claude Code, Claude may open more of the project’s files when it needs them (read-only). Slower, more thorough.</span>
          </div>
          <div style={rowStyle}>
            <span style={key}>Start over</span>
            <span style={{ color: 'var(--text-tertiary)' }}>Rebuild reads every file again. Your edits are kept.</span>
            <button type="button" style={{ ...btn, marginLeft: 'auto' }} disabled={p.building || p.missing} onClick={() => act(api?.rebuildProject?.(p.id))}>Rebuild summary</button>
            {!confirming && <button type="button" style={btn} onClick={() => setConfirming(true)}>Remove project</button>}
          </div>
          {confirming && (
            <div role="alert" style={{ ...rowStyle, background: 'rgba(var(--ink),0.03)' }}>
              <span style={{ color: 'rgba(var(--ink),0.9)' }}>Remove {p.name}? Promptly forgets its summary and search copy. Your folder isn’t touched.</span>
              {p.wrotePromptlyMd && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={alsoMd} onChange={(e) => setAlsoMd(e.target.checked)} />Also delete PROMPTLY.md
                </label>
              )}
              <button type="button" style={{ ...btn, marginLeft: 'auto' }} onClick={() => setConfirming(false)}>Keep</button>
              <button type="button" style={{ ...btn, color: readableColor('rgb(255,69,58)') }} onClick={() => act(api?.removeProject?.(p.id, { deletePromptlyMd: alsoMd }))}>Remove</button>
            </div>
          )}
          {message && <div role="alert" style={{ ...rowStyle, color: AMBER }}>{message}</div>}
        </>
      )}
    </div>
  )
}

export default function ProjectsSection({ onPanel }) {
  const projects = useProjects()
  const [open, setOpen] = useState(null)
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
          {projects.length ? 'New files count straight away when you ask for something. Refresh updates the summary with them.' : 'Connect a project folder and its own mode writes emails and prompts with what’s in it.'}
        </span>
        <button type="button" style={{ ...primary, marginLeft: 'auto' }} onClick={() => onPanel?.({ kind: 'connect' })}>Connect a folder…</button>
      </div>
      {projects.map((p) => (
        <ProjectCard key={p.id} p={p} open={open === p.id || projects.length === 1} onToggle={() => setOpen(open === p.id ? null : p.id)} onPanel={(x) => onPanel?.(x)} />
      ))}
    </div>
  )
}
