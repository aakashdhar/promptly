import { useState } from 'react'
import { readableColor } from '../utils/promptUtils.js'
import { HARNESS_ACCENT, bundleHarness } from '../hooks/useHarnessBuilder.js'
import ResultHeader, { ghostBtn } from './ResultHeader.jsx'
import HarnessRunPanel from './HarnessRunPanel.jsx'
import useCopy from '../hooks/useCopy.js'

const MONO = "'SF Mono', ui-monospace, Menlo, monospace"
const GREEN = readableColor('rgba(48,209,88,1)')
const COMMENT = /^\s*(#(?!!)|\/\/|<!--)/

const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '')
const nameOf = (p) => p.slice(p.lastIndexOf('/') + 1)

export default function HarnessFilesState({ plan, files, savedTo, scheduled, alreadyScheduled, onBackToPlan, onStartOver, onSaveToProject, onSchedule, onUnschedule, onCopy }) {
  const [active, setActive] = useState(0)
  const { copied, copy: copyText } = useCopy(1600)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  if (!files?.files?.length) return null
  const list = files.files
  const file = list[Math.min(active, list.length - 1)]

  function copy(kind) { copyText(kind === 'all' ? bundleHarness(files) : file.content, kind, onCopy) }

  async function save() {
    setSaving(true)
    setSaveError('')
    let result
    try {
      result = await onSaveToProject()
    } catch {
      result = { ok: false }
    } finally {
      setSaving(false)
    }
    if (result && !result.ok && !result.cancelled) setSaveError(result.error || 'Couldn’t save the files')
  }

  let lastDir = null
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ResultHeader
        left={
          <>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <i aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', background: HARNESS_ACCENT, flexShrink: 0 }} />{plan?.name || 'Harness'}
            </span>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}><span style={{ color: GREEN }}>✓</span>&nbsp; {list.length} {list.length === 1 ? 'file' : 'files'}</span>
          </>
        }
        right={
          <>
            {plan && <button type="button" onClick={onBackToPlan} style={ghostBtn}>Back to plan</button>}
            <button type="button" onClick={onStartOver} style={ghostBtn}>Start over</button>
          </>
        }
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div role="tablist" aria-label="Files" aria-orientation="vertical" style={{ width: '212px', flexShrink: 0, overflowY: 'auto', padding: '12px 10px', borderRight: '0.5px solid rgba(var(--ink),0.08)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {list.map((f, i) => {
            const dir = dirOf(f.path)
            const heading = dir !== lastDir ? <div key={`d-${dir}`} style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--text-tertiary)', padding: '8px 10px 3px' }}>{dir || './'}</div> : null
            lastDir = dir
            const on = f === file
            return [
              heading,
              <button
                key={f.path}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActive(i)}
                style={{ textAlign: 'left', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit', display: 'grid', gap: '1px', background: on ? 'rgba(var(--ink),0.07)' : 'transparent', boxShadow: on ? `inset 2px 0 0 ${HARNESS_ACCENT}` : 'none' }}
              >
                <span style={{ fontFamily: MONO, fontSize: '12px', color: on ? 'rgba(var(--ink),0.95)' : 'rgba(var(--ink),0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(f.path)}</span>
                {f.purpose && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.purpose}</span>}
              </button>,
            ]
          })}
        </div>
        <div role="tabpanel" aria-label={file.path} className="selectable" style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', padding: '14px 20px', fontFamily: MONO, fontSize: '12px', lineHeight: 1.7, color: 'rgba(var(--ink),0.88)' }}>
          {file.content.replace(/\n$/, '').split('\n').map((line, i) => (
            <div key={i} style={{ display: 'flex' }}>
              <span aria-hidden="true" style={{ width: '32px', flexShrink: 0, color: 'var(--text-tertiary)', userSelect: 'none' }}>{i + 1}</span>
              {/* Long lines wrap in place (the line number stays with the start of the line). */}
              <span style={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: COMMENT.test(line) ? 'var(--text-secondary)' : undefined }}>{line || ' '}</span>
            </div>
          ))}
        </div>
      </div>
      <HarnessRunPanel
        key={files.run + savedTo}
        run={files.run}
        suggested={files.schedule}
        savedTo={savedTo}
        scheduled={scheduled}
        alreadyScheduled={alreadyScheduled}
        onCopy={onCopy}
        onSchedule={onSchedule}
        onUnschedule={onUnschedule}
      />
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px', borderTop: '0.5px solid rgba(var(--ink),0.08)', minWidth: 0 }}>
        <button
          type="button"
          onClick={() => copy('file')}
          style={{ height: '36px', padding: '0 18px', fontFamily: 'inherit', border: '0.5px solid rgba(var(--ink),0.12)', background: 'rgba(var(--ink),0.05)', color: 'rgba(var(--ink),0.92)', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {copied === 'file' ? '✓ Copied' : 'Copy file'}
        </button>
        <button type="button" onClick={() => copy('all')} style={ghostBtn}>{copied === 'all' ? '✓ Copied all' : 'Copy all'}</button>
        <span style={{ fontSize: '12px', color: saveError ? readableColor('rgba(255,69,58,1)') : 'var(--text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {saveError || (savedTo ? <span title={savedTo}>Saved to {savedTo.replace(/\/+$/, '').split('/').pop()}</span> : null)}
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            height: '36px', padding: '0 20px', fontFamily: 'inherit', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: saving ? 'default' : 'pointer', whiteSpace: 'nowrap',
            background: savedTo ? 'linear-gradient(135deg, rgba(48,209,88,0.85), rgba(30,168,70,0.85))' : 'linear-gradient(135deg, rgba(10,132,255,0.95), rgba(10,100,220,0.95))',
            color: 'var(--on-accent)', boxShadow: savedTo ? '0 2px 16px rgba(48,209,88,0.35)' : '0 4px 16px rgba(10,132,255,0.35)',
          }}
        >
          {saving ? 'Saving…' : savedTo ? '✓ Saved' : 'Save to project…'}
        </button>
      </div>
    </div>
  )
}
