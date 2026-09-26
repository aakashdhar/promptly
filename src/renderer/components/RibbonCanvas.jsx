import { useEffect, useRef } from 'react'
import { getMicLevel } from '../utils/micLevel.js'

// The Ribbon: three lines that weave and swell with your voice across the full width, tapering
// to nothing at the ends. tone: 'live' (listening), 'quiet' (speak up, amber) or 'calm'
// (paused or transcribing: flat and grey). Colours come from the theme tokens.
const LINES = [
  // amplitude, cycles across, speed, phase, width, alpha, colour
  [1, 1.5, 1.9, 0, 3, 0.95, 'ink'],
  [0.72, 2.2, -1.4, 1.7, 2.2, 0.6, 'accent'],
  [0.5, 3.0, 2.6, 3.1, 1.6, 0.4, 'accent'],
]

export default function RibbonCanvas({ tone = 'live', height = 190 }) {
  const ref = useRef(null)
  const toneRef = useRef(tone)
  toneRef.current = tone

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return undefined
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let shown = 0
    const css = getComputedStyle(document.documentElement)
    const colours = () => ({
      ink: css.getPropertyValue('--ink').trim() || '236, 236, 240',
      accent: css.getPropertyValue('--wave-accent').trim() || '111, 163, 242',
      warn: css.getPropertyValue('--wave-warn').trim() || '255, 179, 64',
    })

    function draw(now) {
      const dpr = window.devicePixelRatio || 1
      const w = Math.round(canvas.clientWidth * dpr)
      const h = Math.round(canvas.clientHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, w, h)

      const t = toneRef.current
      const target = t === 'calm' ? 0 : getMicLevel()
      // Rise quickly, fall gently, so speech looks alive without flicker.
      shown += (target - shown) * (target > shown ? 0.3 : 0.07)
      const c = colours()
      const time = reduced ? 0 : now / 1000
      const swell = 0.08 + Math.sqrt(shown) * 0.92

      for (const [amp, cycles, speed, phase, width, alpha, key] of LINES) {
        const rgb = t === 'quiet' ? c.warn : t === 'calm' ? c.ink : c[key]
        const a = t === 'calm' ? alpha * 0.35 : alpha
        ctx.beginPath()
        for (let x = 0; x <= w; x += 4) {
          const u = x / w
          const taper = Math.pow(Math.sin(Math.PI * u), 1.6)
          const y = h / 2 + Math.sin(u * cycles * Math.PI * 2 + time * speed + phase) * swell * h * 0.46 * amp * taper
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.lineWidth = width * dpr
        ctx.strokeStyle = `rgba(${rgb}, ${a})`
        ctx.shadowColor = `rgba(${rgb}, ${t === 'calm' ? 0 : 0.55})`
        ctx.shadowBlur = 9 * dpr
        ctx.stroke()
      }
      ctx.shadowBlur = 0
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  return <canvas ref={ref} aria-hidden="true" style={{ display: 'block', width: '100%', height: `${height}px` }} />
}
