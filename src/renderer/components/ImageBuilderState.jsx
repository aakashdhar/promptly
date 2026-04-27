import { useState } from 'react'

const QUESTIONS = [
  // Tier 1 — Essential (6)
  { tier: 1, param: 'model', label: 'Which model are you using?', hint: 'Different models have different strengths — match to your use case', options: ['Nano Banana', 'Nano Banana 2', 'Nano Banana Pro'] },
  { tier: 1, param: 'use_case', label: 'What are you creating?', hint: 'Sets the overall approach for the prompt', options: ['Photorealistic scene', 'Stylized illustration / sticker', 'Style transfer', 'Product mockup / commercial', 'Icon / UI asset', 'Infographic / text layout', '3D render / isometric'] },
  { tier: 1, param: 'style', label: 'Style', hint: 'How the image is rendered', options: ['Photorealistic', 'Illustration', 'Oil painting', 'Film photography', '3D render', 'Cinematic', 'Watercolour', 'Anime / manga', 'Isometric', 'Claymation'] },
  { tier: 1, param: 'lighting', label: 'Lighting', hint: 'Sets the atmosphere', options: ['Golden hour', 'Studio softbox', 'Natural overcast', 'Dramatic side light', 'Neon / artificial', 'Backlit silhouette', 'Blue hour / dusk', 'Candlelight'] },
  { tier: 1, param: 'aspect_ratio', label: 'Aspect ratio', hint: 'Output dimensions', options: ['Square 1:1', 'Portrait 9:16', 'Landscape 16:9', 'Widescreen 21:9', '4:3 classic', '3:2 photo'] },
  { tier: 1, param: 'subject_detail', label: 'Subject detail', hint: 'Enrich the subject description', options: ['Add age / appearance', 'Add expression', 'Add clothing', 'Add skin / texture detail', 'Keep as spoken'] },
  // Tier 2 — Important (4)
  { tier: 2, param: 'composition', label: 'Composition', hint: 'Framing and shot type', options: ['Close-up portrait', 'Medium shot', 'Wide establishing', 'Rule of thirds', 'Symmetrical', 'Aerial / overhead', 'Macro / extreme close'] },
  { tier: 2, param: 'colour_palette', label: 'Colour palette', hint: 'Tonal mood', options: ['Warm & golden', 'Cool & blue', 'Muted & desaturated', 'Vivid & saturated', 'Monochrome', 'Pastel', 'High contrast'] },
  { tier: 2, param: 'background', label: "What's the background?", hint: 'Explicitly specifying background improves consistency', options: ['Natural / contextual', 'White background', 'Transparent / no background', 'Solid colour', 'Gradient', 'Blurred / bokeh background', 'Black background', 'Custom / describe it'], custom: 'Custom / describe it' },
  { tier: 2, param: 'mood', label: 'Mood / atmosphere', hint: 'Emotional quality', options: ['Serene', 'Dramatic', 'Nostalgic', 'Mysterious', 'Energetic', 'Melancholic', 'Futuristic', 'Dreamlike'] },
  // Tier 3 — Advanced (7)
  { tier: 3, param: 'resolution', label: 'What quality level?', hint: 'Add resolution keywords — Nano Banana responds to these in the prompt', options: ['Standard quality', 'High detail', 'Ultra detailed / 4K', 'Hyperreal / 8K', 'Professional print quality', 'Skip ↓'] },
  { tier: 3, param: 'camera_lens', label: 'Camera / lens', hint: 'Optional', options: ['35mm film', '50mm portrait', '85mm bokeh', 'Wide angle', 'Macro', 'Anamorphic', 'Fisheye', 'Skip ↓'] },
  { tier: 3, param: 'text_in_image', label: 'Text in image', hint: 'Optional', special: 'text_capability', options: ['No text needed', 'Yes — title/headline', 'Yes — label/caption', 'Yes — logo/wordmark', 'Yes — signage', 'Skip ↓'] },
  { tier: 3, param: 'detail_level', label: 'Detail specificity', hint: 'Optional', options: ['Minimal / clean', 'Moderate detail', 'Highly detailed', 'Ultra detailed / hyperreal', 'Skip ↓'] },
  { tier: 3, param: 'avoid', label: 'What to avoid', hint: 'Optional · Negative space', options: ['No text', 'No people', 'No shadows', 'No background', 'Keep minimal', 'Custom (type it)', 'Skip ↓'], custom: 'Custom (type it)' },
  { tier: 3, param: 'surface', label: 'Surface / material', hint: 'Optional', options: ['Matte', 'Glossy', 'Metallic', 'Fabric / textile', 'Natural / organic', 'Glass', 'Skip ↓'] },
  { tier: 3, param: 'post_processing', label: 'Post-processing style', hint: 'Optional', options: ['Film grain', 'Vintage / faded', 'HDR', 'Matte grade', 'Clean / neutral', 'Tilt-shift', 'Skip ↓'] },
]

export { QUESTIONS }

const TIER_BADGE_COLOR = {
  1: { bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.35)', text: 'rgba(167,139,250,0.9)', label: 'Essential' },
  2: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.35)', text: 'rgba(147,197,253,0.9)', label: 'Important' },
  3: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)', text: 'rgba(252,211,77,0.9)', label: 'Advanced' },
}

function TierBadge({ tier, questionNum, total }) {
  const c = TIER_BADGE_COLOR[tier]
  const label = tier === 3
    ? `${c.label} · optional`
    : `${c.label} · ${questionNum}/${total}`
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: '6px', padding: '2px 7px', fontSize: '10px', fontWeight: 600,
      letterSpacing: '0.02em', whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

function AnsweredChip({ param, value }) {
  const label = param.replace(/_/g, ' ')
  const displayValue = value.length > 20 ? value.slice(0, 20) + '…' : value
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)',
      borderRadius: '6px', padding: '3px 7px', fontSize: '10.5px', lineHeight: 1.3,
    }}>
      <span style={{ fontSize: '8.5px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(167,139,250,0.7)', fontWeight: 600 }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.5)' }}>{displayValue}</span>
    </span>
  )
}

function TierSummaryBox({ tierLabel, color, params, answers }) {
  const c = color
  return (
    <div style={{
      background: `rgba(${c},0.04)`, border: `1px solid rgba(${c},0.1)`,
      borderRadius: '9px', padding: '7px 10px',
    }}>
      <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: `rgba(${c},0.6)`, fontWeight: 700, marginBottom: '6px' }}>{tierLabel} ✓</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {params.filter((p) => answers[p]).map((p) => (
          <AnsweredChip key={p} param={p} value={answers[p]} />
        ))}
      </div>
    </div>
  )
}

export default function ImageBuilderState({
  transcript,
  questionIndex,
  answers,
  onSelect,
  onNext,
  onBack,
  onSkip,
  onCopyNow,
  isExpanded,
}) {
  const [hovered, setHovered] = useState(null)
  const [customText, setCustomText] = useState('')

  const q = QUESTIONS[questionIndex]
  const tier = q.tier

  // Counts within tier
  const tierQuestions = QUESTIONS.filter((x) => x.tier === tier)
  const tierIndex = tierQuestions.findIndex((x) => x.param === q.param)
  const tierNum = tierIndex + 1

  const isFirst = questionIndex === 0
  const isSkip = (opt) => opt === 'Skip ↓'
  const selectedValue = answers[q.param]
  const isCustomSelected = q.custom && selectedValue === q.custom
  const canAdvance = tier === 3 || selectedValue != null

  // Answered params (excluding current question)
  const answeredEntries = Object.entries(answers).filter(([k]) => k !== q.param)

  // Tier param lists
  const tier1Params = QUESTIONS.filter((x) => x.tier === 1).map((x) => x.param)
  const tier2Params = QUESTIONS.filter((x) => x.tier === 2).map((x) => x.param)

  const tier1Answers = tier1Params.map((p) => answers[p]).filter(Boolean)
  const tier2Answers = tier2Params.map((p) => answers[p]).filter(Boolean)

  const showTier1Summary = tier >= 2 && tier1Answers.length > 0
  const showTier2Summary = tier >= 3 && tier2Answers.length > 0

  // Progress (for expanded view)
  const completedQuestions = questionIndex
  const totalQuestions = 17
  const progressPct = Math.round((completedQuestions / totalQuestions) * 100)

  // When the question changes, reset custom text
  // (handled by parent's onSelect call which resets it)
  function handleChipClick(opt) {
    if (isSkip(opt)) {
      onSkip()
      return
    }
    onSelect(q.param, opt)
    setCustomText('')
  }

  function handleNextWithCustom() {
    if (isCustomSelected && customText.trim()) {
      // Pass resolved value directly so hook can use it atomically
      onNext(customText.trim())
    } else if (isCustomSelected && !customText.trim()) {
      // Empty custom = skip
      onSkip()
    } else {
      onNext()
    }
  }

  if (isExpanded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 28px 20px 28px', gap: '12px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <rect x="1" y="3" width="14" height="10" rx="2" stroke="rgba(167,139,250,0.7)" strokeWidth="1.3" fill="none"/>
              <circle cx="5.5" cy="6.5" r="1.5" fill="rgba(167,139,250,0.7)"/>
              <path d="M1 11l4-3 3 2.5 3-3.5 4 4" stroke="rgba(167,139,250,0.7)" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
            </svg>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(167,139,250,0.85)', letterSpacing: '0.04em' }}>Nano Banana builder</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TierBadge tier={tier} questionNum={tierNum} total={tierQuestions.length} />
            <button
              onClick={onCopyNow}
              style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '5px' }}
            >Copy now →</button>
          </div>
        </div>

        {/* You said + answered chips */}
        <div style={{ flexShrink: 0 }}>
          <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', margin: '0 0 8px 0', lineHeight: 1.5 }}>
            {transcript}
          </p>
          {answeredEntries.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {answeredEntries.map(([param, value]) => (
                <AnsweredChip key={param} param={param} value={value} />
              ))}
            </div>
          )}
        </div>

        {/* Question area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '16px 0 0 0' }}>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontSize: '16px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{q.label}</span>
            {q.special === 'text_capability' && (
              <span style={{ marginLeft: '8px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: 'rgba(167,139,250,0.8)', fontSize: '9px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Unique capability</span>
            )}
          </div>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', margin: '0 0 14px 0' }}>{q.hint}</p>

          {/* 4-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', flexShrink: 0 }}>
            {q.options.map((opt) => {
              const isSelected = selectedValue === opt || (isCustomSelected && opt === q.custom)
              const skip = isSkip(opt)
              return (
                <button
                  key={opt}
                  onClick={() => handleChipClick(opt)}
                  style={{
                    padding: '9px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: isSelected ? 500 : 400,
                    textAlign: 'center', cursor: 'pointer', lineHeight: 1.3,
                    background: isSelected ? 'rgba(139,92,246,0.14)' : (skip ? 'transparent' : 'rgba(255,255,255,0.04)'),
                    border: isSelected ? '1px solid rgba(139,92,246,0.38)' : (skip ? '1px dashed rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.1)'),
                    color: isSelected ? 'rgba(167,139,250,0.95)' : (skip ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.55)'),
                  }}
                >
                  {opt}
                </button>
              )
            })}
          </div>

          {/* Custom text input */}
          {isCustomSelected && (
            <input
              autoFocus
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNextWithCustom() }}
              placeholder="Describe it…"
              style={{
                marginTop: '8px', width: '100%', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px',
                padding: '8px 12px', fontSize: '12px', color: 'rgba(255,255,255,0.75)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          )}

          {/* Progress bar at bottom */}
          <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', margin: '0 0 6px 0' }}>
              {completedQuestions} of {totalQuestions} · {progressPct}% complete
            </p>
            <div style={{ width: '100%', height: '2px', borderRadius: '1px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: 'rgba(139,92,246,0.6)', borderRadius: '1px' }} />
            </div>
          </div>
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, paddingTop: '4px' }}>
          {!isFirst ? (
            <button
              onClick={onBack}
              style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: '0', flexShrink: 0 }}
            >← Back</button>
          ) : <div style={{ flex: 1 }} />}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.18)' }}>or press ↵</span>
          <button
            onClick={() => canAdvance ? handleNextWithCustom() : null}
            style={{
              padding: '7px 18px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 500,
              background: canAdvance ? 'rgba(139,92,246,0.75)' : 'rgba(139,92,246,0.2)',
              border: 'none', color: 'white', cursor: canAdvance ? 'pointer' : 'default',
              opacity: canAdvance ? 1 : 0.4, transition: 'opacity 120ms ease',
            }}
          >Next</button>
        </div>
      </div>
    )
  }

  // Compact bar layout
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '10px 14px 10px 14px', gap: '8px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <rect x="1" y="3" width="14" height="10" rx="2" stroke="rgba(167,139,250,0.7)" strokeWidth="1.3" fill="none"/>
            <circle cx="5.5" cy="6.5" r="1.5" fill="rgba(167,139,250,0.7)"/>
            <path d="M1 11l4-3 3 2.5 3-3.5 4 4" stroke="rgba(167,139,250,0.7)" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
          </svg>
          <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'rgba(167,139,250,0.8)', letterSpacing: '0.04em' }}>Nano Banana builder</span>
        </div>
        <TierBadge tier={tier} questionNum={tierNum} total={tierQuestions.length} />
      </div>

      {/* Transcript */}
      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>
        {transcript}
      </p>

      {/* Tier 1 summary (when in tier 2+) */}
      {showTier1Summary && (
        <TierSummaryBox tierLabel="Essential" color="139,92,246" params={tier1Params} answers={answers} />
      )}

      {/* Tier 2 summary (when in tier 3) */}
      {showTier2Summary && (
        <TierSummaryBox tierLabel="Important" color="59,130,246" params={tier2Params} answers={answers} />
      )}

      {/* Answered chips — tier 3 only (tiers 1+2 captured in summary boxes) */}
      {tier >= 3 && answeredEntries.filter(([k]) => !tier1Params.includes(k) && !tier2Params.includes(k)).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {answeredEntries.filter(([k]) => !tier1Params.includes(k) && !tier2Params.includes(k)).map(([param, value]) => (
            <AnsweredChip key={param} param={param} value={value} />
          ))}
        </div>
      )}

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 -2px' }} />

      {/* Question */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.82)' }}>{q.label}</span>
          {q.special === 'text_capability' && (
            <span style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: 'rgba(167,139,250,0.8)', fontSize: '8px', fontWeight: 600, padding: '1px 5px', borderRadius: '4px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Unique capability</span>
          )}
        </div>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', margin: 0 }}>{q.hint}</p>
      </div>

      {/* Chip options */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        {q.options.map((opt) => {
          const isSelected = selectedValue === opt || (isCustomSelected && opt === q.custom)
          const skip = isSkip(opt)
          return (
            <button
              key={opt}
              onClick={() => handleChipClick(opt)}
              onMouseEnter={() => setHovered(opt)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: '5px 11px', borderRadius: '9px', fontSize: '11.5px', fontWeight: isSelected ? 500 : 400,
                cursor: 'pointer', lineHeight: 1,
                background: isSelected ? 'rgba(139,92,246,0.14)' : (hovered === opt && !skip ? 'rgba(255,255,255,0.07)' : (skip ? 'transparent' : 'rgba(255,255,255,0.04)')),
                border: isSelected ? '1px solid rgba(139,92,246,0.38)' : (skip ? '1px dashed rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.1)'),
                color: isSelected ? 'rgba(167,139,250,0.95)' : (skip ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.55)'),
                transition: 'background 100ms ease, border-color 100ms ease',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>

      {/* Custom text input */}
      {isCustomSelected && (
        <input
          autoFocus
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleNextWithCustom() }}
          placeholder="Describe it…"
          style={{
            width: '100%', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px',
            padding: '6px 10px', fontSize: '11.5px', color: 'rgba(255,255,255,0.75)',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          {!isFirst && (
            <button onClick={onBack} style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>← Back</button>
          )}
          <button onClick={onCopyNow} style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Copy now →</button>
        </div>
        <button
          onClick={() => canAdvance ? handleNextWithCustom() : null}
          style={{
            padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
            background: canAdvance ? 'rgba(139,92,246,0.75)' : 'rgba(139,92,246,0.2)',
            border: 'none', color: 'white', cursor: canAdvance ? 'pointer' : 'default',
            opacity: canAdvance ? 1 : 0.4, transition: 'opacity 120ms ease',
          }}
        >Next</button>
      </div>
    </div>
  )
}
