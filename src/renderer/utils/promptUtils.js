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
    const m = line.trim().match(/^([A-Za-z][A-Za-z\s]*):\s*$/)
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

export function getModeTagStyle(mode) {
  if (mode === 'polish') return { background: 'rgba(48,209,88,0.08)', color: 'rgba(100,220,130,0.6)' }
  if (mode === 'refine') return { background: 'rgba(168,85,247,0.1)', color: 'rgba(200,150,255,0.65)' }
  return { background: 'rgba(10,132,255,0.1)', color: 'rgba(100,170,255,0.65)' }
}
