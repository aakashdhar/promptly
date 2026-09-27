import { parseSections, readableColor } from '../utils/promptUtils.js'

// A prompt's labelled sections ("Role:", "Task:"…), laid out the same way for a fresh result and
// for one reopened from history. Pass `prompt` to split it here, or `sections` already split.
export default function PromptSections({ prompt, sections, labelColor = 'rgba(100,170,255,0.7)', textSize = '14px', textColor = 'rgba(var(--ink),0.95)' }) {
  const list = sections || parseSections(prompt)
  if (!list.length) return null
  return list.map((s, i) => (
    <div key={`${i}-${s.label || ''}`} style={{ marginBottom: i < list.length - 1 ? '18px' : 0 }}>
      {s.label && (
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: readableColor(labelColor), marginBottom: '6px' }}>
          {s.label}
        </div>
      )}
      <div style={{ fontSize: textSize, color: textColor, lineHeight: '1.8', whiteSpace: 'pre-wrap', userSelect: 'text', cursor: 'text' }}>{s.body}</div>
    </div>
  ))
}
