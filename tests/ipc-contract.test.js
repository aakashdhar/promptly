import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Keeps preload.js and the main process in step: every channel the renderer can call
// has a handler, every handler is reachable, and every event main sends is listened for.

const root = path.resolve(import.meta.dirname, '..')
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
const preload = read('preload.js')
const main = read('main.js')

const matches = (src, re) => new Set([...src.matchAll(re)].map((m) => m[1]))

const invoked = matches(preload, /ipcRenderer\.invoke\('([a-z-]+)'/g)
const handled = matches(main, /ipcMain\.handle\('([a-z-]+)'/g)
const listened = matches(preload, /ipcRenderer\.on\('([a-z-]+)'/g)
const sent = new Set([
  ...matches(main, /winSend\('([a-z-]+)'/g),
  ...matches(main, /webContents\.send\('([a-z-]+)'/g),
])

describe('IPC contract', () => {
  it('every channel preload invokes has a main handler', () => {
    expect([...invoked].filter((c) => !handled.has(c))).toEqual([])
  })

  it('every main handler is exposed through preload', () => {
    expect([...handled].filter((c) => !invoked.has(c))).toEqual([])
  })

  it('every event main sends has a preload listener', () => {
    expect([...sent].filter((c) => !listened.has(c))).toEqual([])
  })

  it('every preload listener has something that sends it', () => {
    expect([...listened].filter((c) => !sent.has(c))).toEqual([])
  })

  it('every electronAPI method the renderer calls exists in preload', () => {
    const exposed = matches(preload, /^ {2}([a-zA-Z]+):/gm)
    const files = [
      'splash.html',
      ...fs.readdirSync(path.join(root, 'src/renderer'), { recursive: true })
        .filter((f) => /\.(jsx?|html)$/.test(f))
        .map((f) => path.join('src/renderer', f)),
    ]
    const used = new Set()
    for (const f of files) {
      for (const m of read(f).matchAll(/electronAPI\??\.([a-zA-Z]+)/g)) used.add(m[1])
    }
    expect([...used].filter((m) => !exposed.has(m))).toEqual([])
  })
})
