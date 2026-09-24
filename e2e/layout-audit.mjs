// Layout checks run inside a page: text that is cut off, things outside the window or pressed
// against its edge, controls on top of each other, text too faint or too small to read.
// Returns a list of { kind, what, detail }. Mark an element data-audit-skip to leave it out
// (for purely decorative things); everything a person is meant to read is checked.

export const EDGE_MIN = 12 // px of breathing room between readable content and the window edge
export const MIN_FONT = 11 // px

function auditInPage({ edgeMin, minFont }) {
  const W = window.innerWidth
  const H = window.innerHeight
  const issues = []
  const seen = new Set()
  const add = (kind, el, detail) => {
    const what = describe(el)
    const key = `${kind}|${what}`
    if (seen.has(key)) return
    seen.add(key)
    issues.push({ kind, what, detail })
  }

  function describe(el) {
    const text = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || el.placeholder || '').replace(/\s+/g, ' ').trim()
    const id = el.id ? `#${el.id}` : ''
    return `<${el.tagName.toLowerCase()}${id}> "${text.slice(0, 50)}${text.length > 50 ? '…' : ''}"`
  }

  function isShown(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n)
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return false
    }
    const r = el.getBoundingClientRect()
    return r.width > 0.5 && r.height > 0.5
  }

  function opacityChain(el) {
    let o = 1
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity)
    return o
  }

  const directText = (el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())
  const readable = (el) => directText(el) || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
  // Clickable divs count too: anything that shows a pointer cursor and isn't just inheriting it.
  const interactive = (el) => ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A'].includes(el.tagName) || el.getAttribute('role') === 'button' ||
    (getComputedStyle(el).cursor === 'pointer' && (!el.parentElement || getComputedStyle(el.parentElement).cursor !== 'pointer'))
  const scrolls = (s, axis) => ['auto', 'scroll', 'overlay'].includes(axis === 'x' ? s.overflowX : s.overflowY)
  const clips = (s, axis) => ['hidden', 'clip'].includes(axis === 'x' ? s.overflowX : s.overflowY)

  // Where the text actually is (padding excluded); the element's box for controls without text.
  function contentRect(el) {
    if (!directText(el)) return el.getBoundingClientRect()
    const range = document.createRange()
    const rects = []
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue
      range.selectNodeContents(n)
      rects.push(...Array.from(range.getClientRects()).filter((r) => r.width > 0))
    }
    if (!rects.length) return el.getBoundingClientRect()
    return rects.reduce((u, r) => ({ left: Math.min(u.left, r.left), top: Math.min(u.top, r.top), right: Math.max(u.right, r.right), bottom: Math.max(u.bottom, r.bottom) }),
      { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity })
  }

  // The part of the element a person can actually see: cut by every clipping ancestor, stopping
  // at a scroll container (anything past that is one scroll away, not lost).
  function visibleArea(el) {
    let r = contentRect(el)
    let box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    const cut = { x: false, y: false }
    let scroller = null
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n)
      const nr = n.getBoundingClientRect()
      for (const axis of ['x', 'y']) {
        if (scrolls(s, axis)) { scroller = scroller || n; continue }
        if (!clips(s, axis) || scroller) continue
        const [lo, hi] = axis === 'x' ? ['left', 'right'] : ['top', 'bottom']
        if (box[lo] < nr[lo] - 1 || box[hi] > nr[hi] + 1) cut[axis] = true
        box[lo] = Math.max(box[lo], nr[lo]); box[hi] = Math.min(box[hi], nr[hi])
      }
      if (scroller) break
    }
    return { box, cut, scroller }
  }

  // Any CSS colour (color-mix, oklab, color(srgb …)) → sRGB by painting one pixel.
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  function parseColor(c) {
    if (!c || c === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = c
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return { r, g, b, a: a / 255 }
  }
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  })
  function backgroundBehind(el) {
    const layers = []
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n)
      if (s.backgroundImage && s.backgroundImage !== 'none') return null // gradient/image: can't judge
      const c = parseColor(s.backgroundColor)
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break }
    }
    let base = parseColor(getComputedStyle(document.body).backgroundColor)
    if (!base || base.a < 1) base = window.matchMedia('(prefers-color-scheme: dark)').matches ? { r: 30, g: 30, b: 32, a: 1 } : { r: 245, g: 245, b: 247, a: 1 }
    return layers.reverse().reduce((acc, c) => over(c, acc), base)
  }
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

  const all = Array.from(document.body.querySelectorAll('*')).filter((el) =>
    !el.closest('[data-audit-skip]') && !el.closest('[inert]') && !['SCRIPT', 'STYLE', 'svg', 'path', 'I', 'OPTION'].includes(el.tagName) && !(el instanceof SVGElement) && isShown(el))

  for (const el of all) {
    if (!readable(el) && !interactive(el)) continue
    const s = getComputedStyle(el)
    const { box, cut, scroller } = visibleArea(el)
    const onScreen = box.right > box.left + 1 && box.bottom > box.top + 1

    // Text cut off inside its own box (ellipsis, fixed height) or by a clipping parent.
    if (directText(el) && s.whiteSpace !== 'normal' && el.scrollWidth > el.clientWidth + 1 && (clips(s, 'x') || s.textOverflow === 'ellipsis'))
      add('clipped', el, `text is ${el.scrollWidth - el.clientWidth}px wider than its box`)
    if (directText(el) && el.scrollHeight > el.clientHeight + 2 && clips(s, 'y') && el.clientHeight > 0)
      add('clipped', el, `text is ${el.scrollHeight - el.clientHeight}px taller than its box`)
    if (s.webkitLineClamp && s.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 2)
      add('clipped', el, 'line clamp hides text')
    if (cut.x || cut.y) add('cut-off', el, `partly hidden by a parent (${[cut.x && 'sideways', cut.y && 'top/bottom'].filter(Boolean).join(', ')})`)

    if (!onScreen) continue
    // Outside the window, or pressed against its edge. Things inside a scroll area are judged
    // against that area's edges instead of the window's only when the area itself is on screen.
    // Full-width click areas (a whole bar you can click) are meant to touch the edges.
    const fullBleed = !directText(el) && box.right - box.left >= W - 4
    if (!scroller && !fullBleed) {
      if (box.left < 0 || box.top < 0 || box.right > W || box.bottom > H) add('off-window', el, 'extends past the window')
      else {
        const gaps = { left: box.left, right: W - box.right, bottom: H - box.bottom }
        const tight = Object.entries(gaps).filter(([, v]) => v < edgeMin).map(([k, v]) => `${k} ${Math.round(v)}px`)
        if (tight.length) add('edge', el, `too close to the window edge: ${tight.join(', ')}`)
      }
    }

    if (directText(el) || ['INPUT', 'TEXTAREA'].includes(el.tagName)) {
      const size = parseFloat(s.fontSize)
      if (size < minFont) add('tiny', el, `${size}px text`)
      if (!el.disabled && !el.closest('[aria-disabled="true"]')) {
        const fg = parseColor(s.color)
        const bg = backgroundBehind(el)
        if (fg && bg) {
          const eff = { ...fg, a: fg.a * opacityChain(el) }
          const ratio = contrast(over(eff, bg), bg)
          const large = size >= 18 || (size >= 14 && parseInt(s.fontWeight, 10) >= 600)
          const need = large ? 3 : 4.5
          if (ratio < need) add('contrast', el, `contrast ${ratio.toFixed(2)} (needs ${need})`)
        }
      }
    }
  }

  // Reading areas that scroll sideways: a long word or URL that should have wrapped.
  for (const el of all) {
    const s = getComputedStyle(el)
    if (scrolls(s, 'x') && el.scrollWidth > el.clientWidth + 1 && !['INPUT', 'TEXTAREA'].includes(el.tagName))
      add('sideways', el, `scrolls sideways by ${el.scrollWidth - el.clientWidth}px`)
  }

  // What is on screen right now, cut by every ancestor that clips or scrolls (content scrolled
  // under a sticky footer is hidden, not overlapping).
  function onScreenRect(el) {
    const r = el.getBoundingClientRect()
    const box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n)
      const nr = n.getBoundingClientRect()
      if (s.overflowX !== 'visible') { box.left = Math.max(box.left, nr.left); box.right = Math.min(box.right, nr.right) }
      if (s.overflowY !== 'visible') { box.top = Math.max(box.top, nr.top); box.bottom = Math.min(box.bottom, nr.bottom) }
    }
    return box
  }

  // Controls on top of each other.
  const controls = all.filter(interactive).map((el) => ({ el, r: onScreenRect(el) })).filter(({ r }) => r.right > r.left && r.bottom > r.top)
  for (let i = 0; i < controls.length; i++) {
    for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i]; const b = controls[j]
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
      if (w > 2 && h > 2) add('overlap', a.el, `overlaps ${describe(b.el)}`)
    }
  }
  return issues
}

// Runs the checks on a Playwright page (waits for transitions to settle first).
export async function auditLayout(page, opts = {}) {
  await page.waitForTimeout(opts.settle ?? 350)
  return page.evaluate(auditInPage, { edgeMin: opts.edgeMin ?? EDGE_MIN, minFont: opts.minFont ?? MIN_FONT })
}

export function formatIssues(name, issues) {
  return issues.map((i) => `  [${name}] ${i.kind.padEnd(10)} ${i.what} — ${i.detail}`).join('\n')
}
