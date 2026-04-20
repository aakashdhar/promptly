import { useState } from 'react'

export default function ShortcutsPanel({ onClose }) {
  const [doneHovered, setDoneHovered] = useState(false)

  const shortcuts = [
    { desc: 'Start / stop recording', keys: ['⌥', 'Space'] },
    { desc: 'Pause / resume recording', keys: ['⌥', 'P'] },
    { desc: 'Copy last prompt', keys: ['⌘', 'C'] },
    { desc: 'Export prompt', keys: ['⌘', 'E'] },
    { desc: 'Open history', keys: ['⌘', 'H'] },
    { desc: 'Iteration mode', keys: ['⌘', 'I'] },
    { desc: 'Show / hide window', keys: ['⌥', 'Space'] },
    { desc: 'Reset to idle', keys: ['Esc'] },
  ]

  return (
    <div className="relative z-[1] px-[28px] pt-[16px] pb-[24px]" style={{ WebkitAppRegion: 'no-drag' }}>
      <div className="flex justify-between items-center mb-[14px]">
        {/* POLISH-009: 0.20 → 0.50 */}
        <span className="text-[10px] font-bold uppercase" style={{color:'rgba(255,255,255,0.50)', letterSpacing:'0.12em'}}>
          Keyboard shortcuts
        </span>
        {/* POLISH-004: Done button hover */}
        <button
          onClick={onClose}
          onMouseEnter={() => setDoneHovered(true)}
          onMouseLeave={() => setDoneHovered(false)}
          className="text-[11px] cursor-pointer bg-transparent border-none p-0"
          style={{
            color: doneHovered ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.60)',
            transition: 'color 120ms ease',
          }}
        >
          Done
        </button>
      </div>
      {shortcuts.map((s, i) => (
        <div key={i}
          className="flex justify-between items-center py-[7px]"
          style={{borderBottom: i < shortcuts.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none'}}>
          {/* POLISH-009: 0.45 → 0.75 */}
          <span className="text-[12px]" style={{color:'rgba(255,255,255,0.75)'}}>
            {s.desc}
          </span>
          <div className="flex gap-[4px] items-center">
            {s.keys.map((k, j) => (
              <span key={j}>
                {/* POLISH-009: + separator 0.20 → 0.50 */}
                {j > 0 && <span className="text-[10px] mx-[2px]" style={{color:'rgba(255,255,255,0.50)'}}>+</span>}
                <span className="text-[11px] px-[7px] py-[2px] rounded-[5px] tracking-[0.02em]"
                  style={{
                    background:'rgba(255,255,255,0.06)',
                    border:'0.5px solid rgba(255,255,255,0.12)',
                    borderBottom:'1px solid rgba(0,0,0,0.3)',
                    color:'rgba(255,255,255,0.75)',
                  }}>
                  {k}
                </span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
