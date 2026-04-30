import { useEffect, useRef } from 'react'

function drawMorphWave(ctx, W, H, t) {
  const mid = H / 2
  ctx.clearRect(0, 0, W, H)

  // pulse: 0→1→0 with ~6s period — drives slow↔fast energy bursts
  const pulse = (Math.sin(t * 0.016) + 1) / 2
  const speed = 0.022 + pulse * 0.072        // 0.022 (calm) → 0.094 (burst)
  const amp   = 1.2 + pulse * 6.5            // 1.2px (calm) → 7.7px (burst)
  const freq1 = 0.16 + pulse * 0.06          // slight frequency shift at peaks
  const glowAlpha = 0.05 + pulse * 0.12      // glow breathes with energy

  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0,   'rgba(10,132,255,0)')
  grad.addColorStop(0.1, `rgba(10,132,255,${0.25 + pulse * 0.2})`)
  grad.addColorStop(0.9, `rgba(10,132,255,${0.25 + pulse * 0.2})`)
  grad.addColorStop(1,   'rgba(10,132,255,0)')

  function plotWave() {
    ctx.moveTo(0, mid)
    for (let i = 0; i <= 100; i++) {
      const x = (i / 100) * W
      const a = Math.sin(i * freq1 + t * speed) * amp
              + Math.sin(i * 0.38 + t * speed * 0.55) * (amp * 0.35)
      ctx.lineTo(x, mid + a)
    }
  }

  ctx.beginPath()
  ctx.strokeStyle = `rgba(10,132,255,${glowAlpha})`
  ctx.lineWidth = 3 + pulse * 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  plotWave()
  ctx.stroke()

  ctx.beginPath()
  ctx.strokeStyle = grad
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  plotWave()
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
      style={{ width: '130%', height: '36px', display: 'block', marginLeft: '-15%' }}
    />
  )
}
