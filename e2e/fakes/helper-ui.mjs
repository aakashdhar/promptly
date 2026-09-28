// Fake promptly-helper for ui.spec: VS Code in front with an error selected. Its one argument,
// "trusted" or "untrusted", says whether Accessibility is granted.
import readline from 'readline'

const trusted = process.argv[2] === 'trusted'
const rl = readline.createInterface({ input: process.stdin })
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n')
out({ type: 'ready', trusted, tap: trusted })
rl.on('line', (line) => {
  const m = JSON.parse(line)
  if (m.cmd === 'context') out({ type: 'context', id: m.id, app: { name: 'Visual Studio Code', bundleId: 'com.microsoft.VSCode', pid: 1 }, selectedText: 'TypeError: cannot read properties of undefined' })
  else out({ type: 'status', id: m.id, trusted, tap: trusted })
})
rl.on('close', () => process.exit(0))
