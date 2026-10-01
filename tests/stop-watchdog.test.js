import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const main = fs.readFileSync(path.join(import.meta.dirname, '..', 'main.js'), 'utf8')

describe('stop watchdog', () => {
  // Left running after the recording stopped, it saw the next recording 10 s later and logged a
  // false "Recording did not stop 10 s after the stop shortcut".
  it('is cleared as soon as the recording ends', () => {
    const block = main.match(/if \(appState !== 'RECORDING' && appState !== 'PAUSED'\) \{[\s\S]*?\n    \}/)
    expect(block?.[0]).toContain('clearTimeout(stopWatchdog)')
  })
})
