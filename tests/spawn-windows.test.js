// The whisper engine and the helper start through platform.spawnArgs (WIN-019): on the Mac that is
// the identity, so the call is exactly the one made before; on Windows a .cmd (the e2e fakes) goes
// through cmd.exe. The Windows half swaps in win32's spawnArgs, so it runs on the Mac too.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { createRequire } from 'module'
import { EventEmitter } from 'events'
import fs from 'fs'
import os from 'os'
import path from 'path'

const require = createRequire(import.meta.url)
const platform = require('../main/platform')
const win32 = require('../main/platform/win32.js')
const { createHelper } = require('../main/helper.js')
const { createWhisperRunner, findBundledEngine, bundledArgs, silentWav } = require('../main/whisper.js')

const onMac = process.platform === 'darwin'

let tmp
beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-spawn-')) })
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))
afterEach(() => vi.restoreAllMocks())

function fakeChild() {
  const child = new EventEmitter()
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.stdin = { write: () => true, end: () => {}, on: () => {} }
  child.kill = () => {}
  return child
}

// Records each execFile call and answers it like whisper-cli would.
function fakeExecFile(calls) {
  return (...call) => {
    calls.push(call)
    const done = call.at(-1)
    setImmediate(() => done(null, '[00:00:00.000 --> 00:00:01.000]   hello there', ''))
    return { exitCode: 0, signalCode: null, kill: () => {} }
  }
}

function engineDir(cliName) {
  const dir = fs.mkdtempSync(path.join(tmp, 'engine-'))
  fs.writeFileSync(path.join(dir, cliName), '', { mode: 0o755 })
  fs.writeFileSync(path.join(dir, 'ggml-base.en-q5_1.bin'), 'model')
  return dir
}

describe.runIf(onMac)('spawns on the Mac are unchanged', () => {
  it('starts the helper with exactly (path, [], { stdio })', () => {
    const bin = path.join(tmp, 'promptly-helper')
    fs.writeFileSync(bin, '', { mode: 0o755 })
    const calls = []
    const h = createHelper({ binaryPath: bin, spawnImpl: (...call) => { calls.push(call); return fakeChild() } })
    expect(h.start()).toBe(true)
    expect(calls).toEqual([[bin, [], { stdio: ['pipe', 'pipe', 'pipe'] }]])
    h.stop()
  })

  it('runs the built-in engine with exactly (cli, args, { env, maxBuffer }, callback)', async () => {
    const dir = engineDir('whisper-cli')
    const audio = path.join(tmp, 'mac.wav')
    fs.writeFileSync(audio, silentWav(1))
    const calls = []
    const w = createWhisperRunner({ getBundledDir: () => dir, getWhisperPath: () => null, getFfmpegPath: () => null, execFileImpl: fakeExecFile(calls) })
    expect(await w.transcribe(audio, { timeoutMs: 5000 })).toBe('hello there')
    expect(calls).toHaveLength(1)
    const [file, args, options, callback] = calls[0]
    expect(file).toBe(path.join(dir, 'whisper-cli'))
    expect(args).toEqual(bundledArgs({ model: path.join(dir, 'ggml-base.en-q5_1.bin'), audioFile: audio }))
    expect(options).toEqual({ env: process.env, maxBuffer: 10 * 1024 * 1024 })
    expect(typeof callback).toBe('function')
  })

  it('runs the Python model download with exactly (cmd, args, { stdio, env })', async () => {
    const calls = []
    const w = createWhisperRunner({
      getBundledDir: () => null, getWhisperPath: () => '/usr/local/bin/whisper', getFfmpegPath: () => null,
      spawnImpl: (...call) => { calls.push(call); const c = fakeChild(); setImmediate(() => c.emit('close', 0)); return c },
    })
    expect(await w.downloadModel(() => {})).toEqual({ success: true })
    const [file, args, options] = calls[0]
    expect(calls[0]).toHaveLength(3)
    expect(file).toBe('/usr/local/bin/whisper')
    expect(args).toEqual([os.devNull, '--model', 'base'])
    expect(Object.keys(options)).toEqual(['stdio', 'env'])
    expect(options.stdio).toEqual(['ignore', 'pipe', 'pipe'])
  })
})

describe('a .cmd engine or helper on Windows goes through cmd.exe', () => {
  // Kept before any spy: on a Windows runner `platform` is this same module, so mocking with
  // win32.spawnArgs looked up later would call the spy itself.
  const winSpawnArgs = win32.spawnArgs
  it('starts a .cmd helper through cmd.exe /d /s /c', () => {
    vi.spyOn(platform, 'spawnArgs').mockImplementation(winSpawnArgs)
    const bin = path.join(tmp, 'promptly-helper.cmd')
    fs.writeFileSync(bin, '')
    const calls = []
    const h = createHelper({ binaryPath: bin, spawnImpl: (...call) => { calls.push(call); return fakeChild() } })
    expect(h.start()).toBe(true)
    const [file, args, options] = calls[0]
    expect(file).toMatch(/cmd(\.exe)?$/i)
    expect(args.slice(0, 3)).toEqual(['/d', '/s', '/c'])
    expect(options).toMatchObject({ stdio: ['pipe', 'pipe', 'pipe'], windowsVerbatimArguments: true, windowsHide: true })
    h.stop()
  })

  it('runs a .cmd engine (named by the e2e suite) through cmd.exe, arguments on the command line', async () => {
    vi.spyOn(platform, 'spawnArgs').mockImplementation(winSpawnArgs)
    const dir = engineDir('whisper-cli.cmd')
    const audio = path.join(tmp, 'win.wav')
    fs.writeFileSync(audio, silentWav(1))
    const calls = []
    const w = createWhisperRunner({
      getBundledDir: () => dir, getWhisperPath: () => null, getFfmpegPath: () => null,
      bundledCli: 'whisper-cli.cmd', execFileImpl: fakeExecFile(calls),
    })
    expect(await w.transcribe(audio, { timeoutMs: 5000 })).toBe('hello there')
    const [file, args, options] = calls[0]
    expect(file).toMatch(/cmd(\.exe)?$/i)
    expect(args.slice(0, 3)).toEqual(['/d', '/s', '/c'])
    expect(args[3]).toContain('whisper-cli.cmd')
    expect(args[3]).toContain('--no-prints')
    expect(options).toMatchObject({ env: process.env, maxBuffer: 10 * 1024 * 1024, windowsVerbatimArguments: true })
  })

  it('only the e2e override finds a .cmd engine; the default name is the platform binary', () => {
    const dir = engineDir('whisper-cli.cmd')
    expect(findBundledEngine(dir, win32)).toBe(null)
    expect(findBundledEngine(dir, win32, 'whisper-cli.cmd').cli).toBe(path.join(dir, 'whisper-cli.cmd'))
    const w = createWhisperRunner({ getBundledDir: () => dir, getWhisperPath: () => null, getFfmpegPath: () => null })
    // Without bundledCli the runner looks for this system's engine name, which isn't there.
    expect(w.engine()).toBe(null)
  })
})

describe('stopping a process on Windows ends its whole tree', () => {
  const win32 = require('../main/platform/win32.js')
  const darwin = require('../main/platform/darwin.js')

  it('uses taskkill /T /F on the pid, as an argument array', () => {
    const calls = []
    expect(win32.killTree({ pid: 4321 }, { run: (cmd, args, opts, cb) => { calls.push([cmd, args]); cb(null) } })).toBe(true)
    expect(calls).toEqual([['taskkill', ['/T', '/F', '/PID', '4321']]])
    expect(win32.killTree({}, { run: () => { throw new Error('not called') } })).toBe(false)
  })

  it('leaves the Mac to SIGTERM then SIGKILL, as before', () => {
    expect(darwin.killTree({ pid: 1 })).toBe(false)
  })
})
