import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { EventEmitter } from 'events'

const require = createRequire(import.meta.url)
const { createHelper } = require('../main/helper.js')

// A stand-in child process: whatever the test writes to stdout reaches main/helper.js.
function fakeSpawn() {
  const child = new EventEmitter()
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.stdin = { write: () => true, end: () => {}, on: () => {} }
  child.kill = () => {}
  const spawnImpl = () => child
  const say = (msg) => child.stdout.emit('data', JSON.stringify(msg) + '\n')
  return { spawnImpl, say }
}

describe('helper hotkey time (latency log)', () => {
  it('passes the Windows helper\'s t through with the phase', () => {
    const { spawnImpl, say } = fakeSpawn()
    const calls = []
    // Any file that exists: the helper only checks the binary is there before spawning.
    const h = createHelper({ binaryPath: __filename, spawnImpl, onHotkey: (...args) => calls.push(args) })
    expect(h.start()).toBe(true)
    say({ type: 'hotkey', phase: 'down', t: 1234 })
    say({ type: 'hotkey', phase: 'up', t: 1890 })
    expect(calls).toEqual([['down', 1234], ['up', 1890]])
    h.stop()
  })

  it('leaves t undefined for the Swift helper, which sends none', () => {
    const { spawnImpl, say } = fakeSpawn()
    const calls = []
    const h = createHelper({ binaryPath: __filename, spawnImpl, onHotkey: (...args) => calls.push(args) })
    h.start()
    say({ type: 'hotkey', phase: 'down' })
    expect(calls).toEqual([['down', undefined]])
    h.stop()
  })
})
