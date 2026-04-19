import { useState } from 'react'

const FORMATS = [
  { id: 'txt',  label: 'Text',     ext: '.txt',  icon: '⌄' },
  { id: 'md',   label: 'Markdown', ext: '.md',   icon: '✦' },
  { id: 'json', label: 'JSON',     ext: '.json', icon: '{}' },
]

function formatContent(format, prompt, transcript, mode) {
  if (format === 'txt') {
    return `PROMPT\n\n${prompt}\n\nYOU SAID\n\n${transcript}\n\nMODE: ${mode}`
  }
  if (format === 'md') {
    return `# Generated Prompt\n\n${prompt}\n\n---\n\n**You said:** ${transcript}\n\n**Mode:** ${mode}\n\n**Generated:** ${new Date().toISOString()}`
  }
  if (format === 'json') {
    return JSON.stringify({ prompt, transcript, mode, timestamp: new Date().toISOString() }, null, 2)
  }
}

export default function ExportPanel({ prompt, transcript, mode, onExportDone }) {
  const [selected, setSelected] = useState('txt')
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    const content = formatContent(selected, prompt, transcript, mode)
    const filename = `prompt-${Date.now()}.${selected}`
    await window.electronAPI.saveFile({ content, filename, format: selected })
    setExporting(false)
    if (onExportDone) onExportDone()
  }

  return (
    <div className="px-[22px] pt-[14px] pb-0" style={{ WebkitAppRegion: 'no-drag' }}>
      <div
        className="text-[9px] font-bold tracking-[0.12em] uppercase mb-[10px]"
        style={{ color: 'rgba(255,255,255,0.16)' }}
      >
        Export as
      </div>
      <div className="grid grid-cols-3 gap-[8px] mb-[14px]">
        {FORMATS.map(f => (
          <button
            key={f.id}
            onClick={() => setSelected(f.id)}
            className="h-[52px] rounded-[10px] flex flex-col items-center justify-center gap-[3px] cursor-pointer transition-all duration-150"
            style={{
              border: selected === f.id
                ? '0.5px solid rgba(10,132,255,0.35)'
                : '0.5px solid rgba(255,255,255,0.1)',
              background: selected === f.id
                ? 'rgba(10,132,255,0.08)'
                : 'rgba(255,255,255,0.04)',
            }}
          >
            <span className="text-[13px]">{f.icon}</span>
            <span
              className="text-[10px] font-semibold tracking-[0.04em]"
              style={{ color: selected === f.id ? 'rgba(100,180,255,0.85)' : 'rgba(255,255,255,0.5)' }}
            >
              {f.label}
            </span>
            <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{f.ext}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
