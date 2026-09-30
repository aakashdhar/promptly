import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const root = path.resolve(import.meta.dirname, '..')
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
const page = read('launch.html')
const main = read('main.js')

describe('launch splash (launch.html)', () => {
  it('is packaged with the app and loaded by main.js', () => {
    expect(JSON.parse(read('package.json')).build.files).toContain('launch.html')
    expect(main).toMatch(/loadFile\(path\.join\(__dirname, 'launch\.html'\)/)
  })

  it('works offline and loads nothing: no network, no preload, a CSP that allows only itself', () => {
    expect(page).toMatch(/Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';"/)
    expect(page).not.toMatch(/https?:\/\//i)
    expect(page).not.toMatch(/<(link|img|iframe|object|embed)\b/i)
    expect(page).not.toMatch(/electronAPI/)
    const opts = main.slice(main.indexOf('function showLaunchSplash'), main.indexOf('function dismissLaunchWindow'))
    expect(opts).not.toMatch(/preload/)
    expect(opts).toMatch(/sandbox: true/)
  })

  // 2.20.6: the pill was set up mid-intro, Promptly stopped being the active app, and the app you
  // were in came in front of the splash. You saw a dark box, then the window.
  it('plays in full before anything else opens a window, above other apps\' windows', () => {
    const opts = main.slice(main.indexOf('function showLaunchSplash'), main.indexOf('function dismissLaunchWindow'))
    expect(opts).toMatch(/alwaysOnTop: true/)
    const start = main.slice(main.indexOf('app.whenReady().then('))
    const at = (s) => { const i = start.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i }
    expect(at('const intro = showLaunchSplash()')).toBeLessThan(at('await resolveAllPaths()'))
    expect(at('await intro;')).toBeLessThan(at('createWindow();'))
    expect(at('await intro;')).toBeLessThan(at('createPillWindow();'))
    expect(at('await intro;')).toBeLessThan(at('helper.start();'))
    // The speech engine's GPU warm-up waits until the splash has gone.
    expect(start).toMatch(/whenLaunchGone\(\)\s*\.then\(\(\) => whisper\.warmUp/)
  })

  it('starts its intro when main.js says the window is on screen, never on its own', () => {
    expect(main).toMatch(/w\.once\('show', \(\) => \{\s*w\.webContents\.executeJavaScript\('window\.startSplash \? window\.startSplash\(\) : null'/)
    expect(page).toMatch(/window\.startSplash = function/)
    // It waits for frames that were really drawn, not for the page's visibility.
    expect(page).toMatch(/requestAnimationFrame\(function \(\) \{\s*requestAnimationFrame/)
    expect(page).not.toMatch(/visibilityState|visibilitychange/)
    // Before it starts, nothing shows.
    expect(page).toMatch(/<html lang="en" class="pre">/)
    expect(page).toMatch(/\.pre \.stage \{ opacity: 0; \}/)
  })

  it('lets main.js end it: finishSplash waits out the intro, then plays the exit', () => {
    expect(page).toMatch(/window\.finishSplash = function/)
    expect(main).toMatch(/window\.finishSplash \? window\.finishSplash\(\) : null/)
    // The intro constant covers the last animation in the style (the footer: 1880 ms + 300 ms).
    const intro = Number(/var INTRO_MS = (\d+)/.exec(page)[1])
    const ends = [...page.matchAll(/\.run [^{]+\{ animation: \w[\w-]* (\d+)ms [^;]*? (\d+)ms (?:backwards|both|forwards)/g)]
      .map((m) => Number(m[1]) + Number(m[2]))
    expect(ends.length).toBeGreaterThan(5)
    expect(intro).toBeGreaterThanOrEqual(Math.max(...ends))
  })

  it('shows the version it is given, and the status line the app can change', () => {
    expect(page).toMatch(/<p id="status" aria-live="polite">Starting up…<\/p>/)
    expect(page).toMatch(/<span id="version"><\/span>/)
    expect(main).toMatch(/query: \{ v: app\.getVersion\(\) \}/)
  })

  it('switches every animation off for reduced motion', () => {
    expect(page).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.stage \*, \.stage \{ animation: none !important; \}/)
  })
})
