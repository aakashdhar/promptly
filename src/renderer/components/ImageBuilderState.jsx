import { useState, useRef } from 'react'
import { readableColor } from '../utils/promptUtils.js'
import VariationsPanel from './VariationsPanel.jsx'
import { REQUIRED, FIELD_LABELS, SUBJECT_PARAMS, LIGHTING_PARAMS, CAMERA_PARAMS, STYLE_PARAMS, TECHNICAL_PARAMS, TECHNICAL_NUMERIC_PARAMS, PRESET_CATEGORIES } from './ImageBuilderState.constants.js'

function countUnfilled(answers) {
  return Object.entries(REQUIRED).reduce((sum, [tab, fields]) => {
    return sum + fields.filter(f => {
      const v = answers[tab]?.[f]
      return !v || (typeof v === 'string' && v.trim() === '')
    }).length
  }, 0)
}

// ─── Chip ─────────────────────────────────────────────────────────────────────
function Chip({ label, isSelected, isAi, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '4px 11px', borderRadius: '7px', fontSize: '12px',
        cursor: 'pointer', userSelect: 'none', transition: 'background 150ms',
        border: isSelected
          ? isAi ? '0.5px solid rgba(139,92,246,0.5)' : '0.5px solid rgba(var(--ink),0.18)'
          : isAi ? '0.5px solid rgba(139,92,246,0.25)' : '0.5px solid rgba(var(--ink),0.1)',
        background: isSelected
          ? isAi ? 'rgba(139,92,246,0.18)' : 'rgba(var(--ink),0.1)'
          : isAi ? 'rgba(139,92,246,0.07)' : 'rgba(var(--ink),0.04)',
        color: readableColor(isSelected
          ? isAi ? 'rgba(196,168,255,0.95)' : 'rgba(var(--ink),0.85)'
          : isAi ? 'rgba(196,168,255,0.65)' : 'var(--text-secondary)'),
      }}
    >
      {isAi && <span style={{ color: 'color-mix(in oklab, rgb(139,92,246) var(--accent-text-strength), rgb(var(--ink)))', fontSize: '11px' }}>·</span>}
      {label}
    </button>
  )
}

// ─── ParamRow ─────────────────────────────────────────────────────────────────
function ParamRow({ tab, field, options, answers, defaults, onParamChange, onRemoveDefault, allowCustom }) {
  const [addMode, setAddMode] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef(null)

  const currentVal = answers[tab]?.[field] ?? ''
  const aiDefault = defaults[tab]?.[field] ?? ''

  function handleChipClick(value) {
    if (currentVal === value) {
      if (aiDefault === value) onRemoveDefault(`${tab}.${field}`, value)
      onParamChange(tab, field, '')
    } else {
      onParamChange(tab, field, value)
    }
  }

  function handleCustomSubmit() {
    const v = inputVal.trim()
    if (v) onParamChange(tab, field, v)
    setInputVal('')
    setAddMode(false)
  }

  const displayOptions = currentVal && !options.includes(currentVal)
    ? [...options, currentVal]
    : options

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
      <div style={{
        minWidth: '90px', fontSize: '11px', textTransform: 'uppercase',
        letterSpacing: '.06em', color: 'var(--text-tertiary)', paddingTop: '6px', flexShrink: 0,
      }}>
        {FIELD_LABELS[field] || field}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', flex: 1 }}>
        {displayOptions.map(opt => (
          <Chip
            key={opt}
            label={opt}
            isSelected={currentVal === opt}
            isAi={aiDefault === opt}
            onClick={() => handleChipClick(opt)}
          />
        ))}
        {allowCustom && !addMode && (
          <button
            type="button"
            onClick={() => { setAddMode(true); setTimeout(() => inputRef.current?.focus(), 50) }}
            style={{
              padding: '4px 11px', borderRadius: '7px', fontSize: '12px',
              background: 'transparent', border: '0.5px dashed rgba(var(--ink),0.15)',
              color: 'var(--text-tertiary)', cursor: 'pointer',
            }}
          >
            + add
          </button>
        )}
        {addMode && (
          <input
            ref={inputRef}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCustomSubmit()
              if (e.key === 'Escape') { setAddMode(false); setInputVal('') }
            }}
            onBlur={handleCustomSubmit}
            placeholder="Type & enter…"
            style={{
              padding: '3px 10px', borderRadius: '7px', fontSize: '12px',
              background: 'rgba(var(--ink),0.06)', border: '0.5px solid rgba(var(--ink),0.2)',
              color: 'rgba(var(--ink),0.95)', outline: 'none', width: '130px',
              WebkitAppRegion: 'no-drag',
            }}
          />
        )}
      </div>
    </div>
  )
}

// ─── NegativeRow ──────────────────────────────────────────────────────────────
function NegativeRow({ negativePrompts, onSetNegative, onRemoveNegative }) {
  const [addMode, setAddMode] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef(null)

  function handleAdd() {
    const v = inputVal.trim()
    if (v) { onSetNegative(v); setInputVal('') }
    setAddMode(false)
  }

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
      <div style={{
        minWidth: '90px', fontSize: '11px', textTransform: 'uppercase',
        letterSpacing: '.06em', color: 'var(--text-tertiary)', paddingTop: '6px', flexShrink: 0,
      }}>
        Negative
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', flex: 1 }}>
        {negativePrompts.map(neg => (
          <span key={neg} style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '4px 9px', borderRadius: '7px', fontSize: '12px',
            background: 'rgba(255,59,48,0.08)', border: '0.5px solid rgba(255,59,48,0.2)',
            color: 'color-mix(in oklab, rgb(255,150,140) var(--accent-text-strength), rgb(var(--ink)))',
          }}>
            {neg}
            <button type="button" onClick={() => onRemoveNegative(neg)} style={{
              background: 'none', border: 'none', padding: '0 1px', cursor: 'pointer',
              color: 'color-mix(in oklab, rgb(255,150,140) var(--accent-text-strength), rgb(var(--ink)))', fontSize: '11px', lineHeight: 1,
            }}>✕</button>
          </span>
        ))}
        {!addMode && (
          <button
            type="button"
            onClick={() => { setAddMode(true); setTimeout(() => inputRef.current?.focus(), 50) }}
            style={{
              padding: '4px 11px', borderRadius: '7px', fontSize: '12px',
              background: 'transparent', border: '0.5px dashed rgba(255,59,48,0.2)',
              color: 'color-mix(in oklab, rgb(255,150,140) var(--accent-text-strength), rgb(var(--ink)))', cursor: 'pointer',
            }}
          >
            + add exclusions
          </button>
        )}
        {addMode && (
          <input
            ref={inputRef}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd()
              if (e.key === 'Escape') { setAddMode(false); setInputVal('') }
            }}
            onBlur={handleAdd}
            placeholder="e.g. blur, grain…"
            style={{
              padding: '3px 10px', borderRadius: '7px', fontSize: '12px',
              background: 'rgba(var(--ink),0.06)', border: '0.5px solid rgba(var(--ink),0.2)',
              color: 'rgba(var(--ink),0.95)', outline: 'none', width: '140px',
              WebkitAppRegion: 'no-drag',
            }}
          />
        )}
      </div>
    </div>
  )
}

// ─── SeedRow ──────────────────────────────────────────────────────────────────
function SeedRow({ seed, onSetSeed }) {
  const [inputMode, setInputMode] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef(null)

  function handleConfirm() {
    onSetSeed(inputVal)
    setInputMode(false)
    setInputVal('')
  }

  const hasSeed = seed !== null && seed !== undefined && seed !== ''

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
      <div style={{
        minWidth: '90px', fontSize: '11px', textTransform: 'uppercase',
        letterSpacing: '.06em', color: 'var(--text-tertiary)', paddingTop: '6px', flexShrink: 0,
      }}>
        Seed
      </div>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
        {hasSeed && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '4px 9px', borderRadius: '7px', fontSize: '12px',
            background: 'rgba(139,92,246,0.1)', border: '0.5px solid rgba(139,92,246,0.3)',
            color: 'color-mix(in oklab, rgb(196,168,255) var(--accent-text-strength), rgb(var(--ink)))',
          }}>
            {seed}
            <button type="button" onClick={() => onSetSeed(null)} style={{
              background: 'none', border: 'none', padding: '0 1px', cursor: 'pointer',
              color: 'color-mix(in oklab, rgb(196,168,255) var(--accent-text-strength), rgb(var(--ink)))', fontSize: '11px', lineHeight: 1,
            }}>✕</button>
          </span>
        )}
        {!hasSeed && !inputMode && (
          <button
            type="button"
            onClick={() => { setInputMode(true); setTimeout(() => inputRef.current?.focus(), 50) }}
            style={{
              padding: '4px 11px', borderRadius: '7px', fontSize: '12px',
              background: 'transparent', border: '0.5px dashed rgba(var(--ink),0.15)',
              color: 'var(--text-tertiary)', cursor: 'pointer',
            }}
          >
            + set seed
          </button>
        )}
        {inputMode && (
          <input
            ref={inputRef}
            type="number"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleConfirm()
              if (e.key === 'Escape') { setInputMode(false); setInputVal('') }
            }}
            onBlur={handleConfirm}
            placeholder="e.g. 12345"
            style={{
              padding: '3px 10px', borderRadius: '7px', fontSize: '12px',
              background: 'rgba(var(--ink),0.06)', border: '0.5px solid rgba(var(--ink),0.2)',
              color: 'rgba(var(--ink),0.95)', outline: 'none', width: '100px',
              WebkitAppRegion: 'no-drag',
            }}
          />
        )}
      </div>
    </div>
  )
}

// ─── NumericParamRow — for stylise/chaos/weird (value=number, label=string) ──
function NumericParamRow({ tab, field, options, answers, defaults, onParamChange, onRemoveDefault }) {
  const currentVal = answers[tab]?.[field]
  const aiDefault  = defaults[tab]?.[field]

  function handleChipClick(opt) {
    if (currentVal === opt.value) {
      if (Number(aiDefault) === opt.value) onRemoveDefault(`${tab}.${field}`, opt.value)
      onParamChange(tab, field, '')
    } else {
      onParamChange(tab, field, opt.value)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
      <div style={{
        minWidth: '90px', fontSize: '11px', textTransform: 'uppercase',
        letterSpacing: '.06em', color: 'var(--text-tertiary)', paddingTop: '6px', flexShrink: 0,
      }}>
        {FIELD_LABELS[field] || field}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', flex: 1 }}>
        {options.map(opt => {
          const isSelected = currentVal === opt.value
          const isAi = Number(aiDefault) === opt.value && aiDefault !== '' && aiDefault !== undefined
          return (
            <Chip
              key={opt.value}
              label={opt.label}
              isSelected={isSelected}
              isAi={isAi}
              onClick={() => handleChipClick(opt)}
            />
          )
        })}
      </div>
    </div>
  )
}


// ─── Main component ───────────────────────────────────────────────────────────
export default function ImageBuilderState({
  transcript,
  imageDefaults,
  imageAnswers,
  activePreset,
  imageVariations,
  selectedVariation,
  isGeneratingVariations,
  onParamChange,
  onRemoveDefault,
  onApplyPreset,
  onSelectVariation,
  onGenerateMore,
  onSetSeed,
  onSetNegative,
  onRemoveNegative,
  onConfirm,
  onReiterate,
  onStartOver,
}) {
  const [activeTab, setActiveTab] = useState('subject')
  const [showAllPresets, setShowAllPresets] = useState(false)

  if (!imageAnswers) return null

  const unfilled = countUnfilled(imageAnswers)
  const isGeneratingVars = Boolean(isGeneratingVariations)
  const confirmDisabled = unfilled > 0 || isGeneratingVars

  const TABS = ['subject', 'lighting', 'camera', 'style', 'technical']
  const TAB_LABELS = { subject: 'Subject', lighting: 'Lighting', camera: 'Camera', style: 'Style', technical: 'Technical' }
  const def = imageDefaults || {}
  const ans = imageAnswers

  function renderTabContent() {
    if (activeTab === 'subject') {
      return (
        <>
          {Object.entries(SUBJECT_PARAMS).map(([field, opts]) => (
            <ParamRow key={field} tab="subject" field={field} options={opts} answers={ans} defaults={def}
              onParamChange={onParamChange} onRemoveDefault={onRemoveDefault}
              allowCustom={field === 'subject' || field === 'setting'}
            />
          ))}
          <NegativeRow
            negativePrompts={ans.subject?.negativePrompts || []}
            onSetNegative={onSetNegative}
            onRemoveNegative={onRemoveNegative}
          />
        </>
      )
    }
    if (activeTab === 'lighting') {
      return Object.entries(LIGHTING_PARAMS).map(([field, opts]) => (
        <ParamRow key={field} tab="lighting" field={field} options={opts} answers={ans} defaults={def}
          onParamChange={onParamChange} onRemoveDefault={onRemoveDefault} />
      ))
    }
    if (activeTab === 'camera') {
      return Object.entries(CAMERA_PARAMS).map(([field, opts]) => (
        <ParamRow key={field} tab="camera" field={field} options={opts} answers={ans} defaults={def}
          onParamChange={onParamChange} onRemoveDefault={onRemoveDefault} />
      ))
    }
    if (activeTab === 'style') {
      return Object.entries(STYLE_PARAMS).map(([field, opts]) => (
        <ParamRow key={field} tab="style" field={field} options={opts} answers={ans} defaults={def}
          onParamChange={onParamChange} onRemoveDefault={onRemoveDefault}
          allowCustom={field === 'reference'}
        />
      ))
    }
    if (activeTab === 'technical') {
      return (
        <>
          {Object.entries(TECHNICAL_PARAMS).map(([field, opts]) => (
            <ParamRow key={field} tab="technical" field={field} options={opts} answers={ans} defaults={def}
              onParamChange={onParamChange} onRemoveDefault={onRemoveDefault} />
          ))}
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '10px 0 2px' }}>For Midjourney only. Nano Banana and ChatGPT ignore these.</div>
          {Object.entries(TECHNICAL_NUMERIC_PARAMS).map(([field, opts]) => (
            <NumericParamRow key={field} tab="technical" field={field} options={opts} answers={ans} defaults={def}
              onParamChange={onParamChange} onRemoveDefault={onRemoveDefault} />
          ))}
          <SeedRow seed={ans.technical?.seed ?? null} onSetSeed={onSetSeed} />
        </>
      )
    }
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden' }}>

      {/* Zone A — tabs + params + presets + action */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div style={{
          padding: '14px 22px 10px', borderBottom: '0.5px solid rgba(var(--ink),0.06)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: 'rgba(139,92,246,0.8)', flexShrink: 0,
            }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(var(--ink),0.95)' }}>
              Image builder
            </span>
            <span style={{
              padding: '2px 7px', borderRadius: '5px', fontSize: '11px',
              background: 'rgba(139,92,246,0.12)', border: '0.5px solid rgba(139,92,246,0.25)',
              color: 'color-mix(in oklab, rgb(196,168,255) var(--accent-text-strength), rgb(var(--ink)))',
            }}>Nano Banana · ChatGPT</span>
            {unfilled > 0 && (
              <span style={{
                padding: '2px 7px', borderRadius: '5px', fontSize: '11px',
                background: 'rgba(255,196,0,0.08)', border: '0.5px solid rgba(255,196,0,0.2)',
                color: 'color-mix(in oklab, rgb(255,210,80) var(--accent-text-strength), rgb(var(--ink)))',
              }}>⚠ {unfilled} unfilled</span>
            )}
            {activePreset && (
              <span style={{
                padding: '2px 7px', borderRadius: '5px', fontSize: '11px',
                background: 'rgba(251,146,60,0.08)', border: '0.5px solid rgba(251,146,60,0.2)',
                color: 'color-mix(in oklab, rgb(251,180,100) var(--accent-text-strength), rgb(var(--ink)))',
              }}>Preset: {activePreset}</span>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" onClick={onReiterate} style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: '11px', color: 'var(--text-secondary)', WebkitAppRegion: 'no-drag',
            }}>↺ Reiterate</button>
          </div>
          {transcript && (
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              &ldquo;{transcript.length > 120 ? transcript.slice(0, 120) + '…' : transcript}&rdquo;
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', borderBottom: '0.5px solid rgba(var(--ink),0.06)',
          padding: '0 22px', gap: '2px', flexShrink: 0,
        }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 14px', fontSize: '12px', background: 'none', border: 'none',
                  borderBottom: isActive ? '2px solid rgba(139,92,246,0.7)' : '2px solid transparent',
                  color: isActive ? 'color-mix(in oklab, rgb(196,168,255) var(--accent-text-strength), rgb(var(--ink)))' : 'var(--text-tertiary)',
                  fontWeight: isActive ? 500 : 400, cursor: 'pointer',
                  transition: 'color 150ms, border-color 150ms', WebkitAppRegion: 'no-drag',
                }}
              >
                {TAB_LABELS[tab]}
              </button>
            )
          })}
        </div>

        {/* Params scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px 0' }}>
          {renderTabContent()}
        </div>

        {/* Presets strip */}
        <div style={{
          padding: '10px 22px 12px', borderTop: '0.5px solid rgba(var(--ink),0.04)', flexShrink: 0,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px',
          }}>
            <span style={{
              fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.08em',
              color: 'var(--text-tertiary)',
            }}>
              Presets
            </span>
            <button type="button" onClick={() => setShowAllPresets(v => !v)} style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: '11px', color: 'var(--text-tertiary)', cursor: 'pointer',
              WebkitAppRegion: 'no-drag',
            }}>
              {showAllPresets ? 'Show less ↑' : 'Show all 48 →'}
            </button>
          </div>
          {(showAllPresets ? PRESET_CATEGORIES : PRESET_CATEGORIES.slice(0, 2)).map(cat => (
            <div key={cat.label} style={{ marginBottom: '7px' }}>
              <div style={{
                fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.07em',
                color: 'var(--text-tertiary)', marginBottom: '4px',
              }}>
                {cat.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {cat.presets.map(preset => {
                  const isActive = activePreset === preset.name
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => onApplyPreset(preset.name, preset.params)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 9px', borderRadius: '6px', fontSize: '11px',
                        cursor: 'pointer', userSelect: 'none',
                        background: isActive ? 'rgba(251,146,60,0.12)' : 'rgba(var(--ink),0.03)',
                        border: isActive ? '0.5px solid rgba(251,146,60,0.35)' : '0.5px solid rgba(var(--ink),0.08)',
                        color: isActive ? 'color-mix(in oklab, rgb(251,200,130) var(--accent-text-strength), rgb(var(--ink)))' : 'var(--text-tertiary)',
                        WebkitAppRegion: 'no-drag',
                      }}
                    >
                      {isActive && <span style={{ color: 'color-mix(in oklab, rgb(251,146,60) var(--accent-text-strength), rgb(var(--ink)))', fontSize: '11px' }}>·</span>}
                      {preset.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Action row */}
        <div style={{
          padding: '12px 22px', borderTop: '0.5px solid rgba(var(--ink),0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', flexShrink: 0,
        }}>
          {unfilled > 0 && (
            <span style={{ fontSize: '11px', color: 'color-mix(in oklab, rgb(255,200,60) var(--accent-text-strength), rgb(var(--ink)))', marginRight: 'auto' }}>
              ⚠ {unfilled} required field{unfilled !== 1 ? 's' : ''} unfilled
            </span>
          )}
          <button type="button" onClick={onStartOver} style={{
            padding: '8px 14px', borderRadius: '8px', fontSize: '12px',
            background: 'rgba(var(--ink),0.04)', border: '0.5px solid rgba(var(--ink),0.1)',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}>
            Start over
          </button>
          <button
            type="button"
            onClick={confirmDisabled ? undefined : onConfirm}
            disabled={confirmDisabled}
            title={isGeneratingVars ? 'Generating variations…' : undefined}
            style={{
              padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
              background: confirmDisabled ? 'rgba(139,92,246,0.06)' : '#7440E0',
              border: '0.5px solid rgba(139,92,246,0.4)',
              color: confirmDisabled ? 'color-mix(in oklab, rgb(196,168,255) var(--accent-text-strength), rgb(var(--ink)))' : '#FFFFFF',
              cursor: confirmDisabled ? 'default' : 'pointer',
              opacity: confirmDisabled ? 0.5 : 1, pointerEvents: confirmDisabled ? 'none' : 'auto',
            }}
          >
            Confirm & assemble prompt →
          </button>
        </div>
      </div>

      {/* Zone B — variations */}
      <VariationsPanel
        variations={imageVariations || []}
        selectedVariation={selectedVariation}
        isLoading={isGeneratingVars}
        onSelectVariation={onSelectVariation}
        onGenerateMore={onGenerateMore}
      />
    </div>
  )
}
