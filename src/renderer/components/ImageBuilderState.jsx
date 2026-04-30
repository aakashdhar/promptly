import { useState, useRef } from 'react'
import VariationsPanel from './VariationsPanel.jsx'

// ─── Required params — gate Confirm button ───────────────────────────────────
const REQUIRED = {
  subject:   ['subject', 'setting', 'framing'],
  lighting:  ['timeOfDay', 'lightType'],
  camera:    ['lens', 'aspectRatio'],
  style:     ['visualStyle'],
  technical: ['renderQuality'],
}

function countUnfilled(answers) {
  return Object.entries(REQUIRED).reduce((sum, [tab, fields]) => {
    return sum + fields.filter(f => {
      const v = answers[tab]?.[f]
      return !v || (typeof v === 'string' && v.trim() === '')
    }).length
  }, 0)
}

// ─── Tab param definitions ────────────────────────────────────────────────────
const SUBJECT_PARAMS = {
  subject:  ['Young woman', 'Man', 'Child', 'Couple', 'Group', 'Animal'],
  setting:  ['Ocean/beach', 'Forest', 'Urban street', 'Studio', 'Desert', 'Mountains', 'Interior'],
  emotion:  ['Serene', 'Joyful', 'Pensive', 'Mysterious', 'Confident', 'Melancholic'],
  framing:  ['Close-up', 'Mid shot', 'Full body', 'Over shoulder', 'Dutch angle'],
}
const LIGHTING_PARAMS = {
  timeOfDay: ['Golden hour', 'Blue hour', 'Midday', 'Overcast', 'Night', 'Dawn'],
  lightType: ['Directional sun', 'Rembrandt', 'Butterfly', 'Split', 'Rim light', 'Practical', 'Ambient'],
  quality:   ['Warm amber', 'Soft diffused', 'Hard shadows', 'Dappled', 'Backlit', 'Contre-jour'],
  lensFlare: ['None', 'Subtle', 'Anamorphic', 'Strong'],
}
const CAMERA_PARAMS = {
  lens:        ['24mm wide', '35mm street', '50mm standard', '85mm portrait', '135mm telephoto', 'Macro', 'Fisheye'],
  aperture:    ['f/1.4 shallow', 'f/2.8', 'f/5.6', 'f/11 deep'],
  aspectRatio: ['1:1 square', '4:5 portrait', '2:3', '9:16 vertical', '16:9 wide', '3:2'],
  angle:       ['Eye level', 'Low angle', 'High angle', "Bird's eye", "Worm's eye"],
  filmSim:     ['Kodak Portra 400', 'Fuji Velvia', 'Ilford HP5', 'CineStill 800T', 'Digital clean', 'Lomography', 'Medium format'],
}
const STYLE_PARAMS = {
  visualStyle: ['Cinematic film still', 'Editorial fashion', 'Documentary', 'Fine art', 'Commercial', 'Conceptual'],
  colorGrade:  ['Warm teal-orange', 'Desaturated', 'Hyper-saturated', 'Monochrome', 'Duotone', 'Cross-processed'],
  filmGrain:   ['35mm grain', 'Medium format', 'Heavy grain', 'Digital clean', 'Lomography'],
  reference:   ['Roger Deakins', 'Emmanuel Lubezki', 'Annie Leibovitz', 'Nan Goldin', 'Gregory Crewdson'],
}
const TECHNICAL_PARAMS = {
  resolution:    ['Ultra HD 4K', '1080p', 'Medium', 'Standard'],
  renderQuality: ['Photorealistic', 'Hyper-real', 'Stylised', 'Painterly'],
}
const TECHNICAL_NUMERIC_PARAMS = {
  stylise: [
    { label: '250 subtle', value: 250 },
    { label: '500',        value: 500 },
    { label: '750',        value: 750 },
    { label: '1000 strong',value: 1000 },
  ],
  chaos: [
    { label: '0 precise', value: 0 },
    { label: '20',         value: 20 },
    { label: '50',         value: 50 },
    { label: '100 wild',   value: 100 },
  ],
  weird: [
    { label: '0',   value: 0 },
    { label: '250', value: 250 },
    { label: '500', value: 500 },
    { label: '1000',value: 1000 },
  ],
}

// ─── Presets (48 total, 5 category rows) ──────────────────────────────────────
const PRESET_CATEGORIES = [
  {
    label: 'Photography',
    presets: [
      { name: 'Golden hour portrait', params: { lighting: { timeOfDay: 'Golden hour', lightType: 'Directional sun', quality: 'Warm amber' }, camera: { lens: '85mm portrait', aperture: 'f/1.4 shallow' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 10 } } },
      { name: 'Studio editorial',     params: { lighting: { lightType: 'Butterfly', quality: 'Soft diffused' }, camera: { lens: '50mm standard' }, style: { visualStyle: 'Editorial fashion', colorGrade: 'Desaturated' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 0 } } },
      { name: 'Street documentary',   params: { lighting: { timeOfDay: 'Midday', lightType: 'Ambient' }, camera: { lens: '35mm street', aperture: 'f/5.6' }, style: { visualStyle: 'Documentary', colorGrade: 'Desaturated', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 250, chaos: 20 } } },
      { name: 'Fashion beauty',        params: { lighting: { lightType: 'Rembrandt', quality: 'Soft diffused' }, camera: { lens: '85mm portrait', aperture: 'f/1.4 shallow', filmSim: 'Medium format' }, style: { visualStyle: 'Editorial fashion', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Hyper-real', stylise: 750, chaos: 0 } } },
      { name: 'Macro detail',          params: { camera: { lens: 'Macro', aperture: 'f/5.6', angle: 'Eye level' }, lighting: { quality: 'Soft diffused' }, style: { visualStyle: 'Fine art' }, technical: { renderQuality: 'Hyper-real', stylise: 500, chaos: 0 } } },
      { name: 'Architectural',         params: { camera: { lens: '24mm wide', aperture: 'f/11 deep', angle: 'Low angle' }, lighting: { timeOfDay: 'Blue hour', quality: 'Warm amber' }, style: { visualStyle: 'Commercial', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 0 } } },
      { name: 'Environmental portrait',params: { camera: { lens: '35mm street', aperture: 'f/2.8' }, lighting: { timeOfDay: 'Golden hour' }, style: { visualStyle: 'Documentary', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 15 } } },
      { name: 'Night portrait',        params: { lighting: { timeOfDay: 'Night', lightType: 'Practical', quality: 'Hard shadows' }, camera: { lens: '50mm standard', aperture: 'f/1.4 shallow', filmSim: 'CineStill 800T' }, style: { colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 20 } } },
      { name: 'Drone aerial',          params: { camera: { lens: '24mm wide', angle: "Bird's eye", aspectRatio: '16:9 wide' }, lighting: { timeOfDay: 'Golden hour' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 10 } } },
      { name: 'Couple romance',        params: { lighting: { timeOfDay: 'Golden hour', quality: 'Backlit', lensFlare: 'Subtle' }, camera: { lens: '85mm portrait', aperture: 'f/1.4 shallow' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 10 } } },
    ],
  },
  {
    label: 'Cinematic',
    presets: [
      { name: 'Film noir',          params: { lighting: { timeOfDay: 'Night', lightType: 'Rembrandt', quality: 'Hard shadows' }, camera: { lens: '35mm street', aperture: 'f/2.8', filmSim: 'Ilford HP5' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Monochrome', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 20 } } },
      { name: 'Wes Anderson',       params: { lighting: { timeOfDay: 'Midday', quality: 'Soft diffused' }, camera: { lens: '35mm street', angle: 'Eye level', aspectRatio: '1:1 square' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Hyper-saturated', filmGrain: '35mm grain' }, technical: { renderQuality: 'Stylised', stylise: 1000, chaos: 0 } } },
      { name: 'Sci-fi blockbuster', params: { lighting: { timeOfDay: 'Night', lightType: 'Practical', lensFlare: 'Anamorphic' }, camera: { lens: '24mm wide', aspectRatio: '16:9 wide' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 20, weird: 250 } } },
      { name: 'Indie drama',        params: { lighting: { timeOfDay: 'Overcast', lightType: 'Ambient', quality: 'Soft diffused' }, camera: { lens: '35mm street', aperture: 'f/2.8' }, style: { visualStyle: 'Documentary', colorGrade: 'Desaturated', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 20 } } },
      { name: 'Horror atmospheric', params: { lighting: { timeOfDay: 'Night', lightType: 'Practical', quality: 'Hard shadows' }, camera: { lens: '24mm wide', angle: 'Low angle' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Desaturated', filmGrain: 'Heavy grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 30 } } },
      { name: 'Documentary realism',params: { lighting: { timeOfDay: 'Midday', lightType: 'Ambient' }, camera: { lens: '35mm street', aperture: 'f/5.6' }, style: { visualStyle: 'Documentary', colorGrade: 'Desaturated', filmGrain: '35mm grain', reference: 'Nan Goldin' }, technical: { renderQuality: 'Photorealistic', stylise: 250, chaos: 30 } } },
      { name: 'Period drama',       params: { lighting: { timeOfDay: 'Golden hour', lightType: 'Directional sun', quality: 'Warm amber' }, camera: { lens: '50mm standard', filmSim: 'Kodak Portra 400' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 10 } } },
      { name: 'New Wave',           params: { lighting: { timeOfDay: 'Midday', quality: 'Hard shadows' }, camera: { lens: '35mm street', aperture: 'f/5.6', filmSim: 'Ilford HP5' }, style: { visualStyle: 'Documentary', colorGrade: 'Monochrome', filmGrain: 'Heavy grain' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 30 } } },
      { name: 'Road movie',         params: { lighting: { timeOfDay: 'Golden hour', lensFlare: 'Subtle' }, camera: { lens: '35mm street', aspectRatio: '16:9 wide' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Desaturated', filmGrain: '35mm grain', reference: 'Roger Deakins' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 20 } } },
      { name: 'Sci-fi noir',        params: { lighting: { timeOfDay: 'Night', lightType: 'Practical', quality: 'Hard shadows', lensFlare: 'Anamorphic' }, camera: { lens: '24mm wide', filmSim: 'CineStill 800T' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange', filmGrain: 'Heavy grain' }, technical: { renderQuality: 'Photorealistic', stylise: 1000, chaos: 20, weird: 250 } } },
    ],
  },
  {
    label: 'Art styles',
    presets: [
      { name: 'Oil painting',  params: { style: { visualStyle: 'Fine art', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Painterly', stylise: 1000, chaos: 20 } } },
      { name: 'Watercolour',   params: { style: { visualStyle: 'Fine art' }, technical: { renderQuality: 'Painterly', stylise: 750, chaos: 30 } } },
      { name: 'Concept art',   params: { style: { visualStyle: 'Conceptual' }, technical: { renderQuality: 'Stylised', stylise: 750, chaos: 30 } } },
      { name: 'Pixel art',     params: { style: { visualStyle: 'Conceptual' }, technical: { renderQuality: 'Stylised', stylise: 1000, chaos: 0 } } },
      { name: 'Comic book',    params: { style: { visualStyle: 'Conceptual', colorGrade: 'Hyper-saturated' }, technical: { renderQuality: 'Stylised', stylise: 1000, chaos: 20 } } },
      { name: 'Anime',         params: { style: { visualStyle: 'Conceptual', colorGrade: 'Hyper-saturated' }, technical: { renderQuality: 'Stylised', stylise: 750, chaos: 20 } } },
      { name: 'Impressionist', params: { style: { visualStyle: 'Fine art', filmGrain: 'Heavy grain' }, technical: { renderQuality: 'Painterly', stylise: 750, chaos: 50 } } },
      { name: 'Surrealism',    params: { style: { visualStyle: 'Conceptual', colorGrade: 'Cross-processed' }, technical: { renderQuality: 'Stylised', stylise: 1000, chaos: 50, weird: 500 } } },
      { name: 'Art Nouveau',   params: { style: { visualStyle: 'Fine art', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Painterly', stylise: 1000, chaos: 20 } } },
      { name: 'Retro poster',  params: { style: { visualStyle: 'Conceptual', colorGrade: 'Duotone' }, technical: { renderQuality: 'Stylised', stylise: 750, chaos: 10 } } },
      { name: 'Cyberpunk',     params: { lighting: { timeOfDay: 'Night', lightType: 'Practical' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Stylised', stylise: 1000, chaos: 30, weird: 250 } } },
      { name: 'Grunge',        params: { style: { visualStyle: 'Documentary', colorGrade: 'Desaturated', filmGrain: 'Heavy grain' }, technical: { renderQuality: 'Stylised', stylise: 500, chaos: 50 } } },
    ],
  },
  {
    label: 'Commercial',
    presets: [
      { name: 'Product shot',       params: { lighting: { lightType: 'Butterfly', quality: 'Soft diffused' }, camera: { lens: '85mm portrait', aperture: 'f/11 deep' }, style: { visualStyle: 'Commercial', colorGrade: 'Desaturated' }, technical: { renderQuality: 'Hyper-real', stylise: 500, chaos: 0 } } },
      { name: 'Food photography',   params: { lighting: { lightType: 'Directional sun', quality: 'Warm amber' }, camera: { lens: '50mm standard', angle: 'High angle' }, style: { visualStyle: 'Commercial', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Hyper-real', stylise: 500, chaos: 0 } } },
      { name: 'Real estate',        params: { lighting: { timeOfDay: 'Golden hour', lightType: 'Ambient' }, camera: { lens: '24mm wide', aperture: 'f/11 deep', angle: 'Eye level' }, style: { visualStyle: 'Commercial', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 0 } } },
      { name: 'Corporate portrait', params: { lighting: { lightType: 'Butterfly', quality: 'Soft diffused' }, camera: { lens: '85mm portrait', aperture: 'f/2.8' }, style: { visualStyle: 'Commercial', colorGrade: 'Desaturated' }, technical: { renderQuality: 'Photorealistic', stylise: 250, chaos: 0 } } },
      { name: 'Lifestyle brand',    params: { lighting: { timeOfDay: 'Golden hour', quality: 'Warm amber' }, camera: { lens: '35mm street', aperture: 'f/2.8' }, style: { visualStyle: 'Editorial fashion', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 10 } } },
      { name: 'Wedding & event',    params: { lighting: { timeOfDay: 'Golden hour', quality: 'Backlit', lensFlare: 'Subtle' }, camera: { lens: '85mm portrait', aperture: 'f/1.4 shallow', filmSim: 'Kodak Portra 400' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 10 } } },
      { name: 'Sports action',      params: { lighting: { timeOfDay: 'Midday', lightType: 'Directional sun', quality: 'Hard shadows' }, camera: { lens: '135mm telephoto', aperture: 'f/2.8' }, style: { visualStyle: 'Documentary' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 20 } } },
      { name: 'Travel & tourism',   params: { lighting: { timeOfDay: 'Golden hour' }, camera: { lens: '24mm wide', aspectRatio: '16:9 wide' }, style: { visualStyle: 'Documentary', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 20 } } },
    ],
  },
  {
    label: 'Mood & atmosphere',
    presets: [
      { name: 'Dark moody',    params: { lighting: { timeOfDay: 'Night', lightType: 'Rembrandt', quality: 'Hard shadows' }, camera: { lens: '50mm standard', aperture: 'f/2.8', filmSim: 'Ilford HP5' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Desaturated', filmGrain: 'Heavy grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 20 } } },
      { name: 'Soft dreamy',   params: { lighting: { timeOfDay: 'Golden hour', quality: 'Soft diffused' }, camera: { lens: '85mm portrait', aperture: 'f/1.4 shallow', filmSim: 'Kodak Portra 400' }, style: { visualStyle: 'Fine art', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 10 } } },
      { name: 'Gritty urban',  params: { lighting: { timeOfDay: 'Overcast', lightType: 'Ambient' }, camera: { lens: '35mm street', aperture: 'f/5.6' }, style: { visualStyle: 'Documentary', colorGrade: 'Desaturated', filmGrain: 'Heavy grain' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 30 } } },
      { name: 'Ethereal',      params: { lighting: { timeOfDay: 'Dawn', quality: 'Soft diffused', lensFlare: 'Subtle' }, camera: { lens: '85mm portrait', aperture: 'f/1.4 shallow' }, style: { visualStyle: 'Fine art', colorGrade: 'Desaturated', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 10 } } },
      { name: 'Warm cozy',     params: { lighting: { timeOfDay: 'Golden hour', lightType: 'Practical', quality: 'Warm amber' }, camera: { lens: '50mm standard', aperture: 'f/2.8', filmSim: 'Kodak Portra 400' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 10 } } },
      { name: 'High drama',    params: { lighting: { lightType: 'Rembrandt', quality: 'Hard shadows' }, camera: { lens: '50mm standard', angle: 'Low angle' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Desaturated' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 20 } } },
      { name: 'Nostalgic',     params: { lighting: { timeOfDay: 'Golden hour', quality: 'Warm amber' }, camera: { lens: '50mm standard', filmSim: 'Kodak Portra 400' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 10 } } },
      { name: 'Otherworldly',  params: { lighting: { timeOfDay: 'Night', lensFlare: 'Strong' }, camera: { lens: '24mm wide', angle: 'Low angle' }, style: { visualStyle: 'Conceptual', colorGrade: 'Cross-processed' }, technical: { renderQuality: 'Stylised', stylise: 1000, chaos: 50, weird: 500 } } },
    ],
  },
]

const FIELD_LABELS = {
  subject: 'Subject', setting: 'Setting', emotion: 'Emotion', framing: 'Framing',
  timeOfDay: 'Time of day', lightType: 'Light type', quality: 'Quality', lensFlare: 'Lens flare',
  lens: 'Lens', aperture: 'Aperture', aspectRatio: 'Aspect ratio', angle: 'Camera angle', filmSim: 'Film sim',
  visualStyle: 'Visual style', colorGrade: 'Color grade', filmGrain: 'Film grain', reference: 'Reference',
  resolution: 'Resolution', renderQuality: 'Render quality', stylise: 'Stylise', chaos: 'Chaos', weird: 'Weird', seed: 'Seed',
}

// ─── Chip ─────────────────────────────────────────────────────────────────────
function Chip({ label, isSelected, isAi, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '4px 11px', borderRadius: '7px', fontSize: '11.5px',
        cursor: 'pointer', userSelect: 'none', transition: 'background 150ms',
        border: isSelected
          ? isAi ? '0.5px solid rgba(139,92,246,0.5)' : '0.5px solid rgba(255,255,255,0.18)'
          : isAi ? '0.5px solid rgba(139,92,246,0.25)' : '0.5px solid rgba(255,255,255,0.1)',
        background: isSelected
          ? isAi ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.1)'
          : isAi ? 'rgba(139,92,246,0.07)' : 'rgba(255,255,255,0.04)',
        color: isSelected
          ? isAi ? 'rgba(196,168,255,0.95)' : 'rgba(255,255,255,0.85)'
          : isAi ? 'rgba(196,168,255,0.65)' : 'rgba(255,255,255,0.5)',
      }}
    >
      {isAi && <span style={{ color: 'rgba(139,92,246,0.7)', fontSize: '10px' }}>·</span>}
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
        minWidth: '90px', fontSize: '9.5px', textTransform: 'uppercase',
        letterSpacing: '.06em', color: 'rgba(255,255,255,0.3)', paddingTop: '6px', flexShrink: 0,
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
              padding: '4px 11px', borderRadius: '7px', fontSize: '11.5px',
              background: 'transparent', border: '0.5px dashed rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
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
              padding: '3px 10px', borderRadius: '7px', fontSize: '11.5px',
              background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.85)', outline: 'none', width: '130px',
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
        minWidth: '90px', fontSize: '9.5px', textTransform: 'uppercase',
        letterSpacing: '.06em', color: 'rgba(255,255,255,0.3)', paddingTop: '6px', flexShrink: 0,
      }}>
        Negative
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', flex: 1 }}>
        {negativePrompts.map(neg => (
          <span key={neg} style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '4px 9px', borderRadius: '7px', fontSize: '11.5px',
            background: 'rgba(255,59,48,0.08)', border: '0.5px solid rgba(255,59,48,0.2)',
            color: 'rgba(255,150,140,0.85)',
          }}>
            {neg}
            <button type="button" onClick={() => onRemoveNegative(neg)} style={{
              background: 'none', border: 'none', padding: '0 1px', cursor: 'pointer',
              color: 'rgba(255,150,140,0.6)', fontSize: '11px', lineHeight: 1,
            }}>✕</button>
          </span>
        ))}
        {!addMode && (
          <button
            type="button"
            onClick={() => { setAddMode(true); setTimeout(() => inputRef.current?.focus(), 50) }}
            style={{
              padding: '4px 11px', borderRadius: '7px', fontSize: '11.5px',
              background: 'transparent', border: '0.5px dashed rgba(255,59,48,0.2)',
              color: 'rgba(255,150,140,0.4)', cursor: 'pointer',
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
              padding: '3px 10px', borderRadius: '7px', fontSize: '11.5px',
              background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.85)', outline: 'none', width: '140px',
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
        minWidth: '90px', fontSize: '9.5px', textTransform: 'uppercase',
        letterSpacing: '.06em', color: 'rgba(255,255,255,0.3)', paddingTop: '6px', flexShrink: 0,
      }}>
        Seed
      </div>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
        {hasSeed && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '4px 9px', borderRadius: '7px', fontSize: '11.5px',
            background: 'rgba(139,92,246,0.1)', border: '0.5px solid rgba(139,92,246,0.3)',
            color: 'rgba(196,168,255,0.85)',
          }}>
            {seed}
            <button type="button" onClick={() => onSetSeed(null)} style={{
              background: 'none', border: 'none', padding: '0 1px', cursor: 'pointer',
              color: 'rgba(196,168,255,0.5)', fontSize: '11px', lineHeight: 1,
            }}>✕</button>
          </span>
        )}
        {!hasSeed && !inputMode && (
          <button
            type="button"
            onClick={() => { setInputMode(true); setTimeout(() => inputRef.current?.focus(), 50) }}
            style={{
              padding: '4px 11px', borderRadius: '7px', fontSize: '11.5px',
              background: 'transparent', border: '0.5px dashed rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
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
              padding: '3px 10px', borderRadius: '7px', fontSize: '11.5px',
              background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.85)', outline: 'none', width: '100px',
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
        minWidth: '90px', fontSize: '9.5px', textTransform: 'uppercase',
        letterSpacing: '.06em', color: 'rgba(255,255,255,0.3)', paddingTop: '6px', flexShrink: 0,
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
          padding: '14px 22px 10px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: 'rgba(139,92,246,0.8)', flexShrink: 0,
            }} />
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
              Image builder
            </span>
            <span style={{
              padding: '2px 7px', borderRadius: '5px', fontSize: '9.5px',
              background: 'rgba(139,92,246,0.12)', border: '0.5px solid rgba(139,92,246,0.25)',
              color: 'rgba(196,168,255,0.7)',
            }}>Nano Banana</span>
            {unfilled > 0 && (
              <span style={{
                padding: '2px 7px', borderRadius: '5px', fontSize: '9.5px',
                background: 'rgba(255,196,0,0.08)', border: '0.5px solid rgba(255,196,0,0.2)',
                color: 'rgba(255,210,80,0.7)',
              }}>⚠ {unfilled} unfilled</span>
            )}
            {activePreset && (
              <span style={{
                padding: '2px 7px', borderRadius: '5px', fontSize: '9.5px',
                background: 'rgba(251,146,60,0.08)', border: '0.5px solid rgba(251,146,60,0.2)',
                color: 'rgba(251,180,100,0.7)',
              }}>Preset: {activePreset}</span>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" onClick={onReiterate} style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: '11px', color: 'rgba(255,255,255,0.35)', WebkitAppRegion: 'no-drag',
            }}>↺ Reiterate</button>
          </div>
          {transcript && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
              &ldquo;{transcript.length > 120 ? transcript.slice(0, 120) + '…' : transcript}&rdquo;
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.06)',
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
                  padding: '8px 14px', fontSize: '11.5px', background: 'none', border: 'none',
                  borderBottom: isActive ? '2px solid rgba(139,92,246,0.7)' : '2px solid transparent',
                  color: isActive ? 'rgba(196,168,255,0.9)' : 'rgba(255,255,255,0.35)',
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
          padding: '10px 22px 12px', borderTop: '0.5px solid rgba(255,255,255,0.04)', flexShrink: 0,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px',
          }}>
            <span style={{
              fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.08em',
              color: 'rgba(255,255,255,0.18)',
            }}>
              Nano Banana Pro presets
            </span>
            <button type="button" onClick={() => setShowAllPresets(v => !v)} style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: '10.5px', color: 'rgba(255,255,255,0.25)', cursor: 'pointer',
              WebkitAppRegion: 'no-drag',
            }}>
              {showAllPresets ? 'Show less ↑' : 'Show all 48 →'}
            </button>
          </div>
          {(showAllPresets ? PRESET_CATEGORIES : PRESET_CATEGORIES.slice(0, 2)).map(cat => (
            <div key={cat.label} style={{ marginBottom: '7px' }}>
              <div style={{
                fontSize: '8.5px', textTransform: 'uppercase', letterSpacing: '.07em',
                color: 'rgba(255,255,255,0.2)', marginBottom: '4px',
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
                        padding: '3px 9px', borderRadius: '6px', fontSize: '10.5px',
                        cursor: 'pointer', userSelect: 'none',
                        background: isActive ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.03)',
                        border: isActive ? '0.5px solid rgba(251,146,60,0.35)' : '0.5px solid rgba(255,255,255,0.08)',
                        color: isActive ? 'rgba(251,200,130,0.9)' : 'rgba(255,255,255,0.4)',
                        WebkitAppRegion: 'no-drag',
                      }}
                    >
                      {isActive && <span style={{ color: 'rgba(251,146,60,0.7)', fontSize: '9px' }}>·</span>}
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
          padding: '12px 22px', borderTop: '0.5px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', flexShrink: 0,
        }}>
          {unfilled > 0 && (
            <span style={{ fontSize: '11px', color: 'rgba(255,200,60,0.65)', marginRight: 'auto' }}>
              ⚠ {unfilled} required field{unfilled !== 1 ? 's' : ''} unfilled
            </span>
          )}
          <button type="button" onClick={onStartOver} style={{
            padding: '8px 14px', borderRadius: '8px', fontSize: '12px',
            background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
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
              background: confirmDisabled ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.85)',
              border: '0.5px solid rgba(139,92,246,0.4)',
              color: confirmDisabled ? 'rgba(196,168,255,0.3)' : 'rgba(255,255,255,0.95)',
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
