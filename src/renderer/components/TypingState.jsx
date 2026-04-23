import { useState, useEffect, useRef } from 'react'

export default function TypingState({ onDismiss, onSubmit, resizeWindow }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setText(val)
    const lines = val.split('\n').length
    const newH = Math.min(244 + Math.floor(lines / 4) * 40, 344)
    resizeWindow(newH)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { onDismiss(); return }
    if (e.key === 'Enter' && e.metaKey && text.trim()) {
      onSubmit(text.trim())
    }
  }

  const hasText = !!text.trim()

  return (
    <div style={{position:'relative', zIndex:1}}>
      {/* Traffic light breathing room */}
      <div style={{height:'36px', WebkitAppRegion:'drag'}} />
      {/* Top row */}
      <div style={{height:'36px', display:'flex', alignItems:'center', padding:'0 18px', gap:'10px', WebkitAppRegion:'drag'}}>
        <div
          onClick={onDismiss}
          style={{width:'28px', height:'28px', borderRadius:'50%', background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, WebkitAppRegion:'no-drag'}}
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span style={{flex:1, fontSize:'12px', color:'rgba(255,255,255,0.5)', fontWeight:500, WebkitAppRegion:'no-drag'}}>
          Type your prompt
        </span>
        <div
          onClick={() => onDismiss('voice')}
          style={{display:'flex', alignItems:'center', gap:'5px', padding:'4px 10px', background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:'20px', cursor:'pointer', WebkitAppRegion:'no-drag'}}
        >
          <svg width="10" height="12" viewBox="0 0 12 16" fill="none">
            <rect x="3.5" y="0.5" width="5" height="9" rx="2.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
            <path d="M1 8.5C1 11.26 3.24 13.5 6 13.5C8.76 13.5 11 11.26 11 8.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          <span style={{fontSize:'10px', color:'rgba(255,255,255,0.4)'}}>Switch to voice</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{height:'0.5px', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)', margin:'0 18px'}}/>

      {/* Text area */}
      <div style={{padding:'14px 18px'}}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you want Claude to build, design, or write..."
          rows={4}
          style={{
            width:'100%', background:'rgba(255,255,255,0.04)',
            border: text ? '0.5px solid rgba(10,132,255,0.25)' : '0.5px solid rgba(255,255,255,0.08)',
            borderRadius:'10px', padding:'10px 12px',
            fontSize:'13px', color:'rgba(255,255,255,0.78)',
            lineHeight:1.65, fontFamily:'inherit',
            outline:'none', resize:'none', boxSizing:'border-box',
            WebkitAppRegion:'no-drag',
            transition:'border-color 150ms'
          }}
        />
        <div style={{fontSize:'10px', color:'rgba(255,255,255,0.2)', marginTop:'5px', textAlign:'right'}}>
          ⌘↵ to submit · Esc to cancel
        </div>
      </div>

      {/* Divider */}
      <div style={{height:'0.5px', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)', margin:'0 18px'}}/>

      {/* Submit row */}
      <div style={{padding:'12px 18px 22px'}}>
        <button
          onClick={() => hasText && onSubmit(text.trim())}
          disabled={!hasText}
          style={{
            width:'100%', height:'38px',
            background: hasText
              ? 'linear-gradient(135deg,rgba(10,132,255,0.92),rgba(10,100,220,0.92))'
              : 'rgba(255,255,255,0.06)',
            color: hasText ? 'white' : 'rgba(255,255,255,0.25)',
            border:'none', borderRadius:'10px',
            fontSize:'13px', fontWeight:600, fontFamily:'inherit',
            cursor: hasText ? 'pointer' : 'default',
            boxShadow: hasText ? '0 2px 16px rgba(10,132,255,0.35)' : 'none',
            transition:'all 200ms'
          }}
        >
          Generate prompt
        </button>
      </div>
    </div>
  )
}
