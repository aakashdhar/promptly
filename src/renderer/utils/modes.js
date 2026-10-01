import MODE_REGISTRY from '../../../shared/modes.json'

// The mode registry, plus the retired keys (balanced, detailed, chain, refine…) that still come
// in from history entries, localStorage and spoken mode names, resolved to their replacements.
export const MODES = MODE_REGISTRY.modes
export const DEFAULT_MODE = MODE_REGISTRY.defaultMode
export const MODE_ALIASES = MODE_REGISTRY.aliases || {}
export const MODES_BY_KEY = Object.fromEntries(MODES.map((m) => [m.key, m]))
// The AIs a finished prompt can be rewritten for; the first is how Promptly writes it.
export const PROMPT_TARGETS = MODE_REGISTRY.promptTargets || []

export function resolveModeKey(key) {
  return MODE_ALIASES[key] || key
}

export function modeInfo(key) {
  return MODES_BY_KEY[resolveModeKey(key)] || null
}

export function modeLabel(key) {
  return modeInfo(key)?.label || ''
}

// A mode's colours, from its "tone" in shared/modes.json: rgb for tags, the pill and accents;
// text for coloured words (mixed toward the ink colour per theme). Unknown modes get Prompt's.
const FALLBACK_TONE = { rgb: '10,132,255', text: '100,170,255' }
export function modeTone(key) {
  return modeInfo(key)?.tone || FALLBACK_TONE
}
export function modeTextColor(key) {
  return `color-mix(in oklab, rgb(${modeTone(key).text}) var(--accent-text-strength), rgb(var(--ink)))`
}

// Modes whose flow is a renderer builder (image, video, workflow, harness).
export function isBuilderMode(key) {
  return modeInfo(key)?.kind === 'builder'
}

// Results that are prompts, so "Score this prompt" means something for them.
export function isScorable(key) {
  const k = resolveModeKey(key)
  return !!modeInfo(k)?.promptStyle || k === 'image' || k === 'video'
}
