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

export function parseEmailOutput(raw) {
  // Stage 1: strip leading/trailing fences and try direct parse
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try {
    return JSON.parse(stripped)
  } catch {
    // Stage 2: Claude added preamble/postamble — find the outermost {...} and parse that
    const match = stripped.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('No parseable JSON object in email response')
  }
}

export function getModeTagStyle(mode) {
  if (mode === 'polish') return { background: 'rgba(48,209,88,0.08)', color: 'rgba(100,220,130,0.6)' }
  if (mode === 'refine' || mode === 'image') return { background: 'rgba(139,92,246,0.1)', color: 'rgba(167,139,250,0.65)' }
  if (mode === 'workflow') return { background: 'rgba(34,197,94,0.1)', color: 'rgba(74,222,128,0.65)' }
  if (mode === 'email') return { background: 'rgba(20,184,166,0.1)', color: 'rgba(45,212,191,0.65)' }
  return { background: 'rgba(10,132,255,0.1)', color: 'rgba(100,170,255,0.65)' }
}
