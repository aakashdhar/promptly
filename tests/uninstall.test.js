import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createRequire } from 'module'
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Uninstall froze the Mac: the running app deleted its own bundle and live data while the helper's
// system-wide event tap was active, then blocked on a dialog so it never quit
// (vibe/bugs/2026-09-28-uninstall-freezes-mac). The removal must happen after Promptly has exited.

const require = createRequire(import.meta.url)
const ROOT = path.resolve(import.meta.dirname, '..')
const SCRIPT = path.join(ROOT, 'scripts', 'uninstall.sh')

let tmp
let stubs
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-uninstall-'))
  // Stand-ins for the system tools the script calls, so the test never touches the real Mac.
  stubs = path.join(tmp, 'bin')
  fs.mkdirSync(stubs)
  for (const tool of ['tccutil', 'osascript', 'open', 'security']) {
    fs.writeFileSync(path.join(stubs, tool), `#!/bin/bash\necho "$0 $*" >> "${path.join(tmp, 'calls.log')}"\nexit 0\n`, { mode: 0o755 })
  }
})
afterAll(() => {
  // A test makes a folder read-only on purpose; give it back so it can be removed.
  try { fs.chmodSync(path.join(tmp, 'locked', 'Promptly.app'), 0o755) } catch { /* not created */ }
  fs.rmSync(tmp, { recursive: true, force: true })
})

function fakeInstall(name) {
  const dir = path.join(tmp, name)
  const app = path.join(dir, 'Promptly.app')
  const data = path.join(dir, 'Application Support', 'promptly')
  fs.mkdirSync(path.join(app, 'Contents'), { recursive: true })
  fs.writeFileSync(path.join(app, 'Contents', 'Info.plist'), 'x')
  fs.mkdirSync(data, { recursive: true })
  fs.writeFileSync(path.join(data, 'config.json'), '{}')
  return { dir, app, data }
}

function runScript(args) {
  const child = spawn('/bin/bash', [SCRIPT, ...args], {
    env: { ...process.env, PATH: `${stubs}:${process.env.PATH}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const done = new Promise((resolve) => child.on('exit', (code) => resolve(code)))
  return { child, done }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const calls = () => { try { return fs.readFileSync(path.join(tmp, 'calls.log'), 'utf8') } catch { return '' } }

// Mac only: scripts/uninstall.sh and its Finder fallback are macOS; Windows uninstall is
// platform.uninstallLaunch (tests/main.test.js) and a hands-on check in WIN-023.
describe.skipIf(process.platform === 'win32')('uninstall runs after Promptly has quit', () => {
  it('the app only starts a removal command: an argument array with its PID, bundle and data paths', () => {
    const { uninstallCommand } = require('../main/uninstall.js')
    const [cmd, args] = uninstallCommand({
      scriptPath: '/tmp/x/uninstall.sh',
      pid: 4242,
      bundlePath: '/Applications/Promptly.app',
      dataPaths: ['/Users/a/Library/Application Support/promptly', '/Users/a/Library/Logs/promptly'],
    })
    expect(cmd).toBe('/bin/bash')
    expect(args).toEqual([
      '/tmp/x/uninstall.sh', '--yes', '--wait-pid', '4242', '--app', '/Applications/Promptly.app',
      '--data', '/Users/a/Library/Application Support/promptly', '--data', '/Users/a/Library/Logs/promptly',
    ])
  })

  it('leaves the app bundle out when Promptly is not running from an installed copy', () => {
    const { uninstallCommand } = require('../main/uninstall.js')
    const [, args] = uninstallCommand({ scriptPath: '/s.sh', pid: 1, bundlePath: null, dataPaths: [] })
    expect(args).not.toContain('--app')
  })

  it('deletes nothing while Promptly is still running, and everything once it has exited', async () => {
    const { app, data } = fakeInstall('normal')
    const promptly = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'])
    const { done } = runScript(['--yes', '--wait-pid', String(promptly.pid), '--app', app, '--data', data])

    await wait(1500)
    expect(fs.existsSync(app)).toBe(true)
    expect(fs.existsSync(data)).toBe(true)

    promptly.kill()
    expect(await Promise.race([done, wait(15000).then(() => 'timed out')])).toBe(0)
    expect(fs.existsSync(app)).toBe(false)
    expect(fs.existsSync(data)).toBe(false)
    expect(calls()).toMatch(/tccutil reset Microphone io\.betacraft\.promptly/)
    // The Keychain entry that encrypts saved API keys (D-AI-PROVIDERS) goes too. Electron names it
    // after package.json's "name" (lowercase); the capitalised spelling is removed as well.
    expect(calls()).toMatch(/security delete-generic-password -s promptly Safe Storage/)
    expect(calls()).toMatch(/security delete-generic-password -s Promptly Safe Storage/)
  }, 30000)

  it('asks Finder to move the app to the Bin when it cannot be deleted directly', async () => {
    const { app, data } = fakeInstall('locked')
    fs.chmodSync(app, 0o555) // like macOS App Management refusing the delete
    const { done } = runScript(['--yes', '--wait-pid', '999999', '--app', app, '--data', data])
    expect(await Promise.race([done, wait(15000).then(() => 'timed out')])).toBe(0)
    // The path reaches AppleScript as an argument (on run argv), never inside the script text.
    expect(calls()).toMatch(new RegExp(`osascript .*on run argv.* ${app.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`))
  }, 30000)
})
