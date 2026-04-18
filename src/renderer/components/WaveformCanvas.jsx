import { useEffect, useRef } from 'react'

function drawRecordingWave(ctx, W, H, t) {
  const mid = H / 2
  ctx.clearRect(0, 0, W, H)

  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, 'rgba(255,59,48,0)')
  grad.addColorStop(0.08, 'rgba(255,59,48,0.85)')
  grad.addColorStop(0.92, 'rgba(255,59,48,0.85)')
  grad.addColorStop(1, 'rgba(255,59,48,0)')

  ctx.beginPath()
  ctx.strokeStyle = 'rgba(255,59,48,0.1)'
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

export default function WaveformCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let t = 0
    let raf

    function animate() {
      drawRecordingWave(ctx, canvas.width, canvas.height, t++)
      raf = requestAnimationFrame(animate)
    }
    animate()

    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      id="recCanvas"
      width={340}
      height={36}
      style={{ width: '100%', height: '36px', display: 'block' }}
    />
  )
}
