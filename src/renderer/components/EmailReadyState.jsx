import { useState, useRef } from 'react'

const TEAL = 'rgba(20,184,166)'
const TEAL_FULL = 'rgba(20,184,166,1)'
const TEAL_85 = 'rgba(20,184,166,0.85)'
const TEAL_60 = 'rgba(20,184,166,0.6)'
const TEAL_12 = 'rgba(20,184,166,0.12)'
const TEAL_06 = 'rgba(20,184,166,0.06)'

export default function EmailReadyState({
  emailOutput,
  transcript,
  onIterate,
  onReset,
  onSave,
  isSaved,
  isExpanded,
}) {
  const [copiedSubject, setCopiedSubject] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedBody, setEditedBody] = useState(emailOutput?.body || '')
  const bodyRef = useRef(null)

  const subject = emailOutput?.subject || ''
  const toneAnalysis = emailOutput?.toneAnalysis || {}

  function handleCopySubject() {
    navigator.clipboard.writeText(subject)
    setCopiedSubject(true)
    setTimeout(() => setCopiedSubject(false), 2000)
  }

  function handleCopyEmail() {
    navigator.clipboard.writeText(subject + '\n\n' + editedBody)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  function handleEditToggle() {
    if (isEditing) {
      const newText = bodyRef.current
        ? (bodyRef.current.innerText || bodyRef.current.textContent)
        : editedBody
      setEditedBody(newText)
      setIsEditing(false)
    } else {
      setIsEditing(true)
      // Focus after render
      setTimeout(() => {
        if (bodyRef.current) {
          bodyRef.current.focus()
          // Move cursor to end
          const range = document.createRange()
          const sel = window.getSelection()
          range.selectNodeContents(bodyRef.current)
          range.collapse(false)
          sel.removeAllRanges()
          sel.addRange(range)
        }
      }, 0)
    }
  }

  const btnBase = {
    fontSize: 12,
    background: 'rgba(255,255,255,0.06)',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    padding: '5px 12px',
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'inherit',
    WebkitAppRegion: 'no-drag',
  }

  const linkBtn = {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    fontFamily: 'inherit',
    WebkitAppRegion: 'no-drag',
  }

  const sectionLabel = {
    fontSize: 10,
    letterSpacing: '0.1em',
    color: 'rgba(255,255,255,0.4)',
    fontWeight: 600,
    textTransform: 'uppercase',
    marginBottom: 6,
    flexShrink: 0,
  }

  const divider = {
    height: 1,
    background: 'rgba(255,255,255,0.07)',
    margin: '10px 0',
    flexShrink: 0,
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px 10px 20px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: TEAL_85, flexShrink: 0,
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
            Email ready
          </span>
          {toneAnalysis.tone && (
            <span style={{
              background: TEAL_12,
              color: 'rgba(45,212,191,0.8)',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 500,
              WebkitAppRegion: 'no-drag',
            }}>
              {toneAnalysis.tone}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button style={linkBtn} onClick={onIterate}>Iterate ↻</button>
          <button style={linkBtn} onClick={onReset}>Reset</button>
        </div>
      </div>

      {/* Two-column grid */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1.4fr',
        gap: 20,
        padding: '0 20px 0 20px',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Left panel */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          paddingRight: 4,
          minHeight: 0,
        }}>
          {/* YOU SAID */}
          <div style={sectionLabel}>You Said</div>
          <p style={{
            fontSize: 12,
            fontStyle: 'italic',
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.55,
            margin: '0 0 16px 0',
          }}>
            {transcript}
          </p>

          <div style={divider} />

          {/* TONE ANALYSIS */}
          <div style={sectionLabel}>Tone Analysis</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {[
              ['Recipient', toneAnalysis.recipient],
              ['Tone', toneAnalysis.tone],
              ['Core message', toneAnalysis.coreMessage],
              ['Approach', toneAnalysis.approach],
            ].map(([label, value]) => value ? (
              <div key={label}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2, letterSpacing: '0.05em' }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
                  {value}
                </div>
              </div>
            ) : null)}
          </div>

          {/* WHY THIS TONE */}
          {toneAnalysis.whyThisTone && (
            <div style={{
              borderLeft: `2px solid ${TEAL_60}`,
              padding: '8px 12px',
              background: TEAL_06,
              borderRadius: '0 6px 6px 0',
            }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4, letterSpacing: '0.05em', fontWeight: 600 }}>
                Why this tone
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.55, margin: 0 }}>
                {toneAnalysis.whyThisTone}
              </p>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          minHeight: 0,
          borderLeft: '0.5px solid rgba(255,255,255,0.07)',
          paddingLeft: 20,
        }}>
          {/* SUBJECT LINE */}
          <div style={{ ...sectionLabel, marginBottom: 4 }}>Subject Line</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.85)', flex: 1, lineHeight: 1.4 }}>
              {subject}
            </span>
            <button
              onClick={handleCopySubject}
              style={{
                ...btnBase,
                fontSize: 11,
                padding: '3px 9px',
                flexShrink: 0,
                color: copiedSubject ? 'rgba(45,212,191,0.85)' : 'rgba(255,255,255,0.5)',
                background: copiedSubject ? TEAL_12 : 'rgba(255,255,255,0.05)',
              }}
            >
              {copiedSubject ? 'Copied ✓' : 'Copy'}
            </button>
          </div>

          <div style={divider} />

          {/* EMAIL BODY */}
          <div style={sectionLabel}>Email Body</div>
          <div
            ref={bodyRef}
            contentEditable={isEditing}
            suppressContentEditableWarning
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.75)',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              outline: 'none',
              border: isEditing ? `1px solid ${TEAL_60}` : '1px solid transparent',
              borderRadius: 6,
              padding: isEditing ? '8px 10px' : '0',
              background: isEditing ? 'rgba(20,184,166,0.04)' : 'transparent',
              transition: 'border 150ms ease, padding 150ms ease',
              cursor: isEditing ? 'text' : 'default',
              flex: 1,
              minHeight: 80,
            }}
          >
            {editedBody}
          </div>
        </div>
      </div>

      {/* Action row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '12px 20px',
        flexShrink: 0,
        marginTop: 8,
      }}>
        {/* Left: Edit + Save */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleEditToggle}
            style={{
              ...btnBase,
              color: isEditing ? 'rgba(45,212,191,0.85)' : 'rgba(255,255,255,0.6)',
              background: isEditing ? TEAL_12 : 'rgba(255,255,255,0.06)',
            }}
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>
          <button
            onClick={onSave}
            style={{
              ...btnBase,
              color: isSaved ? 'rgba(74,222,128,0.8)' : 'rgba(255,255,255,0.6)',
              background: isSaved ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.06)',
            }}
          >
            {isSaved ? 'Saved ✓' : 'Save'}
          </button>
        </div>

        {/* Right: Copy subject + Copy email */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleCopySubject}
            style={{
              ...btnBase,
              color: copiedSubject ? 'rgba(45,212,191,0.85)' : 'rgba(255,255,255,0.6)',
              background: copiedSubject ? TEAL_12 : 'rgba(255,255,255,0.06)',
            }}
          >
            {copiedSubject ? 'Copied ✓' : 'Copy subject'}
          </button>
          <button
            onClick={handleCopyEmail}
            style={{
              ...btnBase,
              fontWeight: 600,
              color: copiedEmail ? 'rgba(45,212,191,0.9)' : 'rgba(255,255,255,0.85)',
              background: copiedEmail
                ? TEAL_12
                : `linear-gradient(135deg, ${TEAL_85} 0%, rgba(13,148,136,0.8) 100%)`,
              border: copiedEmail ? `0.5px solid ${TEAL_60}` : 'none',
            }}
          >
            {copiedEmail ? 'Copied ✓' : 'Copy email'}
          </button>
        </div>
      </div>
    </div>
  )
}
