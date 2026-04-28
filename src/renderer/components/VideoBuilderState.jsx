import { useState } from 'react'

// Chip rows: key → { label, multi, options, badge }
// badge: 'api' | 'veo' | null
const CHIP_ROWS = [
  // Essential
  { key: 'cameraMovement', label: 'Camera', multi: true, badge: null, options: [
    'Static wide', 'Slow push-in', 'Pull back', 'Tracking follow',
    'Drone overhead', 'Handheld', 'Pan left/right', 'Tilt up/down',
    '360° orbit', 'POV / first person', 'Dolly zoom',
  ]},
  { key: 'aspectRatio', label: 'Ratio', multi: false, badge: 'api', options: [
    '16:9 landscape', '9:16 portrait',
  ]},
  { key: 'resolution', label: 'Resolution', multi: false, badge: 'api', options: [
    '720p', '1080p', '4K ✦',
  ]},
  { key: 'audio', label: 'Audio', multi: true, badge: 'veo', options: [
    'No audio', 'Ambient sound', 'Background music', 'Sound effects',
  ]},
  // Important
  { key: 'cinematicStyle', label: 'Style', multi: true, badge: null, options: [
    'Hyper-realistic', 'Cinematic film', 'Documentary',
    'Animation', 'Fantasy', 'Film noir', 'Dreamlike', 'Music video',
  ]},
  { key: 'lighting', label: 'Lighting', multi: true, badge: null, options: [
    'Golden hour', 'Dawn / soft mist', 'Blue hour / dusk',
    'Neon / artificial', 'Dramatic / harsh', 'Overcast / diffused',
    'Candlelight', 'Studio / clean',
  ]},
  { key: 'colourGrade', label: 'Colour', multi: true, badge: null, options: [
    'Teal & orange', 'Warm & golden', 'Cool & blue',
    'Desaturated / muted', 'High contrast', 'Monochrome',
    'Pastel / soft', 'Vivid / saturated',
  ]},
  { key: 'pacing', label: 'Pacing', multi: true, badge: null, options: [
    'Slow cuts', 'Real-time', 'Fast edit', 'Slow motion', 'Time-lapse', 'Match cuts',
  ]},
  // Advanced chip row
  { key: 'shotType', label: 'Shot type', multi: true, badge: null, options: [
    'Wide establishing', 'Medium', 'Close-up',
    'Extreme close-up', 'Over-shoulder', 'Two-shot',
  ]},
]

const ESSENTIAL_KEYS = new Set(['cameraMovement', 'aspectRatio', 'resolution', 'audio'])
const IMPORTANT_KEYS = new Set(['cinematicStyle', 'lighting', 'colourGrade', 'pacing'])
const ADVANCED_CHIP_KEYS = new Set(['shotType'])

const ORANGE = {
  chipAiBg: 'rgba(251,146,60,0.14)',
  chipAiBorder: 'rgba(251,146,60,0.38)',
  chipAiColor: 'rgba(251,146,60,0.95)',
  chipAiDot: 'rgba(251,146,60,0.9)',
  chipUserBg: 'rgba(251,146,60,0.22)',
  chipUserBorder: 'rgba(251,146,60,0.55)',
  chipUserColor: 'rgba(255,200,150,1)',
  btnConfirm: 'rgba(251,146,60,0.78)',
  advancedToggle: 'rgba(251,146,60,0.45)',
  sparkle: 'rgba(251,146,60,0.6)',
}

function ApiBadge() {
  return (
    <span style={{
      padding: '2px 6px', borderRadius: '4px', fontSize: '8.5px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      background: 'rgba(48,209,88,0.1)', border: '0.5px solid rgba(48,209,88,0.25)',
      color: 'rgba(48,209,88,0.7)', flexShrink: 0,
    }}>API</span>
  )
}

function VeoBadge() {
  return (
    <span style={{
      padding: '2px 6px', borderRadius: '4px', fontSize: '8.5px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      background: 'rgba(251,146,60,0.1)', border: '0.5px solid rgba(251,146,60,0.25)',
      color: 'rgba(251,146,60,0.7)', flexShrink: 0,
    }}>Veo 3.1</span>
  )
}

function chipIsAi(videoDefaults, key, value) {
  const def = videoDefaults?.[key]
  if (!def) return false
  if (Array.isArray(def)) return def.includes(value)
  return def === value
}

function getChipValues(videoAnswers, key, multi) {
  const v = videoAnswers?.[key]
  if (multi) return Array.isArray(v) ? v : []
  return v ? [v] : []
}

const INPUT_STYLE = {
  background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)',
  borderRadius: '7px', padding: '7px 10px', fontSize: '11px',
  color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', outline: 'none',
  width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
}

export default function VideoBuilderState({
  transcript,
  videoDefaults,
  videoAnswers,
  showAdvanced,
  activePickerParam,
  dialogueText,
  settingDetail,
  onChipRemove,
  onChipAdd,
  onParamChange,
  onToggleAdvanced,
  onOpenPicker,
  onClosePicker,
  onDialogueChange,
  onSettingChange,
  onConfirm,
  onCopyNow,
  onReiterate,
}) {
  const [showDialogueInput, setShowDialogueInput] = useState(false)

  function renderChipRow(row, labelW = '80px') {
    const { key, label, multi, options, badge } = row
    const values = getChipValues(videoAnswers, key, multi)
    const pickerOptions = options.filter(opt =>
      multi ? !values.includes(opt) : opt !== videoAnswers?.[key]
    )
    const isPicker = activePickerParam === key

    return (
      <div key={key} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'rgba(255,255,255,0.22)',
            minWidth: labelW, flexShrink: 0, lineHeight: 1,
          }}>{label}</span>
          {badge === 'api' && <ApiBadge />}
          {badge === 'veo' && <VeoBadge />}

          {values.map(value => {
            const ai = chipIsAi(videoDefaults, key, value)
            const display = value.length > 22 ? value.slice(0, 22) + '…' : value
            return (
              <button
                key={value}
                onClick={() => onChipRemove(key, value)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '4px 10px', borderRadius: '8px', fontSize: '11px',
                  cursor: 'pointer', lineHeight: 1.2, fontFamily: 'inherit',
                  background: ai ? ORANGE.chipAiBg : ORANGE.chipUserBg,
                  border: `0.5px solid ${ai ? ORANGE.chipAiBorder : ORANGE.chipUserBorder}`,
                  color: ai ? ORANGE.chipAiColor : ORANGE.chipUserColor,
                  fontWeight: ai ? 500 : 600,
                }}
              >
                {ai && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: ORANGE.chipAiDot, flexShrink: 0 }} />}
                {display}
              </button>
            )
          })}

          {/* 4K cost warning inline */}
          {key === 'resolution' && videoAnswers?.resolution === '4K ✦' && (
            <span style={{ fontSize: '10px', color: 'rgba(255,189,46,0.5)', marginLeft: '2px' }}>
              4K incurs higher API costs and longer generation time
            </span>
          )}

          <button
            onClick={() => onOpenPicker(key)}
            style={{
              padding: '4px 10px', borderRadius: '8px', fontSize: '11px',
              cursor: 'pointer', lineHeight: 1.2, fontFamily: 'inherit',
              border: '0.5px dashed rgba(255,255,255,0.15)',
              background: 'transparent', color: 'rgba(255,255,255,0.25)',
            }}
          >+ add</button>
        </div>

        {isPicker && (
          <>
            <div
              onMouseDown={e => { e.preventDefault(); onClosePicker() }}
              style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            />
            <div style={{
              position: 'absolute', top: 'calc(100% + 2px)', left: labelW,
              zIndex: 20, background: 'rgba(26,26,36,1)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', padding: '8px',
              maxHeight: '160px', overflowY: 'auto',
              display: 'flex', flexWrap: 'wrap', gap: '5px',
              minWidth: '200px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {pickerOptions.map(opt => (
                <button
                  key={opt}
                  onMouseDown={e => {
                    e.preventDefault()
                    if (multi) onChipAdd(key, opt)
                    else onParamChange(key, opt)
                    onClosePicker()
                  }}
                  style={{
                    padding: '4px 9px', borderRadius: '7px', fontSize: '11px',
                    cursor: 'pointer', fontFamily: 'inherit',
                    background: 'rgba(255,255,255,0.06)',
                    border: '0.5px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >{opt}</button>
              ))}
              {pickerOptions.length === 0 && (
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', padding: '2px 4px' }}>All selected</span>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  const essentialRows = CHIP_ROWS.filter(r => ESSENTIAL_KEYS.has(r.key))
  const importantRows = CHIP_ROWS.filter(r => IMPORTANT_KEYS.has(r.key))
  const advancedChipRows = CHIP_ROWS.filter(r => ADVANCED_CHIP_KEYS.has(r.key))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 28px', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <rect x="1" y="3" width="10" height="10" rx="2" stroke="rgba(251,146,60,0.7)" strokeWidth="1.3" fill="none"/>
            <path d="M11 6.5L15 4.5V11.5L11 9.5V6.5Z" stroke="rgba(251,146,60,0.7)" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
          </svg>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.04em' }}>Veo 3.1 builder</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1L7 4.5L10.5 5.5L7 6.5L6 10L5 6.5L1.5 5.5L5 4.5L6 1Z" fill={ORANGE.sparkle}/>
          </svg>
          <span style={{ fontSize: '11px', color: 'rgba(251,146,60,0.5)' }}>Claude filled these · tap to change</span>
        </div>
      </div>

      {/* YOU SAID */}
      <div style={{ flexShrink: 0, marginBottom: '8px' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.2)', marginBottom: '3px' }}>YOU SAID</div>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>{transcript}</p>
      </div>

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', flexShrink: 0, marginBottom: '8px' }} />

      {/* Scrollable params */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>

        {/* Essential params */}
        {essentialRows.map(row => renderChipRow(row))}

        {/* Duration info note */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 9px', background: 'rgba(255,255,255,0.02)',
          border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: '7px',
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
            <line x1="6" y1="5" x2="6" y2="8" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="6" cy="3.5" r="0.6" fill="rgba(255,255,255,0.2)"/>
          </svg>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>Veo 3.1 generates 8-second clips — duration is fixed</span>
        </div>

        {/* Important params */}
        {importantRows.map(row => renderChipRow(row))}

        {/* Advanced toggle */}
        <button
          onClick={onToggleAdvanced}
          style={{
            fontSize: '10.5px', color: ORANGE.advancedToggle, background: 'none',
            border: 'none', cursor: 'pointer', padding: '2px 0',
            textAlign: 'left', alignSelf: 'flex-start', fontFamily: 'inherit',
          }}
        >
          {showAdvanced ? '− Hide advanced parameters' : '+ Show advanced parameters'}
        </button>

        {/* Advanced params */}
        {showAdvanced && (
          <>
            {advancedChipRows.map(row => renderChipRow(row))}

            {/* Row 10: Setting detail — text input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.22)' }}>Setting</span>
              <input
                type="text"
                value={settingDetail}
                onChange={e => onSettingChange(e.target.value)}
                placeholder="Add setting details — location, time, weather..."
                style={INPUT_STYLE}
              />
            </div>

            {/* Row 11: Dialogue — toggle + text input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.22)', minWidth: '80px', flexShrink: 0 }}>Dialogue</span>
                <VeoBadge />
                <button
                  onClick={() => setShowDialogueInput(false)}
                  style={{
                    padding: '4px 10px', borderRadius: '8px', fontSize: '11px',
                    cursor: 'pointer', lineHeight: 1.2, fontFamily: 'inherit',
                    background: !showDialogueInput ? ORANGE.chipAiBg : 'rgba(255,255,255,0.04)',
                    border: `0.5px solid ${!showDialogueInput ? ORANGE.chipAiBorder : 'rgba(255,255,255,0.1)'}`,
                    color: !showDialogueInput ? ORANGE.chipAiColor : 'rgba(255,255,255,0.3)',
                    fontWeight: !showDialogueInput ? 500 : 400,
                  }}
                >No dialogue</button>
                <button
                  onClick={() => setShowDialogueInput(true)}
                  style={{
                    padding: '4px 10px', borderRadius: '8px', fontSize: '11px',
                    cursor: 'pointer', lineHeight: 1.2, fontFamily: 'inherit',
                    background: showDialogueInput ? ORANGE.chipAiBg : 'rgba(255,255,255,0.04)',
                    border: `0.5px solid ${showDialogueInput ? ORANGE.chipAiBorder : 'rgba(255,255,255,0.1)'}`,
                    color: showDialogueInput ? ORANGE.chipAiColor : 'rgba(255,255,255,0.3)',
                    fontWeight: showDialogueInput ? 500 : 400,
                  }}
                >Add spoken lines</button>
              </div>
              {showDialogueInput && (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={dialogueText}
                    onChange={e => onDialogueChange(e.target.value)}
                    placeholder='Type exact dialogue in quotes — Veo will speak it'
                    style={INPUT_STYLE}
                  />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', paddingLeft: '2px' }}>Veo 3.1 generates native speech from dialogue</span>
                </>
              )}
            </div>

            {/* Row 12: First frame */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.22)', minWidth: '80px', flexShrink: 0 }}>First frame</span>
                <VeoBadge />
                {['Text only', 'Use image as first frame'].map(opt => {
                  const active = opt === 'Text only' ? !videoAnswers?.useFirstFrame : !!videoAnswers?.useFirstFrame
                  return (
                    <button
                      key={opt}
                      onClick={() => onParamChange('useFirstFrame', opt === 'Use image as first frame')}
                      style={{
                        padding: '4px 10px', borderRadius: '8px', fontSize: '11px',
                        cursor: 'pointer', lineHeight: 1.2, fontFamily: 'inherit',
                        background: active ? ORANGE.chipAiBg : 'rgba(255,255,255,0.04)',
                        border: `0.5px solid ${active ? ORANGE.chipAiBorder : 'rgba(255,255,255,0.1)'}`,
                        color: active ? ORANGE.chipAiColor : 'rgba(255,255,255,0.3)',
                        fontWeight: active ? 500 : 400,
                      }}
                    >{opt}</button>
                  )
                })}
              </div>
              {videoAnswers?.useFirstFrame && (
                <div style={{ paddingLeft: '2px' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Provide an image to start video from a specific frame</span>
                  <div style={{ marginTop: '3px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(251,146,60,0.4)' }}>Generate with Nano Banana first →</span>
                  </div>
                </div>
              )}
            </div>

            {/* Row 13: Reference images */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.22)', minWidth: '80px', flexShrink: 0 }}>Ref images</span>
                <VeoBadge />
                {['None', 'Add reference images'].map(opt => {
                  const active = opt === 'None' ? !videoAnswers?.referenceImages : !!videoAnswers?.referenceImages
                  return (
                    <button
                      key={opt}
                      onClick={() => onParamChange('referenceImages', opt === 'Add reference images')}
                      style={{
                        padding: '4px 10px', borderRadius: '8px', fontSize: '11px',
                        cursor: 'pointer', lineHeight: 1.2, fontFamily: 'inherit',
                        background: active ? ORANGE.chipAiBg : 'rgba(255,255,255,0.04)',
                        border: `0.5px solid ${active ? ORANGE.chipAiBorder : 'rgba(255,255,255,0.1)'}`,
                        color: active ? ORANGE.chipAiColor : 'rgba(255,255,255,0.3)',
                        fontWeight: active ? 500 : 400,
                      }}
                    >{opt}</button>
                  )
                })}
              </div>
              {videoAnswers?.referenceImages && (
                <div style={{ paddingLeft: '2px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        style={{
                          width: '32px', height: '32px', borderRadius: '6px',
                          border: '1px dashed rgba(251,146,60,0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'rgba(251,146,60,0.4)', fontSize: '16px', cursor: 'pointer',
                        }}
                      >+</div>
                    ))}
                  </div>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>Up to 3 images — preserves subject appearance (face, outfit, product)</span>
                  <div style={{ marginTop: '2px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.15)' }}>Image reference upload coming in v2</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, paddingTop: '12px',
        borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '10px',
      }}>
        <button
          onClick={onReiterate}
          style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
        >↺ Reiterate</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={onCopyNow}
            style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
          >Copy now →</button>
          <button
            onClick={onConfirm}
            style={{
              padding: '7px 18px', borderRadius: '8px', fontSize: '12.5px',
              fontWeight: 600, background: ORANGE.btnConfirm,
              border: 'none', color: 'white', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Confirm &amp; generate →</button>
        </div>
      </div>
    </div>
  )
}
