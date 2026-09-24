import { readableColor } from '../utils/promptUtils.js'

// plain: a finished result (Do it mode), shown as written instead of split into prompt sections.
export default function PromptSections({ prompt, plain = false, labelColor = 'rgba(100,170,255,0.7)', textSize = '14px', textColor = 'rgba(var(--ink),0.85)' }) {
  if (!prompt) return null
  if (plain) {
    return (
      <div style={{ fontSize: textSize, color: readableColor(textColor), userSelect: 'text', cursor: 'text', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
        {prompt}
      </div>
    )
  }
  const lines = prompt.split('\n')
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }
    const isLabel = /^[A-Za-z][A-Za-z\s/]*:\s*$/.test(line)
    if (isLabel) {
      elements.push(
        <div key={`label-${i}`} style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: readableColor(labelColor),
          marginBottom: '6px', marginTop: elements.length ? '18px' : 0,
          display: 'block',
        }}>
          {line.replace(':', '').trim()}
        </div>
      )
    } else {
      elements.push(
        <div key={`text-${i}`} style={{
          fontSize: textSize, color: readableColor(textColor), userSelect: 'text', cursor: 'text',
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
