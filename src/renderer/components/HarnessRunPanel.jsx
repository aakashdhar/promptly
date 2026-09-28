import { useState } from 'react'
import { readableColor, commandInFolder } from '../utils/promptUtils.js'
import useCopy from '../hooks/useCopy.js'
import { keys } from '../utils/keys.js'

// Under the harness files: the command that starts it (always visible, with Copy), and once the
// files are saved into a project, a schedule the system runs it on (launchd on a Mac, Task
// Scheduler on Windows; removable here).

const MONO = "'SF Mono', ui-monospace, Menlo, monospace"
const GREEN = readableColor('rgba(48,209,88,1)')
const RED = readableColor('rgba(255,69,58,1)')
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const EVERY = [['day', 'Every day'], ['weekday', 'Weekdays'], ['week', 'Every week'], ['hour', 'Every hour']]

const label = { width: '72px', flexShrink: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }
const control = {
  height: '28px', padding: '0 8px', borderRadius: '7px', border: '0.5px solid rgba(var(--ink),0.14)', background: 'rgba(var(--ink),0.05)',
  color: 'rgba(var(--ink),0.92)', fontSize: '12px', fontFamily: 'inherit', outline: 'none', WebkitAppRegion: 'no-drag',
}
const smallBtn = { ...control, padding: '0 12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }
const primaryBtn = { ...smallBtn, border: 'none', background: 'linear-gradient(135deg, rgba(10,132,255,0.95), rgba(10,100,220,0.95))', color: 'var(--on-accent)', fontWeight: 600 }

export default function HarnessRunPanel({ run, suggested, savedTo, scheduled, alreadyScheduled, onCopy, onSchedule, onUnschedule }) {
  const [when, setWhen] = useState(() => ({ every: 'day', time: '09:00', day: 1, ...(suggested || {}) }))
  const { copied, copy } = useCopy(1600)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!run) return null

  // Once saved, the copied command works from any terminal window (see commandInFolder).
  function copyRun() {
    copy(savedTo ? commandInFolder(savedTo, run, keys.os) : run, 'copied', onCopy)
  }

  async function act(fn) {
    setBusy(true)
    setError('')
    let result
    try {
      result = await fn()
    } catch {
      result = { ok: false }
    } finally {
      setBusy(false)
    }
    if (result && !result.ok) setError(result.error || 'That didn’t work')
  }

  const folder = savedTo ? savedTo.replace(/\/+$/, '').split('/').pop() : ''
  return (
    <div style={{ flexShrink: 0, display: 'grid', gap: '8px', padding: '12px 24px', borderTop: '0.5px solid rgba(var(--ink),0.08)', background: 'rgba(var(--ink),0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <span style={label}>Run it</span>
        <code aria-label="Run command" className="selectable" style={{ minWidth: 0, fontFamily: MONO, fontSize: '12px', color: 'rgba(var(--ink),0.92)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {run}
        </code>
        {folder && <span title={savedTo} style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>in {folder}</span>}
        <div style={{ flex: 1 }} />
        <button type="button" onClick={copyRun} style={smallBtn}>{copied ? '✓ Copied' : 'Copy command'}</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexWrap: 'wrap' }}>
        <span style={label}>Schedule</span>
        {!savedTo ? (
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Save to a project first, then it can run on its own.</span>
        ) : scheduled ? (
          <>
            <span style={{ fontSize: '12px', color: 'rgba(var(--ink),0.9)' }}><span style={{ color: GREEN }}>✓</span>&nbsp; Runs {scheduled}</span>
            <div style={{ flex: 1 }} />
            <button type="button" disabled={busy} onClick={() => act(onUnschedule)} style={smallBtn}>Remove schedule</button>
          </>
        ) : (
          <>
            <select aria-label="How often" value={when.every} onChange={(e) => setWhen((w) => ({ ...w, every: e.target.value }))} style={control}>
              {EVERY.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
            {when.every === 'week' && (
              <select aria-label="Day" value={when.day} onChange={(e) => setWhen((w) => ({ ...w, day: Number(e.target.value) }))} style={control}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            )}
            {when.every !== 'hour' && (
              <input type="time" aria-label="Time" value={when.time} onChange={(e) => setWhen((w) => ({ ...w, time: e.target.value }))} style={{ ...control, width: '120px' }} />
            )}
            <div style={{ flex: 1 }} />
            <button type="button" disabled={busy} onClick={() => act(() => onSchedule(when))} style={primaryBtn}>{busy ? 'Scheduling…' : 'Schedule it'}</button>
          </>
        )}
      </div>

      {savedTo && (
        <div style={{ paddingLeft: '82px', fontSize: '12px', lineHeight: 1.5, color: error ? RED : 'var(--text-secondary)' }}>
          {error || (scheduled
            ? 'If your Mac is asleep then, it runs when it wakes. Output goes to .harness/schedule.log.'
            : alreadyScheduled
              ? 'This folder already has a schedule. Scheduling again replaces it.'
              : 'Your Mac starts it at that time, even when Promptly is closed.')}
        </div>
      )}
    </div>
  )
}
