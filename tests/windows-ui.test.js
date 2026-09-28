import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { keys, titleBarPadding, CAPTION_BUTTONS_WIDTH } from '../src/renderer/utils/keys.js'

const require = createRequire(import.meta.url)
const darwin = require('../main/platform/darwin.js')
const win32 = require('../main/platform/win32.js')
const splash = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'splash.html'), 'utf8')

describe('title bar room for the window buttons', () => {
  afterEach(() => { keys.os = 'darwin' })

  it('keeps the Mac padding exactly as written', () => {
    expect(titleBarPadding('0 16px 0 84px', 16)).toBe('0 16px 0 84px')
    expect(titleBarPadding('0 18px 0 96px', 18)).toBe('0 18px 0 96px')
  })

  it('on Windows drops the traffic-light inset and reserves the caption buttons on the right', () => {
    keys.os = 'win32'
    expect(CAPTION_BUTTONS_WIDTH).toBe(140)
    expect(titleBarPadding('0 16px 0 84px', 16)).toBe('0 156px 0 16px')
    expect(titleBarPadding('0 18px 0 96px', 18)).toBe('0 158px 0 18px')
  })
})

describe('setup screen wording by system', () => {
  it('leaves the Mac wording to the splash itself', () => {
    expect(darwin.SETUP_COPY).toEqual({})
  })

  it('every Windows replacement has a place in the splash, and none says Mac', () => {
    const used = new Set([...splash.matchAll(/data-copy="([A-Za-z]+)"/g)].map((m) => m[1]))
    const scriptOnly = ['doubleTapLabel', 'altSpaceLabel']
    for (const key of Object.keys(win32.SETUP_COPY)) {
      if (scriptOnly.includes(key)) expect(splash).toContain(`setupCopy.${key}`)
      else expect(used.has(key), key).toBe(true)
      expect(win32.SETUP_COPY[key]).not.toMatch(/Mac|macOS|System Settings/)
    }
  })
})
