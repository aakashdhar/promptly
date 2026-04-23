export default function PolishReadyState({ polished, changes, transcript, tone, onReset, onCopy, copied, onToneChange }) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', height:'100%',
      padding:'0 0 12px 0', overflow:'hidden'
    }}>
      {/* Top row */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'14px 20px 10px', flexShrink:0
      }}>
        <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
          <span style={{
            width:'16px', height:'16px', borderRadius:'50%',
            background:'rgba(48,209,88,0.2)', border:'1px solid rgba(48,209,88,0.4)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
          }}>
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
              <path d="M1 3l2 2 4-4" stroke="rgba(48,209,88,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span style={{fontSize:'12px', fontWeight:500, color:'rgba(255,255,255,0.75)'}}>
            Polished & ready
          </span>
        </div>

        {/* Tone toggle */}
        <div style={{
          display:'flex', background:'rgba(255,255,255,0.05)',
          border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:'20px',
          padding:'2px', gap:'2px'
        }}>
          {['Formal','Casual'].map(t => (
            <div
              key={t}
              onClick={() => onToneChange(t.toLowerCase())}
              style={{
                padding:'3px 10px', borderRadius:'16px', fontSize:'10px',
                fontWeight: tone === t.toLowerCase() ? 500 : 400,
                cursor:'pointer',
                background: tone === t.toLowerCase() ? 'rgba(48,209,88,0.15)' : 'transparent',
                border: tone === t.toLowerCase() ? '0.5px solid rgba(48,209,88,0.25)' : '0.5px solid transparent',
                color: tone === t.toLowerCase() ? 'rgba(100,220,130,0.9)' : 'rgba(255,255,255,0.3)'
              }}
            >
              {t}
            </div>
          ))}
        </div>

        {/* Reset button */}
        <button
          onClick={onReset}
          style={{
            background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.12)',
            borderRadius:'8px', color:'rgba(255,255,255,0.45)', cursor:'pointer',
            fontSize:'11px', padding:'5px 10px'
          }}
        >
          ×
        </button>
      </div>

      {/* Scrollable content area */}
      <div style={{flex:1, overflowY:'auto', padding:'0 20px', minHeight:0}}>
        {/* Divider */}
        <div style={{height:'0.5px', background:'rgba(255,255,255,0.07)', marginBottom:'10px'}} />

        {/* You said */}
        <div style={{marginBottom:'12px'}}>
          <div style={{
            fontSize:'9px', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase',
            color:'rgba(255,255,255,0.25)', marginBottom:'5px'
          }}>
            You said
          </div>
          <div style={{
            fontSize:'12px', color:'rgba(255,255,255,0.45)', lineHeight:1.5,
            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'
          }}>
            {transcript}
          </div>
        </div>

        {/* Divider */}
        <div style={{height:'0.5px', background:'rgba(255,255,255,0.07)', marginBottom:'10px'}} />

        {/* Polished text */}
        <div style={{marginBottom:'12px'}}>
          <div style={{
            fontSize:'9px', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase',
            color:'rgba(48,209,88,0.65)', marginBottom:'5px'
          }}>
            Polished text
          </div>
          <div style={{
            fontSize:'13px', color:'rgba(255,255,255,0.88)', lineHeight:1.6,
            whiteSpace:'pre-wrap'
          }}>
            {polished}
          </div>
        </div>

        {/* What changed — only if changes exist */}
        {changes.length > 0 && (
          <div style={{
            margin:'0 0 12px',
            padding:'10px 12px',
            background:'rgba(48,209,88,0.04)',
            border:'0.5px solid rgba(48,209,88,0.12)',
            borderRadius:'10px'
          }}>
            <div style={{
              fontSize:'9px', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase',
              color:'rgba(48,209,88,0.5)', marginBottom:'6px'
            }}>
              What changed
            </div>
            {changes.map((note, i) => (
              <div key={i} style={{fontSize:'11.5px', color:'rgba(255,255,255,0.45)', lineHeight:1.5}}>
                {note}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action row */}
      <div style={{padding:'8px 20px 0', flexShrink:0}}>
        <button
          onClick={onCopy}
          style={{
            width:'100%', padding:'10px', borderRadius:'10px', cursor:'pointer',
            background: copied ? 'rgba(48,209,88,0.2)' : 'rgba(48,209,88,0.15)',
            border: copied ? '0.5px solid rgba(48,209,88,0.5)' : '0.5px solid rgba(48,209,88,0.3)',
            color: copied ? 'rgba(100,220,130,1)' : 'rgba(100,220,130,0.9)',
            fontSize:'12px', fontWeight:500, transition:'all 150ms'
          }}
        >
          {copied ? '✓ Copied' : 'Copy text'}
        </button>
      </div>
    </div>
  )
}
