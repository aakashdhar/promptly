import { resolveModeKey, modeTone, modeTextColor } from './modes.js'

export function parseSections(text) {
  if (!text) return []
  const lines = text.split('\n')
  const sections = []
  let current = null
  let bodyLines = []

  function flush() {
    if (current !== null) {
      sections.push({ label: current, body: bodyLines.join('\n').trim() })
      bodyLines = []
      current = null
    }
  }

  for (const line of lines) {
    const m = line.trim().match(/^([A-Za-z][A-Za-z\s/]*):\s*$/)
    if (m) {
      flush()
      current = m[1].trim()
    } else {
      bodyLines.push(line)
    }
  }
  flush()

  if (sections.length === 0 && text.trim()) {
    sections.push({ label: null, body: text.trim() })
  }
  return sections
}

// Each balanced {...} in the text, in order, skipping braces inside strings.
function* jsonObjectCandidates(text) {
  for (let start = text.indexOf('{'); start >= 0; start = text.indexOf('{', start + 1)) {
    let depth = 0
    let inString = false
    for (let i = start; i < text.length; i++) {
      const ch = text[i]
      if (inString) {
        if (ch === '\\') i++
        else if (ch === '"') inString = false
      } else if (ch === '"') inString = true
      else if (ch === '{') depth++
      else if (ch === '}' && --depth === 0) { yield text.slice(start, i + 1); break }
    }
  }
}

// Claude often wraps JSON in ```json fences, sometimes with a line before or after it (which
// may itself contain a brace). Strip fences, then take the first balanced {...} that parses.
// Throws if no JSON object can be parsed.
export function parseJsonObject(raw) {
  const stripped = (raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  let parsed
  try {
    parsed = JSON.parse(stripped)
  } catch {
    for (const candidate of jsonObjectCandidates(stripped)) {
      try { parsed = JSON.parse(candidate); break } catch { /* try the next one */ }
    }
    if (parsed === undefined) throw new Error('No parseable JSON object in response')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Response is not a JSON object')
  return parsed
}

const isText = (v) => typeof v === 'string' && v.trim().length > 0

// Returns { subject, body, toneAnalysis } or throws if the email is unusable.
export function parseEmailOutput(raw) {
  const parsed = parseJsonObject(raw)
  if (!isText(parsed.subject) || !isText(parsed.body)) throw new Error('Email response is missing a subject or body')
  const tone = parsed.toneAnalysis && typeof parsed.toneAnalysis === 'object' ? parsed.toneAnalysis : {}
  const toneAnalysis = {}
  for (const key of ['recipient', 'tone', 'coreMessage', 'approach', 'whyThisTone']) {
    if (typeof tone[key] === 'string') toneAnalysis[key] = tone[key]
  }
  return { subject: parsed.subject, body: parsed.body, toneAnalysis }
}

// Returns a workflow analysis whose nodes are safe to render, or null if unusable.
export function parseWorkflowAnalysis(raw) {
  let parsed
  try { parsed = parseJsonObject(raw) } catch { return null }
  if (!Array.isArray(parsed.nodes)) return null
  const nodes = parsed.nodes
    .filter((n) => n && typeof n === 'object' && (typeof n.id === 'number' || isText(n.id)) && isText(n.name))
    .map((n) => {
      const placeholders = Array.isArray(n.placeholders) ? n.placeholders.filter((p) => typeof p === 'string') : []
      // A placeholder with no parameter row would count as "to fill" with nowhere to fill it.
      const parameters = { ...(n.parameters && typeof n.parameters === 'object' ? n.parameters : {}) }
      for (const p of placeholders) if (!(p in parameters)) parameters[p] = p.toUpperCase()
      // These are rendered as text; anything else Claude puts there would crash the screen.
      const node = { ...n, parameters, placeholders }
      for (const key of ['type', 'purpose']) if (key in node && typeof node[key] !== 'string') delete node[key]
      if ('credentialType' in node && typeof node.credentialType !== 'string') node.credentialType = null
      return node
    })
  if (nodes.length === 0) return null
  // Ids key the rows, the filled-in values and deletes, and new nodes take max id + 1; text or
  // repeated ids would break all of that, so anything but unique numbers becomes 1..n.
  const ids = nodes.map((n) => n.id)
  const usable = ids.every((id) => Number.isInteger(id) && id > 0) && new Set(ids).size === ids.length
  return { ...parsed, nodes: usable ? nodes : nodes.map((n, i) => ({ ...n, id: i + 1 })) }
}

// Keeps only the video builder fields it knows, with the right types; anything else
// (missing, wrong type, or unparseable response) falls back to the defaults.
export function parseVideoDefaults(raw, emptyDefaults) {
  let parsed = {}
  try { parsed = parseJsonObject(raw) } catch { /* use defaults */ }
  const result = JSON.parse(JSON.stringify(emptyDefaults))
  for (const [key, fallback] of Object.entries(emptyDefaults)) {
    const value = parsed[key]
    if (Array.isArray(fallback)) {
      if (Array.isArray(value)) result[key] = value.filter((v) => typeof v === 'string')
    } else if (typeof value === typeof fallback) {
      result[key] = value
    }
  }
  return { defaults: result, settingDetail: typeof parsed.settingDetail === 'string' ? parsed.settingDetail : '' }
}

// Builds the final image prompt text: natural-language prompt, plus Midjourney flags on
// their own paragraph when present. Falls back to the raw text if it isn't JSON.
export function buildImagePromptText(raw) {
  const parsed = parseImageAssemblyOutput(raw)
  if (!parsed || !isText(parsed.prompt)) return (raw || '').trim()
  return isText(parsed.flags) ? `${parsed.prompt.trim()}\n\n${parsed.flags.trim()}` : parsed.prompt.trim()
}

// The other way: the prompt, and the Midjourney flags when its last paragraph is flags.
export function splitImagePrompt(text) {
  const src = (text || '').trim()
  const m = src.match(/\n\n(--[a-z][\s\S]*)$/)
  return m ? { prompt: src.slice(0, m.index).trim(), flags: m[1].trim() } : { prompt: src, flags: '' }
}

export function parseImageAnalysisOutput(raw) {
  if (!raw) return null
  try { return parseJsonObject(raw) } catch { return null }
}

export function parseImageAssemblyOutput(raw) {
  return parseImageAnalysisOutput(raw)
}

// A scorecard reason: "+ names the deadline" is a strength, "- no output format" a weakness.
export function parseEvalReason(reason) {
  const m = String(reason || '').match(/^\s*([+\-−–])\s*(.*)$/s)
  if (!m) return { sign: null, text: String(reason || '').trim() }
  return { sign: m[1] === '+' ? '+' : '-', text: m[2].trim() }
}

export function evalVerdict(delta) {
  if (delta >= 30) return '⇑ Big upgrade'
  if (delta >= 15) return '↑ Clear improvement'
  if (delta >= 5)  return '↗ Modest improvement'
  if (delta > -5)  return '→ Minimal difference'
  return '↓ Raw was clearer'
}

export function getModeTagStyle(modeKey) {
  const mode = resolveModeKey(modeKey)
  if (mode === 'dictate') return { background: 'rgba(var(--ink),0.07)', color: 'var(--text-secondary)' }
  return { background: `rgba(${modeTone(mode).rgb},0.1)`, color: modeTextColor(mode) }
}

// Coloured text (mode colours are tuned for dark) mixed toward the ink colour by the theme's
// --accent-text-strength, so it stays readable on light backgrounds. Neutral colours pass
// through unchanged, so it's safe to wrap any text colour.
export function readableColor(color) {
  if (!color || typeof color !== 'string' || color.startsWith('var(') || color === 'inherit' || color === 'transparent') return color
  // Alpha is dropped: a translucent mode colour mixed toward ink still comes out too faint to read.
  const opaque = color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[0-9.]+\)/, 'rgb($1,$2,$3)')
  return `color-mix(in oklab, ${opaque} var(--accent-text-strength), rgb(var(--ink)))`
}
