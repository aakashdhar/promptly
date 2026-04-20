import { useEffect, useRef } from 'react'

function drawIteratingWave(ctx, W, H, t) {
  const mid = H / 2
  ctx.clearRect(0, 0, W, H)
  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, 'rgba(10,132,255,0)')
  grad.addColorStop(0.08, 'rgba(10,132,255,0.85)')
  grad.addColorStop(0.92, 'rgba(10,132,255,0.85)')
  grad.addColorStop(1, 'rgba(10,132,255,0)')
  ctx.beginPath()
  ctx.strokeStyle = 'rgba(10,132,255,0.1)'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.moveTo(0, mid)
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * W
    const a = (Math.sin(i * 0.42 + t * 0.13) * 0.5 + 0.5) * 10 + (Math.sin(i * 0.85 + t * 0.08) * 0.4) * 4 + 1
    ctx.lineTo(x, mid + (i % 2 === 0 ? a : -a))
  }
  ctx.stroke()
  ctx.beginPath()
  ctx.strokeStyle = grad
  ctx.lineWidth = 1.5
  ctx.moveTo(0, mid)
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * W
    const a = (Math.sin(i * 0.42 + t * 0.13) * 0.5 + 0.5) * 10 + (Math.sin(i * 0.85 + t * 0.08) * 0.4) * 4 + 1
    ctx.lineTo(x, mid + (i % 2 === 0 ? a : -a))
  }
  ctx.stroke()
}

export default function IteratingState({ contextText, duration, onStop, onDismiss }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let t = 0
    let raf

    function loop() {
      const W = canvas.width
      const H = canvas.height
      drawIteratingWave(ctx, W, H, t)
      t++
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div id="panel-iterating" style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ height: '13px', WebkitAppRegion: 'drag' }} />

      <div style={{
        margin: '14px 18px 0',
        padding: '12px 14px',
        background: 'rgba(10,132,255,0.07)',
        border: '0.5px solid rgba(10,132,255,0.15)',
        borderRadius: '10px',
        position: 'relative',
      }}>
        {/* POLISH-009 blue: 0.55 → 0.80 */}
        <div style={{
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '.10em',
          textTransform: 'uppercase',
          color: 'rgba(100,180,255,0.80)',
          marginBottom: '4px',
        }}>
          ITERATING ON
        </div>
        {/* 0.55 is above threshold, stays */}
        <div style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.58)',
          lineHeight: 1.55,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {contextText}
        </div>
      </div>

      <div style={{
        height: '68px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        paddingLeft: '18px',
        paddingRight: '18px',
        WebkitAppRegion: 'drag',
      }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            WebkitAppRegion: 'no-drag',
          }}
          onClick={onDismiss}
        >
          {/* POLISH-009: stroke 0.45 → 0.75 */}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          height: '36px',
          WebkitAppRegion: 'no-drag',
        }}>
          <canvas
            ref={canvasRef}
            width={340}
            height={36}
            style={{ width: '100%', height: '36px', display: 'block' }}
          />
        </div>

        {/* POLISH-003: timer fontWeight 400, letterSpacing 0.08em */}
        <span style={{
          fontSize: '11px',
          fontWeight: 400,
          color: 'rgba(255,255,255,0.60)',
          flexShrink: 0,
          minWidth: '28px',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.08em',
          WebkitAppRegion: 'no-drag',
        }}>
          {duration}
        </span>

        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#0A84FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            animation: 'iterGlow 2s ease-in-out infinite',
            WebkitAppRegion: 'no-drag',
          }}
          onClick={onStop}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="white" />
          </svg>
        </div>
      </div>

      <div style={{
        height: '0.5px',
        background: 'rgba(255,255,255,0.06)',
        margin: '0 18px',
      }} />
    </div>
  )
}
