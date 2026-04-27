import { useEffect, useRef } from 'react'

function drawMorphWave(ctx, W, H, t) {
  const mid = H / 2
  ctx.clearRect(0, 0, W, H)

  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, 'rgba(10,132,255,0)')
  grad.addColorStop(0.1, 'rgba(10,132,255,0.4)')
  grad.addColorStop(0.9, 'rgba(10,132,255,0.4)')
  grad.addColorStop(1, 'rgba(10,132,255,0)')

  ctx.beginPath()
  ctx.strokeStyle = 'rgba(10,132,255,0.06)'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.moveTo(0, mid)
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * W
    const a = Math.sin(i * 0.18 + t * 0.04) * 2.5 + Math.sin(i * 0.42 + t * 0.025) * 1 + 0.5
    ctx.lineTo(x, mid + a)
  }
  ctx.stroke()

  ctx.beginPath()
  ctx.strokeStyle = grad
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.moveTo(0, mid)
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * W
    const a = Math.sin(i * 0.18 + t * 0.04) * 2.5 + Math.sin(i * 0.42 + t * 0.025) * 1 + 0.5
    ctx.lineTo(x, mid + a)
  }
  ctx.stroke()
}

export default function MorphCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const displayW = canvas.offsetWidth || 340
    const displayH = 36
    canvas.width = displayW * dpr
    canvas.height = displayH * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    let t = 0
    let raf

    function animate() {
      drawMorphWave(ctx, displayW, displayH, t++)
      raf = requestAnimationFrame(animate)
    }
    animate()

    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      id="morph-canvas"
      style={{ width: '100%', height: '36px', display: 'block' }}
    />
  )
}
