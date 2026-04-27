import { useState } from 'react'

export const PARAM_CONFIG = [
  // Essential (11 rows — shown by default)
  { key: 'model', label: 'Model', multi: false, options: ['Nano Banana', 'Nano Banana 2', 'Nano Banana Pro'] },
  { key: 'useCase', label: 'Use case', multi: false, options: ['Photorealistic scene', 'Stylized illustration / sticker', 'Style transfer', 'Product mockup / commercial', 'Icon / UI asset', 'Infographic / text layout', '3D render / isometric'] },
  { key: 'subjectDetail', label: 'Subject detail', multi: true, options: ['Add age / appearance', 'Add expression', 'Add clothing', 'Add skin / texture detail', 'Keep as spoken'] },
  { key: 'style', label: 'Style', multi: true, options: ['Photorealistic', 'Illustration', 'Oil painting', 'Film photography', '3D render', 'Cinematic', 'Watercolour', 'Anime / manga', 'Isometric', 'Claymation'] },
  { key: 'lighting', label: 'Lighting', multi: true, options: ['Golden hour', 'Studio softbox', 'Natural overcast', 'Dramatic side light', 'Neon / artificial', 'Backlit silhouette', 'Blue hour / dusk', 'Candlelight'] },
  { key: 'composition', label: 'Composition', multi: true, options: ['Close-up portrait', 'Medium shot', 'Wide establishing', 'Rule of thirds', 'Symmetrical', 'Aerial / overhead', 'Macro / extreme close'] },
  { key: 'cameraAngle', label: 'Camera angle', multi: true, options: ['Eye level', 'Low angle', 'High angle', 'Dutch tilt', "Bird's eye", "Worm's eye"] },
  { key: 'aspectRatio', label: 'Ratio', multi: false, options: ['Square 1:1', 'Portrait 9:16', 'Landscape 16:9', 'Widescreen 21:9', '4:3 classic', '3:2 photo'] },
  { key: 'colourPalette', label: 'Colour', multi: true, options: ['Warm & golden', 'Cool & blue', 'Muted & desaturated', 'Vivid & saturated', 'Monochrome', 'Pastel', 'High contrast'] },
  { key: 'background', label: 'Background', multi: true, options: ['Natural / contextual', 'White background', 'Transparent / no background', 'Solid colour', 'Gradient', 'Blurred / bokeh background', 'Black background', 'Custom / describe it'], custom: 'Custom / describe it' },
  { key: 'mood', label: 'Mood', multi: true, options: ['Serene', 'Dramatic', 'Nostalgic', 'Mysterious', 'Energetic', 'Melancholic', 'Futuristic', 'Dreamlike'] },
  // Advanced (7 rows — hidden by default)
  { key: 'resolution', label: 'Resolution', multi: false, options: ['Standard quality', 'High detail', 'Ultra detailed / 4K', 'Hyperreal / 8K', 'Professional print quality'] },
  { key: 'lens', label: 'Lens', multi: true, options: ['35mm film', '50mm portrait', '85mm bokeh', 'Wide angle', 'Macro', 'Anamorphic', 'Fisheye'] },
  { key: 'textInImage', label: 'Text', multi: false, options: ['No text needed', 'Yes — title/headline', 'Yes — label/caption', 'Yes — logo/wordmark', 'Yes — signage'] },
  { key: 'detailLevel', label: 'Detail level', multi: false, options: ['Minimal / clean', 'Moderate detail', 'Highly detailed', 'Ultra detailed / hyperreal'] },
  { key: 'avoid', label: 'Avoid', multi: true, options: ['No text', 'No people', 'No shadows', 'No background', 'Keep minimal', 'Custom (type it)'], custom: 'Custom (type it)' },
  { key: 'surfaceMaterial', label: 'Surface', multi: true, options: ['Matte', 'Glossy', 'Metallic', 'Fabric / textile', 'Natural / organic', 'Glass'] },
  { key: 'postProcessing', label: 'Post-process', multi: true, options: ['Film grain', 'Vintage / faded', 'HDR', 'Matte grade', 'Clean / neutral', 'Tilt-shift'] },
]

const ADVANCED_KEYS = new Set(['resolution', 'lens', 'textInImage', 'detailLevel', 'avoid', 'surfaceMaterial', 'postProcessing'])

function chipIsAi(imageDefaults, key, value) {
  const def = imageDefaults?.[key]
  if (!def) return false
  if (Array.isArray(def)) return def.includes(value)
  return def === value
}

function getChipValues(imageAnswers, key, multi) {
  const v = imageAnswers?.[key]
  if (multi) return Array.isArray(v) ? v : []
  return v ? [v] : []
}

export default function ImageBuilderState({
  transcript,
  imageDefaults,
  imageAnswers,
  showAdvanced,
  activePickerParam,
  onChipRemove,
  onChipAdd,
  onParamChange,
  onToggleAdvanced,
  onOpenPicker,
  onClosePicker,
  onConfirm,
  onCopyNow,
  onReiterate,
  isExpanded,
}) {
  const [customActiveParam, setCustomActiveParam] = useState(null)
  const [customText, setCustomText] = useState('')

  function handlePickerOption(key, multi, value, customOption) {
    if (customOption && value === customOption) {
      onClosePicker()
      setCustomActiveParam(key)
      setCustomText('')
      return
    }
    if (multi) onChipAdd(key, value)
    else onParamChange(key, value)
    onClosePicker()
  }

  function handleCustomConfirm(key, multi) {
    const text = customText.trim()
    if (text) {
      if (multi) onChipAdd(key, text)
      else onParamChange(key, text)
    }
    setCustomActiveParam(null)
    setCustomText('')
  }

  const visibleParams = PARAM_CONFIG.filter(p => showAdvanced || !ADVANCED_KEYS.has(p.key))

  function renderRow(param, labelW) {
    const { key, label, multi, options, custom } = param
    const values = getChipValues(imageAnswers, key, multi)

    const pickerOptions = options.filter(opt => {
      if (multi) return !values.includes(opt)
      return opt !== imageAnswers?.[key]
    })

    const isPicker = activePickerParam === key
    const isCustomActive = customActiveParam === key

    return (
      <div key={key} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'rgba(255,255,255,0.22)',
            minWidth: labelW, flexShrink: 0, lineHeight: 1,
          }}>{label}</span>

          {values.map(value => {
            const ai = chipIsAi(imageDefaults, key, value)
            const display = value.length > 20 ? value.slice(0, 20) + '…' : value
            return (
              <button
                key={value}
                onClick={() => onChipRemove(key, value)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '4px 10px', borderRadius: '8px', fontSize: '11px',
                  cursor: 'pointer', lineHeight: 1.2, fontFamily: 'inherit',
                  background: ai ? 'rgba(139,92,246,0.14)' : 'rgba(139,92,246,0.22)',
                  border: `0.5px solid ${ai ? 'rgba(139,92,246,0.38)' : 'rgba(139,92,246,0.55)'}`,
                  color: ai ? 'rgba(167,139,250,0.95)' : 'rgba(200,180,255,1)',
                  fontWeight: ai ? 500 : 600,
                }}
              >
                {ai && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(139,92,246,0.9)', flexShrink: 0 }} />}
                {display}
              </button>
            )
          })}

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

        {isCustomActive && (
          <input
            autoFocus
            type="text"
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCustomConfirm(key, multi) }}
            onBlur={() => handleCustomConfirm(key, multi)}
            placeholder="Describe it…"
            style={{
              marginLeft: labelW,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px',
              padding: '6px 10px', fontSize: '11.5px', color: 'rgba(255,255,255,0.75)',
              outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        )}

        {isPicker && (
          <>
            <div
              onMouseDown={e => { e.preventDefault(); onClosePicker() }}
              style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            />
            <div style={{
              position: 'absolute', top: 'calc(100% + 2px)', left: labelW,
              zIndex: 20, background: '#1a1a24',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', padding: '8px',
              maxHeight: '160px', overflowY: 'auto',
              display: 'flex', flexWrap: 'wrap', gap: '5px',
              minWidth: '180px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {pickerOptions.map(opt => (
                <button
                  key={opt}
                  onMouseDown={e => { e.preventDefault(); handlePickerOption(key, multi, opt, custom) }}
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

  if (isExpanded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 28px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <rect x="1" y="3" width="14" height="10" rx="2" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" fill="none"/>
              <circle cx="5.5" cy="6.5" r="1.5" fill="rgba(255,255,255,0.45)"/>
              <path d="M1 11l4-3 3 2.5 3-3.5 4 4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
            </svg>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.04em' }}>Nano Banana builder</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
              <path d="M6 1L7 4.5L10.5 5.5L7 6.5L6 10L5 6.5L1.5 5.5L5 4.5L6 1Z" fill="rgba(139,92,246,0.6)"/>
            </svg>
            <span style={{ fontSize: '11px', color: 'rgba(139,92,246,0.55)' }}>Claude filled these for you</span>
          </div>
        </div>

        {/* YOU SAID */}
        <div style={{ flexShrink: 0, marginBottom: '10px' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.2)', marginBottom: '4px' }}>YOU SAID</div>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>{transcript}</p>
        </div>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', flexShrink: 0, marginBottom: '10px' }} />

        {/* Scrollable params */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '7px', paddingRight: '2px' }}>
          {visibleParams.map(param => renderRow(param, '80px'))}
          <button
            onClick={onToggleAdvanced}
            style={{ fontSize: '10.5px', color: 'rgba(139,92,246,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', textAlign: 'left', alignSelf: 'flex-start', fontFamily: 'inherit' }}
          >
            {showAdvanced ? '− Hide advanced parameters' : '+ Show advanced parameters'}
          </button>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '10px' }}>
          <button onClick={onReiterate} style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>↺ Reiterate</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={onCopyNow} style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Copy now →</button>
            <button onClick={onConfirm} style={{ padding: '7px 18px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, background: 'rgba(139,92,246,0.75)', border: 'none', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
              Confirm & generate →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Compact bar layout
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px 14px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <rect x="1" y="3" width="14" height="10" rx="2" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" fill="none"/>
            <circle cx="5.5" cy="6.5" r="1.5" fill="rgba(255,255,255,0.45)"/>
            <path d="M1 11l4-3 3 2.5 3-3.5 4 4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
          </svg>
          <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.04em' }}>Nano Banana builder</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
            <path d="M6 1L7 4.5L10.5 5.5L7 6.5L6 10L5 6.5L1.5 5.5L5 4.5L6 1Z" fill="rgba(139,92,246,0.6)"/>
          </svg>
          <span style={{ fontSize: '10px', color: 'rgba(139,92,246,0.55)' }}>Claude filled these</span>
        </div>
      </div>

      {/* YOU SAID */}
      <div style={{ flexShrink: 0, marginBottom: '6px' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.2)', marginBottom: '3px' }}>YOU SAID</div>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>{transcript}</p>
      </div>

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', flexShrink: 0, marginBottom: '6px' }} />

      {/* Scrollable params */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {visibleParams.map(param => renderRow(param, '72px'))}
        <button
          onClick={onToggleAdvanced}
          style={{ fontSize: '10.5px', color: 'rgba(139,92,246,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', textAlign: 'left', alignSelf: 'flex-start', fontFamily: 'inherit' }}
        >
          {showAdvanced ? '− Hide advanced parameters' : '+ Show advanced parameters'}
        </button>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '6px' }}>
        <button onClick={onReiterate} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>↺ Reiterate</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={onCopyNow} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Copy now →</button>
          <button onClick={onConfirm} style={{ padding: '5px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 600, background: 'rgba(139,92,246,0.75)', border: 'none', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
            Confirm & generate →
          </button>
        </div>
      </div>
    </div>
  )
}
