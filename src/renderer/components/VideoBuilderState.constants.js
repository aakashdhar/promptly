// Video builder chips, shared by the review screen and the builder hook.

// Chip rows: key → { label, multi, options, badge }
// badge: 'api' | 'veo' | null
export const CHIP_ROWS = [
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
  { key: 'duration', label: 'Length', multi: false, badge: 'api', options: [
    '4 seconds', '6 seconds', '8 seconds',
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

export const ESSENTIAL_KEYS = new Set(['cameraMovement', 'aspectRatio', 'resolution', 'duration', 'audio'])
export const IMPORTANT_KEYS = new Set(['cinematicStyle', 'lighting', 'colourGrade', 'pacing'])
export const ADVANCED_CHIP_KEYS = new Set(['shotType'])


// For the first Claude call: the exact strings each field may use, so what comes back always
// matches a chip on screen.
export function chipOptionsText() {
  return CHIP_ROWS.map((r) => `- ${r.key}${r.multi ? ' (any of)' : ' (one of)'}: ${r.options.map((o) => `"${o}"`).join(', ')}`).join('\n')
}
