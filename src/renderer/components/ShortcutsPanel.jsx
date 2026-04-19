export default function ShortcutsPanel({ onClose }) {
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
    <div className="relative z-[1] px-[22px] pt-[16px] pb-[20px]">
      <div className="flex justify-between items-center mb-[14px]">
        <span className="text-[10px] font-bold tracking-[0.12em] uppercase"
          style={{color:'rgba(255,255,255,0.2)'}}>
          Keyboard shortcuts
        </span>
        <button
          onClick={onClose}
          className="text-[11px] cursor-pointer bg-transparent border-none p-0"
          style={{color:'rgba(255,255,255,0.25)'}}>
          Done
        </button>
      </div>
      {shortcuts.map((s, i) => (
        <div key={i}
          className="flex justify-between items-center py-[7px]"
          style={{borderBottom: i < shortcuts.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none'}}>
          <span className="text-[12px]" style={{color:'rgba(255,255,255,0.45)'}}>
            {s.desc}
          </span>
          <div className="flex gap-[4px] items-center">
            {s.keys.map((k, j) => (
              <span key={j}>
                {j > 0 && <span className="text-[10px] mx-[2px]" style={{color:'rgba(255,255,255,0.2)'}}>+</span>}
                <span className="text-[11px] px-[7px] py-[2px] rounded-[5px] tracking-[0.02em]"
                  style={{
                    background:'rgba(255,255,255,0.06)',
                    border:'0.5px solid rgba(255,255,255,0.12)',
                    borderBottom:'1px solid rgba(0,0,0,0.3)',
                    color:'rgba(255,255,255,0.5)'
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
