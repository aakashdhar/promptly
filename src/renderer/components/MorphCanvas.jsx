import { useEffect, useRef } from 'react'

function drawMorphWave(ctx, W, H, t) {
  const mid = H / 2
  ctx.clearRect(0, 0, W, H)

  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, 'rgba(10,132,255,0)')
  grad.addColorStop(0.1, 'rgba(10,132,255,0.5)')
  grad.addColorStop(0.9, 'rgba(10,132,255,0.5)')
  grad.addColorStop(1, 'rgba(10,132,255,0)')

  ctx.beginPath()
  ctx.strokeStyle = 'rgba(10,132,255,0.06)'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.moveTo(0, mid)
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * W
    const a = Math.sin(i * 0.18 + t * 0.04) * 3.5 + Math.sin(i * 0.42 + t * 0.025) * 1.5 + 0.5
    ctx.lineTo(x, mid + a)
  }
  ctx.stroke()

  ctx.beginPath()
  ctx.strokeStyle = grad
  ctx.lineWidth = 1.5
  ctx.moveTo(0, mid)
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * W
    const a = Math.sin(i * 0.18 + t * 0.04) * 3.5 + Math.sin(i * 0.42 + t * 0.025) * 1.5 + 0.5
    ctx.lineTo(x, mid + a)
  }
  ctx.stroke()
}

export default function MorphCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let t = 0
    let raf

    function animate() {
      drawMorphWave(ctx, canvas.width, canvas.height, t++)
      raf = requestAnimationFrame(animate)
    }
    animate()

    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      id="morph-canvas"
      width={476}
      height={32}
      style={{ width: '100%', height: '32px', display: 'block' }}
    />
  )
}
