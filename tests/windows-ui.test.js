import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { keys, titleBarPadding, CAPTION_BUTTONS_WIDTH, panelTopStrip } from '../src/renderer/utils/keys.js'

const require = createRequire(import.meta.url)
const darwin = require('../main/platform/darwin.js')
const win32 = require('../main/platform/win32.js')
const splash = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'splash.html'), 'utf8')

describe('title bar room for the window buttons', () => {
  afterEach(() => { keys.os = 'darwin' })

  it('full-window panels start below the Windows caption buttons (Shortcuts Done at the 760 px minimum)', () => {
    expect(panelTopStrip()).toBe(36)
    keys.os = 'win32'
    expect(panelTopStrip()).toBe(56)
  })

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

describe('destination-aware prompts on Windows', () => {
  const { destinationFor } = require('../main/prompts.js')

  it('matches Windows apps by their .exe, and Mac bundle ids exactly as before', () => {
    expect(destinationFor('C:\\Users\\Zoë\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe').key).toBe('agent')
    expect(destinationFor('C:\\Program Files\\WindowsApps\\Microsoft.WindowsTerminal_1.21\\WindowsTerminal.exe').key).toBe('agent')
    expect(destinationFor('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe').key).toBe('chat')
    expect(destinationFor('C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE').key).toBe('writing')
    expect(destinationFor('C:\\Users\\a\\AppData\\Local\\Figma\\Figma.exe').key).toBe('design')
    expect(destinationFor('C:\\Windows\\notepad.exe')).toBe(null)
    expect(destinationFor('com.microsoft.VSCode').key).toBe('agent')
    expect(destinationFor('com.google.Chrome').key).toBe('chat')
    // A Mac bundle id never goes through the Windows list, and an .exe never matches a bundle id.
    expect(destinationFor('code.exe').key).toBe('agent')
    expect(destinationFor('com.figma.Desktop').key).toBe('design')
  })
})

describe('Windows tray icons are used instead of template images', () => {
  it('only the Mac asks for template images', () => {
    expect(darwin.TRAY_TEMPLATE_ICONS).toBe(true)
    expect(win32.TRAY_TEMPLATE_ICONS).toBe(false)
  })
})

describe('the Harness run command copied for a terminal', () => {
  it('a Mac copies exactly what it did before; Windows gets PowerShell that 5.1 understands', async () => {
    const { commandInFolder } = await import('../src/renderer/utils/promptUtils.js')
    const run = 'bash .harness/run.sh'
    // The Mac string the panel built before this change.
    const before = (savedTo) => `cd ${`'${String(savedTo).replace(/'/g, `'\\''`)}'`} && ${run}`
    for (const dir of ['/Users/a/proj', "/Users/a/it's here", '/Users/a/$HOME `x` "y"']) {
      expect(commandInFolder(dir, run, 'darwin')).toBe(before(dir))
    }
    expect(commandInFolder("C:\\Users\\Zoë O'Neil\\proj", 'powershell -File .harness/run.ps1', 'win32'))
      .toBe("Set-Location -LiteralPath 'C:\\Users\\Zoë O''Neil\\proj'; powershell -File .harness/run.ps1")
  })
})
