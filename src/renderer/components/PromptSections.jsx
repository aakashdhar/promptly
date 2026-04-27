export default function PromptSections({ prompt, labelColor = 'rgba(100,170,255,0.7)', textSize = '14px', textColor = 'rgba(255,255,255,0.85)' }) {
  if (!prompt) return null
  const lines = prompt.split('\n')
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }
    const isLabel = /^[A-Z][A-Z\s/]+:/.test(line)
    if (isLabel) {
      elements.push(
        <div key={`label-${i}`} style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: labelColor,
          marginBottom: '6px', marginTop: elements.length ? '18px' : 0,
          display: 'block',
        }}>
          {line.replace(':', '').trim()}
        </div>
      )
    } else {
      elements.push(
        <div key={`text-${i}`} style={{
          fontSize: textSize, color: textColor,
          lineHeight: 1.75, marginBottom: '4px',
        }}>
          {line}
        </div>
      )
    }
    i++
  }
  return elements
}
