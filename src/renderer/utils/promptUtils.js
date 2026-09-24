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

// Claude often wraps JSON in ```json fences, sometimes with preamble. Strip fences, then
// fall back to the outermost {...}. Throws if no JSON object can be parsed.
export function parseJsonObject(raw) {
  const stripped = (raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  let parsed
  try {
    parsed = JSON.parse(stripped)
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No parseable JSON object in response')
    parsed = JSON.parse(match[0])
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
    .map((n) => ({ ...n, placeholders: Array.isArray(n.placeholders) ? n.placeholders.filter((p) => typeof p === 'string') : [] }))
  if (nodes.length === 0) return null
  return { ...parsed, nodes }
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

export function parseImageAnalysisOutput(raw) {
  if (!raw) return null
  try { return parseJsonObject(raw) } catch { return null }
}

export function parseImageAssemblyOutput(raw) {
  return parseImageAnalysisOutput(raw)
}

export function evalScoreColor(score, isPromptly) {
  if (isPromptly) return 'rgba(48,209,88,0.85)'
  if (score >= 80) return 'rgba(48,209,88,0.85)'
  if (score >= 60) return 'rgba(48,209,88,0.55)'
  if (score >= 40) return 'rgba(255,159,10,0.85)'
  return 'rgba(255,69,58,0.85)'
}

export function evalVerdict(delta) {
  if (delta >= 30) return '⇑ Big upgrade'
  if (delta >= 15) return '↑ Clear improvement'
  if (delta >= 5)  return '↗ Modest improvement'
  if (delta > -5)  return '→ Minimal difference'
  return '↓ Raw was clearer'
}

export function getModeTagStyle(mode) {
  if (mode === 'polish') return { background: 'rgba(48,209,88,0.08)', color: 'color-mix(in oklab, rgb(100,220,130) var(--accent-text-strength), rgb(var(--ink)))' }
  if (mode === 'refine' || mode === 'image') return { background: 'rgba(139,92,246,0.1)', color: 'color-mix(in oklab, rgb(167,139,250) var(--accent-text-strength), rgb(var(--ink)))' }
  if (mode === 'workflow') return { background: 'rgba(34,197,94,0.1)', color: 'color-mix(in oklab, rgb(74,222,128) var(--accent-text-strength), rgb(var(--ink)))' }
  if (mode === 'email') return { background: 'rgba(20,184,166,0.1)', color: 'color-mix(in oklab, rgb(45,212,191) var(--accent-text-strength), rgb(var(--ink)))' }
  return { background: 'rgba(10,132,255,0.1)', color: 'color-mix(in oklab, rgb(100,170,255) var(--accent-text-strength), rgb(var(--ink)))' }
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
