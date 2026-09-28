// Fake promptly-helper for app.spec: Accessibility granted, Terminal in front with some text
// selected (none while $FAKE_DIR/no-selection exists). A paste writes what the paste key would
// have pasted, the clipboard at that moment, to $FAKE_DIR/pasted instead of touching a real app.
import { execFileSync } from 'child_process'
import fs from 'fs'
import readline from 'readline'

const rl = readline.createInterface({ input: process.stdin })
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n')
const clipboard = () => process.platform === 'win32'
  ? execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard -Raw'])
  : execFileSync('pbpaste')

out({ type: 'ready', trusted: true, tap: true })
rl.on('line', (line) => {
  const m = JSON.parse(line)
  if (m.cmd === 'context') out({ type: 'context', id: m.id, app: { name: 'Terminal', bundleId: 'com.apple.Terminal', pid: 1 }, selectedText: fs.existsSync(process.env.FAKE_DIR + '/no-selection') ? null : 'TypeError: cannot read properties of undefined' })
  else if (m.cmd === 'paste') {
    fs.writeFileSync(process.env.FAKE_DIR + '/pasted', clipboard())
    out({ type: 'pasted', id: m.id, ok: true })
  }
  else out({ type: 'status', id: m.id, trusted: true, tap: true })
})
rl.on('close', () => process.exit(0))
