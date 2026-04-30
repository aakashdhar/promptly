import { useEffect, useRef } from 'react'

function drawRecordingWave(ctx, W, H, t) {
  const mid = H / 2
  ctx.clearRect(0, 0, W, H)

  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, 'rgba(200,50,35,0)')
  grad.addColorStop(0.08, 'rgba(200,50,35,0.65)')
  grad.addColorStop(0.92, 'rgba(200,50,35,0.65)')
  grad.addColorStop(1, 'rgba(200,50,35,0)')

  ctx.beginPath()
  ctx.strokeStyle = 'rgba(200,50,35,0.07)'
  ctx.lineWidth = 3
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
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.moveTo(0, mid)
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * W
    const a = (Math.sin(i * 0.42 + t * 0.13) * 0.5 + 0.5) * 10 + (Math.sin(i * 0.85 + t * 0.08) * 0.4) * 4 + 1
    ctx.lineTo(x, mid + (i % 2 === 0 ? a : -a))
  }
  ctx.stroke()
}

export default function WaveformCanvas() {
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
      drawRecordingWave(ctx, displayW, displayH, t++)
      raf = requestAnimationFrame(animate)
    }
    animate()

    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      id="recCanvas"
      style={{ width: '130%', height: '36px', display: 'block', marginLeft: '-15%' }}
    />
  )
}
