import { MODES, MODE_ALIASES } from './modes.js'

// Lets people pick a mode by saying it first: "code mode, add a retry to the upload job" or
// "email mode: tell the team the release moved to Friday". Returns the mode and the rest of
// what was said, or null when the transcript doesn't start with a mode.
const ALIASES = Object.fromEntries([
  ...MODES.map((m) => [m.label.toLowerCase(), m.key]),
  ...MODES.map((m) => [m.key.toLowerCase(), m.key]),
  // Names of retired modes still work: "chain of thought mode, …" makes a Prompt.
  ...Object.entries(MODE_ALIASES),
])

const NAMES = Object.keys(ALIASES).sort((a, b) => b.length - a.length).map((n) => n.replace(/ /g, '\\s+'))
const PATTERN = new RegExp(`^\\s*(?:use\\s+|switch\\s+to\\s+)?(${NAMES.join('|')})\\s+mode\\b[\\s,.:;!-]*`, 'i')

export function detectSpokenMode(transcript) {
  const match = (transcript || '').match(PATTERN)
  if (!match) return null
  const mode = ALIASES[match[1].toLowerCase().replace(/\s+/g, ' ')]
  const rest = transcript.slice(match[0].length).trim()
  if (!mode || !rest) return null
  return { mode, text: rest.charAt(0).toUpperCase() + rest.slice(1) }
}
