import MODE_REGISTRY from '../../../shared/modes.json'

// The mode registry, plus the retired keys (balanced, detailed, chain, refine…) that still come
// in from history entries, localStorage and spoken mode names, resolved to their replacements.
export const MODES = MODE_REGISTRY.modes
export const DEFAULT_MODE = MODE_REGISTRY.defaultMode
export const MODE_ALIASES = MODE_REGISTRY.aliases || {}
export const MODES_BY_KEY = Object.fromEntries(MODES.map((m) => [m.key, m]))

export function resolveModeKey(key) {
  return MODE_ALIASES[key] || key
}

export function modeInfo(key) {
  return MODES_BY_KEY[resolveModeKey(key)] || null
}

export function modeLabel(key) {
  return modeInfo(key)?.label || ''
}

// Results that are prompts, so "Score this prompt" means something for them.
export function isScorable(key) {
  const k = resolveModeKey(key)
  return !!modeInfo(k)?.promptStyle || k === 'image' || k === 'video'
}
