import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createRequire } from 'module'
import fs from 'fs'
import os from 'os'
import path from 'path'
import zlib from 'zlib'
import crypto from 'crypto'
import { EventEmitter } from 'events'
import * as rendererKeys from '../src/renderer/utils/keys.js'

const require = createRequire(import.meta.url)
const { fillTemplate, buildModePrompt, buildEvalPrompt, normalizeEval, getMode, MODES } = require('../main/prompts.js')
const { createClaudeRunner, parseJsonOutput, classifyError } = require('../main/llm.js')
const { createConfigStore } = require('../main/config.js')
const { createLogger } = require('../main/log.js')
const { resolveFfmpegPath, makeClaudeEnv, terminate } = require('../main/binaries.js')
const darwin = require('../main/platform/darwin.js')
const { spawn } = require('child_process')
const { whisperCommand, parseTqdmLine, findDownloadedModel, makeWhisperEnv, findBundledEngine, cleanTranscript, silentWav, createWhisperRunner } = require('../main/whisper.js')
const { getClaudeStatus, installScript, loginScript, shellQuote, psQuote, INSTALL_COMMAND } = require('../main/claude-setup.js')
const { drawMicIconPng, isTemplateState, drawWinTrayIcons, drawWinTrayIconRgba, WIN_TRAY_SIZES } = require('../main/tray-icon.js')
const { keysFor, formatCombo } = require('../main/keys.js')

let tmp
beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-test-')) })
afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }) })

describe('fillTemplate', () => {
  it('keeps $& and $\' in user text literal', () => {
    const out = fillTemplate('Said: "{TRANSCRIPT}"', { TRANSCRIPT: "it costs $' and $& more" })
    expect(out).toBe('Said: "it costs $\' and $& more"')
  })

  it('never treats inserted text as another placeholder', () => {
    const out = fillTemplate('A={A} B={B}', { A: '{B}', B: 'b' })
    expect(out).toBe('A={B} B=b')
  })

  it('leaves unknown braces alone', () => {
    expect(fillTemplate('{the polished text here} {X}', { X: '1' })).toBe('{the polished text here} 1')
  })
})

describe('mode prompts', () => {
  const transcript = 'build me a todo app'

  it('writes detailed prompts by default, quick ones when asked, with the transcript in tags', () => {
    const out = buildModePrompt(transcript, 'prompt')
    expect(out).toContain(`<transcript>\n${transcript}\n</transcript>`)
    expect(out).toContain('Be thorough.')
    expect(out).toContain('Success criteria:')
    expect(out).toContain('Never open with a generic "You are an expert…" line')
    expect(buildModePrompt(transcript, 'prompt', { detail: 'quick' })).toContain('Keep it tight')
    for (const key of ['prompt', 'code', 'design']) expect(buildModePrompt(transcript, key)).not.toMatch(/\{[A-Z_]+\}/)
  })

  it('keeps retired modes working: Balanced, Detailed, Concise and Chain are Prompt; Refine is Design', () => {
    for (const old of ['balanced', 'detailed', 'concise', 'chain']) expect(getMode(old).key).toBe('prompt')
    expect(getMode('refine').key).toBe('design')
    expect(buildModePrompt(transcript, 'chain')).toBe(buildModePrompt(transcript, 'prompt'))
  })

  it('gives Code a verification section and Design both new-page and change briefs', () => {
    const code = buildModePrompt('the upload retry is broken', 'code')
    expect(code).toContain('Verification:')
    expect(code).toContain('reproduce it first')
    const design = buildModePrompt('make the header smaller', 'design')
    expect(design).toContain('Keep unchanged:')
    expect(design).toContain('one self-contained HTML file')
    expect(design).toContain('Never invent brand colours')
  })

  it('revises a result in its own shape: prompt, polish or email', () => {
    const { buildRevisePrompt } = require('../main/prompts.js')
    expect(buildRevisePrompt({ modeKey: 'prompt', previous: 'Goal:\nA', instruction: 'make it shorter' })).toContain('<prompt>\nGoal:\nA\n</prompt>')
    expect(buildRevisePrompt({ modeKey: 'polish', previous: 'Hi', instruction: 'warmer', tone: 'casual' })).toContain('Tone: Casual')
    const email = buildRevisePrompt({ modeKey: 'email', email: { subject: 'Launch', body: 'Hi team' }, instruction: 'more formal', transcript: 'tell the team', context: { voiceNotes: 'Sign off Cheers' } })
    expect(email).toContain('Subject: Launch')
    expect(email).toContain('<how_i_write>')
    for (const out of [email]) expect(out).not.toMatch(/\{[A-Z_]+\}/)
  })

  it('builds each builder step from its prompt file', () => {
    const { buildBuilderPrompt, BUILDER_STEPS } = require('../main/prompts.js')
    for (const step of Object.keys(BUILDER_STEPS)) expect(buildBuilderPrompt(step, {})).not.toMatch(/\{[A-Z_]+\}/)
    expect(buildBuilderPrompt('video-analyse', { TRANSCRIPT: 'a boat', OPTIONS: '- aspectRatio (one of): "16:9 landscape"' })).toContain('"16:9 landscape"')
    expect(buildBuilderPrompt('nope', {})).toBeNull()
  })

  it('applies the polish tone', () => {
    expect(buildModePrompt(transcript, 'polish', { tone: 'casual' })).toContain('Tone: Casual')
    expect(buildModePrompt(transcript, 'polish')).toContain('Tone: Formal')
  })

  it('falls back to the default mode for unknown keys', () => {
    expect(getMode('nope').key).toBe(MODES.defaultMode)
  })

  it('has a prompt file for every mode that calls Claude', () => {
    for (const mode of MODES.modes) {
      if (mode.kind === 'standalone') expect(() => buildModePrompt('x', mode.key)).not.toThrow()
    }
  })

  it('builds the eval prompt with both inputs, and no example scores to anchor on', () => {
    const out = buildEvalPrompt('raw words', 'Goal: X')
    expect(out).toContain('<a_what_they_said>\nraw words\n</a_what_they_said>')
    expect(out).toContain('<b_the_prompt>\nGoal: X\n</b_the_prompt>')
    expect(out).not.toMatch(/"rawScore":\s*\d/)
    expect(out).toContain('A generic role line')
  })
})

describe('parseJsonOutput', () => {
  it('strips code fences', () => {
    expect(parseJsonOutput('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })
  it('finds the object inside preamble text', () => {
    expect(parseJsonOutput('Here you go:\n{"a":2}\nThanks')).toEqual({ a: 2 })
  })
  it('throws when there is no JSON', () => {
    expect(() => parseJsonOutput('no json here')).toThrow()
  })
})

describe('classifyError', () => {
  it('detects auth failures', () => {
    expect(classifyError('Error: Not authenticated. Run claude login', '')).toBe('auth')
    expect(classifyError('something else', '')).toBe('unknown')
  })
})

// A stand-in `claude` binary whose behaviour is chosen by the FAKE_MODE env var.
function writeFakeClaude(dir) {
  const file = path.join(dir, 'claude')
  fs.writeFileSync(file, `#!/bin/bash
input=$(cat)
case "$FAKE_MODE" in
  echo) printf 'ARGS:%s\\nSTDIN:%s' "$*" "$input" ;;
  old-cli) for a in "$@"; do if [ "$a" = "--tools" ]; then echo "error: unknown option '--tools'" >&2; exit 1; fi; done; printf 'ok-without-lean-flags' ;;
  auth) echo "Invalid API key · Please run /login" >&2; exit 1 ;;
  empty) exit 0 ;;
  slow) sleep 5; echo late ;;
esac
`)
  fs.chmodSync(file, 0o755)
  return file
}

describe('createClaudeRunner', () => {
  let fake
  beforeAll(() => { fake = writeFakeClaude(tmp) })

  function runner(mode, extra = {}) {
    process.env.FAKE_MODE = mode
    return createClaudeRunner({ getClaudePath: () => fake, getModel: () => 'test-model', ...extra })
  }

  it('sends the prompt on stdin, not as an argument, and always passes --model', async () => {
    const r = await runner('echo').run('secret prompt text')
    expect(r.success).toBe(true)
    expect(r.prompt).toContain('STDIN:secret prompt text')
    const args = r.prompt.split('\n')[0]
    expect(args).not.toContain('secret prompt text')
    expect(args).toContain('--model test-model')
    expect(args).toContain('--no-session-persistence')
  })

  it('turns extended thinking off only when asked', async () => {
    const envOf = (opts) => new Promise((resolve) => {
      const claude = createClaudeRunner({
        getClaudePath: () => '/x/claude',
        spawnImpl: (_cmd, _args, { env }) => {
          resolve(env)
          const { EventEmitter } = require('events')
          const child = new EventEmitter()
          child.stdout = new EventEmitter(); child.stderr = new EventEmitter()
          child.stdin = { on() {}, end() {} }
          child.kill = () => {}
          setTimeout(() => child.emit('close', 1))
          return child
        },
      })
      claude.run('hi', opts)
    })
    expect((await envOf({ thinking: false })).MAX_THINKING_TOKENS).toBe('0')
    expect((await envOf({})).MAX_THINKING_TOKENS).toBeUndefined()
  })

  it('keeps a character that arrives split across two chunks', async () => {
    const { PassThrough } = require('stream')
    const { EventEmitter } = require('events')
    const claude = createClaudeRunner({
      getClaudePath: () => '/x/claude',
      spawnImpl: () => {
        const child = new EventEmitter()
        child.stdout = new PassThrough(); child.stderr = new PassThrough()
        child.stdin = { on() {}, end() {} }
        child.kill = () => {}
        const text = Buffer.from('costs ₹500')
        const cut = text.indexOf(Buffer.from('₹')) + 1 // inside the 3-byte ₹
        setTimeout(() => {
          child.stdout.write(text.subarray(0, cut))
          setTimeout(() => { child.stdout.end(text.subarray(cut)); setTimeout(() => child.emit('close', 0), 10) }, 10)
        })
        return child
      },
    })
    const r = await claude.run('hi', { onDelta: undefined })
    expect(r.prompt).toBe('costs ₹500')
  })

  function fakeChild(script) {
    const { PassThrough } = require('stream')
    const { EventEmitter } = require('events')
    return () => {
      const child = new EventEmitter()
      child.stdout = new PassThrough(); child.stderr = new PassThrough()
      child.stdin = { on() {}, end() {} }
      child.kill = () => {}
      setTimeout(() => script(child))
      return child
    }
  }

  it('reads a streamed result that ends without a newline', async () => {
    const claude = createClaudeRunner({
      getClaudePath: () => '/x/claude',
      spawnImpl: fakeChild((c) => { c.stdout.end(JSON.stringify({ type: 'result', result: 'done', is_error: false })); setTimeout(() => c.emit('close', 0), 10) }),
    })
    expect(await claude.run('hi', { onDelta: () => {} })).toEqual({ success: true, prompt: 'done' })
  })

  it('reports a crash as an error, not as a cancel', async () => {
    const claude = createClaudeRunner({
      getClaudePath: () => '/x/claude',
      spawnImpl: fakeChild((c) => c.emit('exit', null, 'SIGSEGV')),
    })
    const r = await claude.run('hi')
    expect(r.cancelled).toBeUndefined()
    expect(r.error).toMatch(/SIGSEGV/)
  })

  it('retries without the lean flags on an older CLI', async () => {
    const r = await runner('old-cli').run('hi')
    expect(r).toEqual({ success: true, prompt: 'ok-without-lean-flags' })
  })

  it('reports auth errors', async () => {
    const r = await runner('auth').run('hi')
    expect(r.success).toBe(false)
    expect(r.errorType).toBe('auth')
    expect(r).not.toHaveProperty('stderr')
  })

  it('reports empty output', async () => {
    const r = await runner('empty').run('hi')
    expect(r.errorType).toBe('empty')
  })

  it('times out and kills the process', async () => {
    const r = await runner('slow').run('hi', { timeoutMs: 300, slowWarningMs: 0 })
    expect(r.timedOut).toBe(true)
    expect(r.errorType).toBe('timeout')
  })

  it('cancels in-flight runs', async () => {
    const children = new Set()
    const claude = runner('slow', { children })
    const pending = claude.run('hi', { timeoutMs: 5000, slowWarningMs: 0 })
    await new Promise((res) => setTimeout(res, 100))
    expect(children.size).toBe(1)
    claude.cancelAll()
    const r = await pending
    expect(r.cancelled).toBe(true)
    expect(children.size).toBe(0)
  })

  it('fires the slow warning', async () => {
    let slow = false
    await runner('slow', { onSlow: () => { slow = true } }).run('hi', { timeoutMs: 400, slowWarningMs: 100 })
    expect(slow).toBe(true)
  })

  it('fails cleanly when the CLI is missing', async () => {
    const r = await createClaudeRunner({ getClaudePath: () => null }).run('hi')
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/not found/)
  })
})

describe('config store', () => {
  it('reads {} when missing or corrupt, and round-trips writes', () => {
    const file = path.join(tmp, 'cfg', 'config.json')
    const store = createConfigStore(file)
    expect(store.read()).toEqual({})
    store.update({ a: 1 })
    store.update({ b: 2 })
    expect(store.read()).toEqual({ a: 1, b: 2 })
    expect(fs.readdirSync(path.dirname(file))).toEqual(['config.json'])
    fs.writeFileSync(file, '{not json')
    expect(store.read()).toEqual({})
  })

  it('sees its own writes and edits made by hand, and hands out copies', () => {
    const file = path.join(tmp, 'cfg-cache', 'config.json')
    const store = createConfigStore(file)
    store.update({ a: { n: 1 } })
    const copy = store.read(); copy.a.n = 99
    expect(store.read()).toEqual({ a: { n: 1 } })
    fs.writeFileSync(file, JSON.stringify({ a: { n: 2 }, edited: true }))
    expect(store.read()).toEqual({ a: { n: 2 }, edited: true })
  })

  it('moves an unreadable file aside instead of writing over it', () => {
    const file = path.join(tmp, 'cfg-corrupt', 'config.json')
    const seen = []
    const store = createConfigStore(file, { onCorrupt: (b) => seen.push(b) })
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, '{"claudePath": "/x/claude",}')
    store.update({ windowBounds: { x: 1 } })
    expect(store.read()).toEqual({ windowBounds: { x: 1 } })
    expect(seen).toHaveLength(1)
    expect(fs.readFileSync(seen[0], 'utf8')).toBe('{"claudePath": "/x/claude",}')
  })
})

describe('logger', () => {
  it('appends timestamped lines and rotates past 1 MB', () => {
    const dir = path.join(tmp, 'logs')
    const log = createLogger(dir)
    log.info('hello', { a: 1 })
    log.error(new Error('boom'))
    const text = fs.readFileSync(log.file, 'utf8')
    expect(text).toMatch(/\[info\] hello {"a":1}/)
    expect(text).toMatch(/\[error\] boom/)
    fs.writeFileSync(log.file, 'x'.repeat(1024 * 1024 + 10))
    log.warn('after rotate')
    expect(fs.existsSync(path.join(dir, 'main.old.log'))).toBe(true)
    expect(fs.readFileSync(log.file, 'utf8')).toMatch(/after rotate/)
  })
})

describe('binaries', () => {
  it('prefers a stored path that exists', async () => {
    const bin = path.join(tmp, 'my-ffmpeg')
    fs.writeFileSync(bin, '')
    expect(await resolveFfmpegPath(bin)).toBe(bin)
  })

  it('adds the binary directory to PATH for the Claude CLI', () => {
    const env = makeClaudeEnv('/some/nvm/bin/claude', { PATH: '/usr/bin' })
    expect(env.PATH.split(':')[0]).toBe('/some/nvm/bin')
    expect(env.PATH.endsWith('/usr/bin')).toBe(true)
  })
})

describe('platform modules', () => {
  const win32 = require('../main/platform/win32.js')

  it('picks the macOS module on a Mac', () => {
    if (process.platform !== 'darwin') return
    expect(require('../main/platform')).toBe(darwin)
  })

  it('darwin and win32 export the same keys, each with the same type', () => {
    expect(Object.keys(win32).sort()).toEqual(Object.keys(darwin).sort())
    for (const key of Object.keys(darwin)) expect([key, typeof win32[key]]).toEqual([key, typeof darwin[key]])
  })

  it('win32 scheduling placeholders answer "nothing here" instead of throwing', async () => {
    expect(win32.PATH_DELIMITER).toBe(';')
    expect(win32.harnessLaunchAgents('C:\\Users\\a')).toEqual([])
    expect(await win32.unloadLaunchAgent('x')).toEqual({ ok: true })
    expect((await win32.loadLaunchAgent('x', 'y')).ok).toBe(false)
  })
})

describe('window, tray and permissions per platform', () => {
  const win32 = require('../main/platform/win32.js')
  const DARK = { dark: true, background: '#1C1C1F' }
  const LIGHT = { dark: false, background: '#F4F4F6' }

  it('macOS keeps the inset traffic lights, whatever the theme', () => {
    const expected = { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 21 } }
    expect(darwin.windowChrome(DARK)).toEqual(expected)
    expect(darwin.windowChrome(LIGHT)).toEqual(expected)
    expect(darwin.TRAY_CLICK_BLURS).toBe(false)
  })

  it('Windows draws caption buttons over the 56 px toolbar in the theme colours', () => {
    expect(win32.windowChrome(DARK)).toEqual({
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: '#1C1C1F', symbolColor: '#ECECF0', height: 56 },
    })
    expect(win32.windowChrome(LIGHT).titleBarOverlay).toEqual({ color: '#F4F4F6', symbolColor: '#1C1C20', height: 56 })
    expect(win32.TRAY_CLICK_BLURS).toBe(true)
  })

  it('nothing macOS-only reaches Windows', () => {
    const src = fs.readFileSync(require.resolve('../main/platform/win32.js'), 'utf8')
    expect(src).not.toMatch(/x-apple\.systempreferences|trafficLightPosition/)
    expect('trafficLightPosition' in win32.windowChrome(DARK)).toBe(false)
    expect(win32.PRIVACY_SETTINGS).toEqual({ accessibility: null, microphone: 'ms-settings:privacy-microphone' })
    expect(win32.UNINSTALL_TEXT.fallback).not.toMatch(/Applications|Bin/)
  })

  it('macOS microphone access prompts only when not yet decided', async () => {
    const make = (first, after) => {
      let asked = false
      return {
        getMediaAccessStatus: () => (asked ? after : first),
        askForMediaAccess: async () => { asked = true },
        get asked() { return asked },
      }
    }
    const fresh = make('not-determined', 'granted')
    expect(await darwin.microphoneAccess(fresh)).toEqual({ granted: true, status: 'granted' })
    expect(fresh.asked).toBe(true)
    const quiet = make('not-determined', 'granted')
    expect(await darwin.microphoneAccess(quiet, { prompt: false })).toEqual({ granted: false, status: 'not-determined' })
    expect(quiet.asked).toBe(false)
    expect(await darwin.microphoneAccess(make('denied'))).toEqual({ granted: false, status: 'denied' })
  })

  it('Windows microphone access is blocked only by the privacy switch', async () => {
    const prefs = (status) => ({ getMediaAccessStatus: () => status })
    expect(await win32.microphoneAccess(prefs('granted'))).toEqual({ granted: true, status: 'granted' })
    expect(await win32.microphoneAccess(prefs('not-determined'))).toEqual({ granted: true, status: 'not-determined' })
    expect(await win32.microphoneAccess(prefs('denied'))).toEqual({ granted: false, status: 'denied' })
  })

  it('macOS uninstall runs a temp copy of uninstall.sh with the same arguments as before', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-uninstall-test-'))
    const source = path.join(tmpDir, 'uninstall.sh')
    fs.writeFileSync(source, '#!/bin/bash\n')
    const { uninstallCommand } = require('../main/uninstall.js')
    const opts = { pid: 42, bundlePath: '/Applications/Promptly.app', dataPaths: ['/d1'] }
    const [cmd, args] = darwin.uninstallLaunch({ source, tmpDir, ...opts })
    const script = path.join(tmpDir, 'promptly-uninstall-42.sh')
    expect([cmd, args]).toEqual(uninstallCommand({ scriptPath: script, ...opts }))
    expect(fs.readFileSync(script, 'utf8')).toBe('#!/bin/bash\n')
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('Windows uninstall hands every path to a hidden PowerShell as its own argument', () => {
    const written = {}
    const installDir = 'C:\\Users\\Zoë Smith\\AppData\\Local\\Programs\\Promptly'
    const data = ['C:\\Users\\Zoë Smith\\AppData\\Roaming\\Promptly', 'C:\\Users\\Zoë Smith\\AppData\\Local\\Promptly']
    const [cmd, args] = win32.uninstallLaunch(
      { source: null, tmpDir: 'C:\\Temp', pid: 7, bundlePath: installDir, dataPaths: data },
      { writeFile: (file, text) => { written[file] = text } },
    )
    const script = 'C:\\Temp\\promptly-uninstall-7.ps1'
    expect(cmd).toBe('powershell.exe')
    expect(args).toEqual(['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', script, '7', installDir, ...data])
    expect(written[script]).toMatch(/Wait-Process -Id \$waitPid/)
    expect(written[script]).toContain("Join-Path $installDir 'Uninstall Promptly.exe'")
    expect(written[script]).toContain("'_?=' + $installDir")
    // Not running from an installed copy: only the data goes.
    const [, devArgs] = win32.uninstallLaunch({ tmpDir: 'C:\\Temp', pid: 7, bundlePath: null, dataPaths: [] }, { writeFile: () => {} })
    expect(devArgs.slice(-2)).toEqual(['7', '-'])
  })
})

describe('starting Claude Code on Windows', () => {
  const win32 = require('../main/platform/win32.js')
  const CMD = 'C:\\Users\\Zoë Smith\\AppData\\Roaming\\npm\\claude.cmd'

  it('macOS runs every binary exactly as asked', () => {
    const opts = { env: { PATH: '/usr/bin' } }
    const [file, args, options] = darwin.spawnArgs('/usr/local/bin/claude', ['-p', '--model', 'x'], opts)
    expect([file, args]).toEqual(['/usr/local/bin/claude', ['-p', '--model', 'x']])
    expect(options).toBe(opts)
    expect(darwin.executableNames('claude')).toEqual(['claude'])
  })

  it('a .exe runs as it is, with no shell', () => {
    const opts = { env: {} }
    expect(win32.spawnArgs('C:\\Users\\a\\.local\\bin\\claude.exe', ['-p'], opts)).toEqual(['C:\\Users\\a\\.local\\bin\\claude.exe', ['-p'], opts])
  })

  it('a .cmd goes through cmd.exe /d /s /c with every piece escaped', () => {
    const [file, args, options] = win32.spawnArgs(CMD, ['-p', '--tools', '', '--system-prompt', "Follow the user's instructions & output"], { env: { A: '1' } })
    expect(file).toMatch(/cmd\.exe$/i)
    expect(args.slice(0, 3)).toEqual(['/d', '/s', '/c'])
    expect(args).toHaveLength(4)
    expect(options).toEqual({ env: { A: '1' }, windowsVerbatimArguments: true, windowsHide: true })
    const line = args[3]
    expect(line.startsWith('"') && line.endsWith('"')).toBe(true)
    // The space in the user name is escaped, not left to split the command.
    expect(line).toContain('C:\\Users\\Zoë^ Smith\\AppData\\Roaming\\npm\\claude.cmd')
    // Each argument is quoted, and its quotes escaped twice for npm's %* launcher.
    expect(line).toContain(' ^^^"-p^^^" ')
    expect(line).toContain(' ^^^"^^^" ') // the empty --tools value survives
    // cmd.exe metacharacters never appear unescaped.
    expect(line).toContain('^^^&')
    expect(line).not.toMatch(/[^^]&/)
  })

  it('.bat and upper-case extensions count too', () => {
    expect(win32.spawnArgs('C:\\x\\CLAUDE.CMD', [], {})[2].windowsVerbatimArguments).toBe(true)
    expect(win32.spawnArgs('C:\\x\\claude.bat', [], {})[2].windowsVerbatimArguments).toBe(true)
  })

  it('in nvm-windows folders, claude.exe is tried before claude.cmd', () => {
    expect(win32.executableNames('claude')).toEqual(['claude.exe', 'claude.cmd'])
  })

  it('the Mac Claude process starts exactly as before, with the prompt on stdin', async () => {
    const calls = []
    let stdin = ''
    const runner = createClaudeRunner({
      getClaudePath: () => '/usr/local/bin/claude',
      spawnImpl: (...call) => {
        calls.push(call)
        const child = new EventEmitter()
        child.stdout = new EventEmitter(); child.stderr = new EventEmitter()
        child.stdin = { on() {}, end: (text) => { stdin = text; setTimeout(() => { child.stdout.emit('data', 'ok'); child.emit('close', 0) }, 5) } }
        return child
      },
    })
    await runner.run('secret prompt text')
    expect(calls[0][0]).toBe('/usr/local/bin/claude')
    expect(Object.keys(calls[0][2])).toEqual(['env'])
    expect(calls[0][1].join(' ')).not.toContain('secret prompt text')
    expect(stdin).toBe('secret prompt text')
  })

  it('a Windows environment keeps its Path key, uses ; and sets USERNAME', () => {
    const env = makeClaudeEnv(CMD, { Path: 'C:\\Windows\\System32;C:\\Windows', APPDATA: 'C:\\x' }, win32)
    expect(env.PATH).toBeUndefined()
    expect(env.Path).toBe('C:\\Users\\Zoë Smith\\AppData\\Roaming\\npm;C:\\Windows\\System32;C:\\Windows')
    expect(env.APPDATA).toBe('C:\\x')
    expect(env.USERNAME).toBeTruthy()
    expect(env.USER).toBeUndefined()
    // A folder already on the Path isn't added twice, and an existing USERNAME is kept.
    const again = makeClaudeEnv(CMD, { Path: 'C:\\Users\\Zoë Smith\\AppData\\Roaming\\npm;C:\\Windows', USERNAME: 'zoe' }, win32)
    expect(again.Path).toBe('C:\\Users\\Zoë Smith\\AppData\\Roaming\\npm;C:\\Windows')
    expect(again.USERNAME).toBe('zoe')
  })

  it('Whisper keeps a Windows Path key instead of adding a second PATH', () => {
    const env = makeWhisperEnv(null, { Path: 'C:\\Windows' }, '/home/x')
    expect(Object.keys(env).filter((k) => k.toUpperCase() === 'PATH')).toEqual(['Path'])
    expect(env.Path.endsWith('C:\\Windows')).toBe(true)
    expect(makeWhisperEnv(null, { PATH: '/usr/bin' }, '/home/x').PATH.endsWith('/usr/bin')).toBe(true)
  })

  it('an empty Windows environment falls back to the system folders', () => {
    const env = makeClaudeEnv(CMD, {}, win32)
    expect(env.PATH.endsWith(win32.DEFAULT_PATH)).toBe(true)
  })
})

describe('key names', () => {
  it('a Mac gets the symbols the app shows today', () => {
    expect(keysFor('darwin')).toEqual({ os: 'darwin', mod: '⌘', alt: '⌥', ctrl: '⌃', shift: '⇧', enter: '↵' })
    expect(formatCombo(['⌘', 'T'], 'darwin')).toBe('⌘T')
    expect(formatCombo(['⌃', '⌘', 'S'], 'darwin')).toBe('⌃⌘S')
    expect(formatCombo(['⌘', '↵'], 'darwin')).toBe('⌘↵')
    // A named key keeps the space the app has always shown before it.
    expect(formatCombo(['⌥', 'Space'], 'darwin')).toBe('⌥ Space')
  })

  it('Windows gets words joined with +', () => {
    expect(keysFor('win32')).toEqual({ os: 'win32', mod: 'Ctrl', alt: 'Alt', ctrl: 'Ctrl', shift: 'Shift', enter: 'Enter' })
    expect(formatCombo(['Ctrl', 'T'], 'win32')).toBe('Ctrl+T')
    expect(formatCombo(['Alt', 'Space'], 'win32')).toBe('Alt+Space')
    // ⌃ and ⌘ are both Ctrl on Windows: named once, not Ctrl+Ctrl+S.
    expect(formatCombo(['Ctrl', 'Ctrl', 'S'], 'win32')).toBe('Ctrl+S')
  })

  it('the renderer, pill and setup screens join keys by the same rule as main', () => {
    for (const os of ['darwin', 'win32']) {
      const k = keysFor(os)
      const saved = { ...rendererKeys.keys }
      Object.assign(rendererKeys.keys, k)
      try {
        for (const parts of [[k.mod, 'T'], [k.alt, 'Space'], [k.ctrl, k.mod, 'S'], [k.mod, k.enter]]) {
          expect(rendererKeys.combo(...parts)).toBe(formatCombo(parts, os))
        }
      } finally { Object.assign(rendererKeys.keys, saved) }
    }
  })

  it('Generate and Hide history listen for the keys their labels name, on both systems', () => {
    const saved = { ...rendererKeys.keys }
    const ev = (key, mods = {}) => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods })
    try {
      // Mac: exactly as before.
      expect(rendererKeys.isGenerateKey(ev('Enter', { metaKey: true }))).toBe(true)
      expect(rendererKeys.isGenerateKey(ev('Enter', { ctrlKey: true }))).toBe(false)
      expect(rendererKeys.isHistoryToggleKey(ev('s', { ctrlKey: true, metaKey: true }))).toBe(true)
      expect(rendererKeys.isHistoryToggleKey(ev('S', { ctrlKey: true, shiftKey: true }))).toBe(false)
      expect(rendererKeys.combo(...rendererKeys.historyToggleKeys())).toBe('⌃⌘S')
      // Windows: Ctrl+Enter and Ctrl+Shift+S; plain Ctrl+S (Save) does nothing.
      Object.assign(rendererKeys.keys, keysFor('win32'))
      expect(rendererKeys.isGenerateKey(ev('Enter', { ctrlKey: true }))).toBe(true)
      expect(rendererKeys.isGenerateKey(ev('Enter', { metaKey: true }))).toBe(false)
      expect(rendererKeys.isHistoryToggleKey(ev('S', { ctrlKey: true, shiftKey: true }))).toBe(true)
      expect(rendererKeys.isHistoryToggleKey(ev('s', { ctrlKey: true }))).toBe(false)
      expect(rendererKeys.combo(...rendererKeys.historyToggleKeys())).toBe('Ctrl+Shift+S')
      expect(rendererKeys.combo(rendererKeys.keys.mod, rendererKeys.keys.enter)).toBe('Ctrl+Enter')
    } finally { Object.assign(rendererKeys.keys, saved) }
  })

  it('no screen names a Mac key directly; they all go through the key names', () => {
    const files = ['pill.html', 'splash.html', ...fs.readdirSync(path.join(import.meta.dirname, '..', 'src/renderer'), { recursive: true })
      .filter((f) => /\.(jsx?|html)$/.test(f) && !f.endsWith('keys.js')).map((f) => path.join('src/renderer', f))]
    const offenders = files.filter((f) => /[⌘⌥⌃]/.test(fs.readFileSync(path.join(import.meta.dirname, '..', f), 'utf8')))
    expect(offenders).toEqual([])
  })

  it('other systems fall back to the Mac set, and callers cannot change the shared one', () => {
    expect(keysFor('linux')).toEqual(keysFor('darwin'))
    keysFor('darwin').mod = 'X'
    expect(keysFor('darwin').mod).toBe('⌘')
  })

  it('the renderer starts with the Mac set, so first paint on a Mac never changes', () => {
    expect({ ...rendererKeys.keys }).toEqual(keysFor('darwin'))
    expect(rendererKeys.combo('⌘', 'H')).toBe('⌘H')
  })

  it('the renderer takes Windows names from get-platform, and keeps the Mac set if the call fails', async () => {
    const saved = { ...rendererKeys.keys }
    try {
      globalThis.window = { electronAPI: { getPlatform: async () => { throw new Error('no handler') } } }
      await rendererKeys.loadKeys()
      expect({ ...rendererKeys.keys }).toEqual(keysFor('darwin'))
      globalThis.window = { electronAPI: { getPlatform: async () => keysFor('win32') } }
      await rendererKeys.loadKeys()
      expect(rendererKeys.keys.mod).toBe('Ctrl')
      expect(rendererKeys.combo(rendererKeys.keys.mod, 'T')).toBe(formatCombo(['Ctrl', 'T'], 'win32'))
    } finally {
      Object.assign(rendererKeys.keys, saved)
      delete globalThis.window
    }
  })
})

describe('finding tools on Windows', () => {
  const win32 = require('../main/platform/win32.js')
  const HOME = 'C:\\Users\\Zoë Smith'
  const ENV = { APPDATA: `${HOME}\\AppData\\Roaming`, LOCALAPPDATA: `${HOME}\\AppData\\Local` }
  // Stands in for execFile('where.exe', …) so the tests run on any system.
  const whereReturns = (stdout, err = null) => (cmd, args, opts, cb) => { expect([cmd, args]).toEqual(['where.exe', ['claude']]); cb(err, stdout) }

  it('looks where the native installer, npm, nvm-windows, Scoop and Chocolatey put Claude Code', () => {
    const c = win32.binaryCandidates('claude', HOME, ENV)
    expect(c).toContain(`${HOME}\\.local\\bin\\claude.exe`)
    expect(c).toContain(`${HOME}\\AppData\\Roaming\\npm\\claude.cmd`)
    expect(c).toContain('C:\\Program Files\\nodejs\\claude.cmd')
    expect(c).toContain(`${HOME}\\scoop\\shims\\claude.exe`)
    expect(c).toContain('C:\\ProgramData\\chocolatey\\bin\\claude.exe')
    // A real .exe is preferred over npm's .cmd launcher.
    expect(c.findIndex((p) => p.endsWith('.exe'))).toBeLessThan(c.findIndex((p) => p.endsWith('.cmd')))
  })

  it('keeps user names with spaces and accents intact', () => {
    for (const name of ['claude', 'whisper', 'ffmpeg']) {
      const c = win32.binaryCandidates(name, HOME, ENV)
      expect(c.length).toBeGreaterThan(0)
      for (const p of c.filter((p) => p.includes('Users'))) expect(p.startsWith(HOME + '\\')).toBe(true)
    }
    expect(win32.uninstallDataPaths(HOME, 'io.betacraft.promptly', ENV)).toEqual([
      `${HOME}\\AppData\\Roaming\\Promptly`, `${HOME}\\AppData\\Local\\Promptly`,
    ])
  })

  it('works out the per-user folders from the profile when the environment lacks them', () => {
    expect(win32.binaryCandidates('claude', HOME, {})).toContain(`${HOME}\\AppData\\Roaming\\npm\\claude.cmd`)
  })

  it('finds Whisper and ffmpeg as .exe files', () => {
    expect(win32.binaryCandidates('whisper', HOME, ENV)).toContain(`${HOME}\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\whisper.exe`)
    expect(win32.binaryCandidates('ffmpeg', HOME, ENV)).toContain(`${HOME}\\scoop\\shims\\ffmpeg.exe`)
    expect(win32.binaryCandidates('something-else', HOME, ENV)).toEqual([])
  })

  it('where.exe: several CRLF lines resolve to the first file that exists', async () => {
    const stdout = 'C:\\gone\\claude.exe\r\nC:\\Users\\Zoë Smith\\AppData\\Roaming\\npm\\claude.cmd\r\nC:\\other\\claude.cmd\r\n'
    const fileExists = (p) => !p.startsWith('C:\\gone')
    expect(await win32.shellWhich('claude', { run: whereReturns(stdout), fileExists }))
      .toBe('C:\\Users\\Zoë Smith\\AppData\\Roaming\\npm\\claude.cmd')
  })

  it('where.exe: nothing found, or only a WSL copy, means not found', async () => {
    expect(await win32.shellWhich('claude', { run: whereReturns('', new Error('INFO: Could not find files')), fileExists: () => true })).toBe(null)
    expect(await win32.shellWhich('claude', { run: whereReturns('\\\\wsl$\\Ubuntu\\usr\\bin\\claude\r\n'), fileExists: () => true })).toBe(null)
    expect(await win32.shellWhich('claude', { run: whereReturns('\\\\wsl.localhost\\Ubuntu\\bin\\claude\r\n'), fileExists: () => true })).toBe(null)
  })

  it('nvm-windows versions are listed from NVM_HOME', () => {
    const readdir = (dir) => { expect(dir).toBe('D:\\nvm'); return ['v20.19.0', 'v22.12.0', 'settings.txt'] }
    expect(win32.nodeVersionBinDirs(HOME, readdir, { NVM_HOME: 'D:\\nvm' })).toEqual(['D:\\nvm\\v20.19.0', 'D:\\nvm\\v22.12.0'])
    expect(win32.nodeVersionBinDirs(HOME, () => { throw new Error('ENOENT') }, ENV)).toEqual([])
  })

  it('the install folder is where Promptly runs from, but only when its uninstaller is there', () => {
    const exe = `${HOME}\\AppData\\Local\\Programs\\Promptly\\Promptly.exe`
    const dir = `${HOME}\\AppData\\Local\\Programs\\Promptly`
    expect(win32.appBundlePath(exe, { fileExists: (p) => p === `${dir}\\Uninstall Promptly.exe` })).toBe(dir)
    expect(win32.appBundlePath('C:\\dev\\node_modules\\electron\\electron.exe', { fileExists: () => false })).toBe(null)
  })

  it('removing the app runs its uninstaller silently, as an argument array', async () => {
    const calls = []
    const run = (cmd, args, opts, cb) => { calls.push([cmd, args]); cb(null) }
    expect(await win32.removeInstalledApp('C:\\Program Files\\Promptly', { run })).toEqual({ ok: true })
    expect(calls).toEqual([['C:\\Program Files\\Promptly\\Uninstall Promptly.exe', ['/S']]])
    expect((await win32.removeInstalledApp(null, { run })).ok).toBe(false)
    expect(await win32.resetMicrophonePermission()).toEqual({ ok: true })
  })
})

describe('whisper helpers', () => {
  it('builds commands for a binary and for python -m whisper', () => {
    expect(whisperCommand('/bin/whisper', ['a'])).toEqual(['/bin/whisper', ['a']])
    expect(whisperCommand('python3 -m whisper', ['a'])).toEqual(['python3', ['-m', 'whisper', 'a']])
  })

  it('parses tqdm progress lines', () => {
    const p = parseTqdmLine(' 42%|████      | 60.5M/139M [00:10<00:13, 5.8MiB/s]')
    expect(p).toEqual({ percent: 42, mbDone: 60.5, mbTotal: 139, secondsLeft: 13 })
    expect(parseTqdmLine('Detecting language')).toBeNull()
  })

  it('finds a downloaded model over 100 MB only', () => {
    const home = path.join(tmp, 'home')
    const dir = path.join(home, '.cache', 'whisper')
    fs.mkdirSync(dir, { recursive: true })
    const model = path.join(dir, 'base.pt')
    fs.writeFileSync(model, '')
    expect(findDownloadedModel(home)).toBeNull()
    fs.truncateSync(model, 101 * 1024 * 1024)
    expect(findDownloadedModel(home)).toEqual({ path: model, sizeMB: 101 })
  })

  it('adds the ffmpeg dir and SSL bundle to the Whisper env', () => {
    const env = makeWhisperEnv('/custom/bin/ffmpeg', { PATH: '/usr/bin' }, '/Users/x')
    expect(env.PATH.split(':')).toContain('/custom/bin')
    expect(env.SSL_CERT_FILE).toBe('/etc/ssl/cert.pem')
  })
})

describe('tray icon', () => {
  it('draws a PNG for every state', () => {
    for (const state of ['idle', 'hidden', 'recording', 'thinking', 'ready', 'builder']) {
      const png = drawMicIconPng(state, true)
      expect(png.subarray(1, 4).toString()).toBe('PNG')
    }
    expect(isTemplateState('idle')).toBe(true)
    expect(isTemplateState('recording')).toBe(false)
  })

  // Header + inflated pixels, so a zlib version change can't fail it but any pixel change does.
  function pngPixels(png) {
    const parts = []
    for (let off = 8; off < png.length;) {
      const len = png.readUInt32BE(off)
      const type = png.toString('ascii', off + 4, off + 8)
      if (type === 'IHDR') parts.push(png.subarray(off + 8, off + 8 + len))
      if (type === 'IDAT') parts.push(zlib.inflateSync(png.subarray(off + 8, off + 8 + len)))
      off += 12 + len
    }
    return Buffer.concat(parts)
  }

  it('keeps the Mac menu bar icons pixel for pixel', () => {
    const hash = crypto.createHash('sha256')
    for (const state of ['idle', 'hidden', 'recording', 'thinking', 'ready', 'builder'])
      for (const isDark of [false, true])
        for (const showDot of [true, false]) hash.update(pngPixels(drawMicIconPng(state, isDark, showDot)))
    expect(hash.digest('hex')).toBe('c32bb911dd02641f5130e6b76563011980af73cb0e3243fbd4d19c70e7fdfa07')
  })

  it('draws Windows tray icons in colour at 16 and 32 px, never as template images', () => {
    expect(WIN_TRAY_SIZES).toEqual([16, 32])
    for (const state of ['idle', 'hidden', 'recording', 'thinking', 'ready', 'builder']) {
      for (const showDot of [true, false]) {
        const icon = drawWinTrayIcons(state, showDot)
        expect(icon.template).toBe(false)
        expect(icon.representations.map((r) => [r.scaleFactor, r.buffer.readUInt32BE(16), r.buffer.readUInt32BE(20)]))
          .toEqual([[1, 16, 16], [2, 32, 32]])
      }
    }
  })

  it('gives each Windows state its own colour, readable on light and dark taskbars', () => {
    const centre = (state, showDot = true) => {
      // A disc pixel left of the mic: the state colour.
      const px = drawWinTrayIconRgba(state, 32, showDot)
      const i = (16 * 32 + 5) * 4
      return [px[i], px[i + 1], px[i + 2], px[i + 3]]
    }
    const colours = ['idle', 'recording', 'thinking', 'ready'].map((s) => centre(s).join())
    expect(new Set(colours).size).toBe(4)
    // The pulse's off phase falls back to idle.
    expect(centre('recording', false)).toEqual(centre('idle'))
    // Every icon has a dark part (seen on a light taskbar) and a light part (seen on a dark one).
    const luma = (px, i) => 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]
    for (const state of ['idle', 'hidden', 'recording', 'thinking', 'ready']) {
      const px = drawWinTrayIconRgba(state, 16)
      let min = 255, max = 0
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 200) continue
        min = Math.min(min, luma(px, i)); max = Math.max(max, luma(px, i))
      }
      expect(max - min).toBeGreaterThan(60)
    }
  })

  it('build/icon.ico holds every Windows size from 16 to 256 px', () => {
    const { ICO_SIZES } = require('../scripts/generate-icon.js')
    const ico = fs.readFileSync(path.join(import.meta.dirname, '..', 'build', 'icon.ico'))
    expect(ico.readUInt16LE(2)).toBe(1)
    const count = ico.readUInt16LE(4)
    const sizes = []
    for (let k = 0; k < count; k++) {
      const e = 6 + 16 * k
      const size = ico[e] || 256
      const data = ico.subarray(ico.readUInt32LE(e + 12), ico.readUInt32LE(e + 12) + ico.readUInt32LE(e + 8))
      if (size === 256) expect(data.subarray(1, 4).toString()).toBe('PNG')
      else expect([data.readUInt32LE(0), data.readInt32LE(4), data.readUInt16LE(14)]).toEqual([40, size, 32])
      sizes.push(size)
    }
    expect(sizes).toEqual(ICO_SIZES)
    expect(sizes).toEqual(expect.arrayContaining([16, 32, 48, 256]))
  })
})

describe('built-in speech engine', () => {
  let dir
  beforeAll(() => {
    dir = path.join(tmp, 'engine')
    fs.mkdirSync(dir, { recursive: true })
    // Fake whisper-cli: prints its args, and fails unless the input is a WAV (RIFF header).
    fs.writeFileSync(path.join(dir, 'whisper-cli'), `#!/bin/bash
f=""; prev=""
for a in "$@"; do [ "$prev" = "-f" ] && f="$a"; prev="$a"; done
[ "$(head -c 4 "$f")" = "RIFF" ] || { echo "not a wav" >&2; exit 1; }
echo " [BLANK_AUDIO] hello   from the engine "
echo "ARGS $*" >&2
`, { mode: 0o755 })
    fs.writeFileSync(path.join(dir, 'ggml-base.en-q5_1.bin'), 'model')
  })

  it('is found only when both the binary and model exist', () => {
    expect(findBundledEngine(dir)).toEqual({ cli: path.join(dir, 'whisper-cli'), model: path.join(dir, 'ggml-base.en-q5_1.bin') })
    expect(findBundledEngine(path.join(tmp, 'nope'))).toBeNull()
    expect(findBundledEngine(null)).toBeNull()
  })

  it('cleans non-speech markers and whitespace', () => {
    expect(cleanTranscript(' [BLANK_AUDIO]\n hello   world \n')).toBe('hello world')
    expect(cleanTranscript('[MUSIC]\n(wind blowing)')).toBe('')
  })

  it('writes a valid 16 kHz mono WAV of silence', () => {
    const wav = silentWav(1)
    expect(wav.subarray(0, 4).toString()).toBe('RIFF')
    expect(wav.readUInt32LE(24)).toBe(16000)
    expect(wav.length).toBe(44 + 32000)
  })

  it('prefers the built-in engine and uses the CPU until warmed up', async () => {
    const w = createWhisperRunner({ getBundledDir: () => dir, getWhisperPath: () => '/should/not/be/used', getFfmpegPath: () => null })
    expect(w.engine().type).toBe('bundled')
    const audio = path.join(tmp, 'in.wav')
    fs.writeFileSync(audio, silentWav(1))
    expect(await w.transcribe(audio, { timeoutMs: 5000 })).toBe('hello from the engine')
    expect(w.isGpuReady()).toBe(false)
    expect(await w.warmUp(path.join(tmp, 'warm'))).toBe(true)
    expect(w.isGpuReady()).toBe(true)
  })

  it('reports a clear error for audio it cannot read', async () => {
    const w = createWhisperRunner({ getBundledDir: () => dir, getWhisperPath: () => null, getFfmpegPath: () => null })
    const bad = path.join(tmp, 'in.webm')
    fs.writeFileSync(bad, 'webm bytes')
    await expect(w.transcribe(bad, { timeoutMs: 5000 })).rejects.toThrow(/not a wav/)
  })

  it('falls back to Python Whisper when the built-in engine is missing', () => {
    const w = createWhisperRunner({ getBundledDir: () => null, getWhisperPath: () => '/usr/local/bin/whisper', getFfmpegPath: () => null })
    expect(w.engine()).toEqual({ type: 'python', whisperPath: '/usr/local/bin/whisper' })
    const none = createWhisperRunner({ getBundledDir: () => null, getWhisperPath: () => null, getFfmpegPath: () => null })
    expect(none.engine()).toBeNull()
  })
})

describe('Claude Code setup', () => {
  function fakeClaude(name, body) {
    const file = path.join(tmp, name)
    fs.writeFileSync(file, `#!/bin/bash\n${body}\n`, { mode: 0o755 })
    return file
  }

  it('reports installed and signed in', async () => {
    const bin = fakeClaude('claude-ok', 'case "$1" in --version) echo "2.1.0 (Claude Code)";; auth) echo \'{"loggedIn": true}\';; esac')
    expect(await getClaudeStatus(bin)).toEqual({ installed: true, path: bin, version: '2.1.0 (Claude Code)', loggedIn: true })
  })

  it('reports signed out', async () => {
    const bin = fakeClaude('claude-out', 'case "$1" in --version) echo "2.1.0";; auth) echo \'{"loggedIn": false}\';; esac')
    expect((await getClaudeStatus(bin)).loggedIn).toBe(false)
  })

  it('returns loggedIn null for CLIs without auth status', async () => {
    const bin = fakeClaude('claude-old', 'case "$1" in --version) echo "1.0.0";; *) echo "unknown command" >&2; exit 1;; esac')
    expect(await getClaudeStatus(bin)).toMatchObject({ installed: true, loggedIn: null })
  })

  it('reports not installed for a missing or broken binary', async () => {
    expect(await getClaudeStatus(null)).toMatchObject({ installed: false })
    expect(await getClaudeStatus(path.join(tmp, 'missing-claude'))).toMatchObject({ installed: false })
  })

  it('writes Terminal scripts with the official installer and a safely quoted path', () => {
    const install = fs.readFileSync(installScript(path.join(tmp, 'scripts')), 'utf8')
    expect(install).toContain(INSTALL_COMMAND)
    expect(INSTALL_COMMAND).toBe('curl -fsSL https://claude.ai/install.sh | bash')
    const login = fs.readFileSync(loginScript(path.join(tmp, 'scripts'), "/Users/a b/it's/claude"), 'utf8')
    expect(login).toContain(`${shellQuote("/Users/a b/it's/claude")} auth login`)
    expect(shellQuote("it's")).toBe(`'it'\\''s'`)
  })

  it('sets USER so Claude Code can read its login from the keychain', () => {
    const env = makeClaudeEnv('/x/claude', { PATH: '/usr/bin' })
    expect(env.USER).toBe(os.userInfo().username)
    expect(makeClaudeEnv('/x/claude', { PATH: '/usr/bin', USER: 'someone' }).USER).toBe('someone')
  })
})

describe('Claude Code setup on Windows', () => {
  const win32 = require('../main/platform/win32.js')
  const dir = () => path.join(tmp, 'win-scripts')

  it('the Mac install and sign-in scripts are exactly what they were', () => {
    expect(fs.readFileSync(installScript(path.join(tmp, 'mac-scripts')), 'utf8')).toBe([
      '#!/bin/bash', 'clear',
      'echo "Installing Claude Code for Promptly…"', 'echo',
      'echo "$ curl -fsSL https://claude.ai/install.sh | bash"', 'curl -fsSL https://claude.ai/install.sh | bash',
      'echo', 'echo "You can close this window and go back to Promptly — it will notice on its own."', '',
    ].join('\n'))
    expect(fs.readFileSync(loginScript(path.join(tmp, 'mac-scripts'), '/Users/a/.local/bin/claude'), 'utf8')).toBe([
      '#!/bin/bash', 'clear',
      'echo "Signing in to Claude Code for Promptly. Your browser will open to finish signing in."', 'echo',
      "'/Users/a/.local/bin/claude' auth login",
      'echo', 'echo "You can close this window and go back to Promptly — it will notice on its own."', '',
    ].join('\n'))
  })

  it('the Windows install script is a UTF-8 .ps1 with the official PowerShell installer', () => {
    const file = installScript(dir(), win32)
    expect(file.endsWith('Install Claude Code.ps1')).toBe(true)
    const body = fs.readFileSync(file, 'utf8')
    expect(body.startsWith('\ufeff')).toBe(true)
    expect(body.split('\r\n')).toContain('irm https://claude.ai/install.ps1 | iex')
    expect(win32.INSTALL_COMMAND).toBe('irm https://claude.ai/install.ps1 | iex')
    expect(body).toContain('go back to Promptly')
  })

  it('the Windows sign-in script calls the claude path quoted for PowerShell', () => {
    const claude = "C:\\Users\\Zoë O'Neil\\AppData\\Roaming\\npm\\claude.cmd"
    const body = fs.readFileSync(loginScript(dir(), claude, win32), 'utf8')
    expect(body.split('\r\n')).toContain(`& 'C:\\Users\\Zoë O''Neil\\AppData\\Roaming\\npm\\claude.cmd' auth login`)
    expect(psQuote("it's")).toBe("'it''s'")
  })

  it('PowerShell runs the script as a file in its own window, never a command string', async () => {
    const calls = []
    const run = (cmd, args, opts) => {
      calls.push([cmd, args, opts])
      const child = new EventEmitter(); child.unref = () => { child.unrefed = true }
      setTimeout(() => child.emit('spawn'), 1)
      return child
    }
    expect(await win32.openSetupScript('C:\\x\\Install Claude Code.ps1', { run })).toBe('')
    expect(calls).toEqual([['powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit', '-File', 'C:\\x\\Install Claude Code.ps1'],
      { detached: true, stdio: 'ignore', windowsHide: false }]])
    const failing = () => { const c = new EventEmitter(); setTimeout(() => c.emit('error', new Error('spawn powershell.exe ENOENT')), 1); return c }
    expect(await win32.openSetupScript('C:\\x\\a.ps1', { run: failing })).toMatch(/ENOENT/)
  })

  it('the Mac opens its script with the system opener, as before', async () => {
    const opened = []
    expect(await darwin.openSetupScript('/tmp/x.command', { openPath: async (f) => { opened.push(f); return '' } })).toBe('')
    expect(opened).toEqual(['/tmp/x.command'])
    expect(await darwin.checkPrerequisites()).toEqual({ gitMissing: false })
    expect(await darwin.blockedBinaries([{ file: '/x', args: [] }])).toEqual([])
  })

  it('a missing Git for Windows is reported, not a crash', async () => {
    expect(await win32.checkPrerequisites({ which: async () => null })).toEqual({ gitMissing: true })
    expect(await win32.checkPrerequisites({ which: async () => 'C:\\Program Files\\Git\\cmd\\git.exe' })).toEqual({ gitMissing: false })
  })

  it('names a speech engine or helper the antivirus stopped from starting', async () => {
    const errorFor = { 'whisper-cli.exe': Object.assign(new Error('spawn EACCES'), { code: 'EACCES' }), 'promptly-helper.exe': null }
    const run = (file, args, opts, cb) => cb(errorFor[path.win32.basename(file)])
    const checks = [{ file: 'C:\\P\\whisper\\whisper-cli.exe', args: ['--help'] }, { file: 'C:\\P\\helper\\promptly-helper.exe', args: ['--version'] }]
    expect(await win32.blockedBinaries(checks, { run, fileExists: () => true })).toEqual(['whisper-cli.exe'])
    // Running and exiting with an error number means it isn't blocked; a timeout isn't either; a missing file is skipped.
    const exits = (file, args, opts, cb) => cb(Object.assign(new Error('exit'), { code: 1 }))
    expect(await win32.blockedBinaries(checks, { run: exits, fileExists: () => true })).toEqual([])
    const slow = (file, args, opts, cb) => cb(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT', killed: true }))
    expect(await win32.blockedBinaries(checks, { run: slow, fileExists: () => true })).toEqual([])
    expect(await win32.blockedBinaries(checks, { run, fileExists: () => false })).toEqual([])
  })
})

describe('recording shortcut', () => {
  const { registerRecordingShortcut } = require('../main/shortcuts.js')
  function fakeShortcuts(taken) {
    const registered = []
    return { registered, register: (acc) => { if (taken.includes(acc)) return false; registered.push(acc); return true } }
  }

  it('uses Option+Space when it is free, without a notification', () => {
    const gs = fakeShortcuts([])
    const notes = []
    expect(registerRecordingShortcut({ globalShortcut: gs, primary: 'Alt+Space', fallback: 'Control+`', onTrigger: () => {}, notify: (m) => notes.push(m) })).toBe('Alt+Space')
    expect(notes).toEqual([])
  })

  it('falls back and tells the user when another app owns Option+Space', () => {
    const gs = fakeShortcuts(['Alt+Space'])
    const notes = []
    expect(registerRecordingShortcut({ globalShortcut: gs, primary: 'Alt+Space', fallback: 'Control+`', onTrigger: () => {}, notify: (m) => notes.push(m) })).toBe('Control+`')
    expect(gs.registered).toEqual(['Control+`'])
    expect(notes).toEqual(['Option+Space is used by another app, so Promptly is listening on Control+` instead.'])
  })

  it('says so when neither key is available', () => {
    const gs = fakeShortcuts(['Alt+Space', 'Control+`'])
    const notes = []
    expect(registerRecordingShortcut({ globalShortcut: gs, primary: 'Alt+Space', fallback: 'Control+`', onTrigger: () => {}, notify: (m) => notes.push(m) })).toBeNull()
    expect(notes[0]).toMatch(/could not register a recording shortcut/)
  })
})

describe('hold to talk', () => {
  const { createHoldToTalk, getPreset, HOTKEY_PRESETS } = require('../main/hotkey.js')
  function setup() {
    let t = 0
    let recording = false
    const events = []
    const h = createHoldToTalk({
      isRecording: () => recording,
      onStart: () => { events.push('start'); recording = true },
      onStop: () => { events.push('stop'); recording = false },
      onCancel: () => { events.push('cancel'); recording = false },
      now: () => t,
    })
    return { h, events, advance: (ms) => { t += ms } }
  }

  it('records while held and stops on release', () => {
    const { h, events, advance } = setup()
    h.down(); advance(1200); h.up()
    expect(events).toEqual(['start', 'stop'])
  })

  it('treats a quick tap as start, and the next press as stop', () => {
    const { h, events, advance } = setup()
    h.down(); advance(120); h.up()
    expect(events).toEqual(['start'])
    advance(3000); h.down(); advance(100); h.up()
    expect(events).toEqual(['start', 'stop'])
  })

  it('cancels when a modifier-only key was part of another shortcut', () => {
    const { h, events } = setup()
    h.down(); h.cancel()
    expect(events).toEqual(['start', 'cancel'])
  })

  it('has presets, falling back to the default (double-tap Control)', () => {
    expect(getPreset('nope')).toBe(HOTKEY_PRESETS['double-control'])
    expect(HOTKEY_PRESETS.fn.accelerator).toBeNull()
    expect(HOTKEY_PRESETS['right-option'].helper).toEqual({ keyCode: 61, modifiers: [], modifierOnly: true })
  })
})

describe('helper process', () => {
  const { createHelper } = require('../main/helper.js')
  let fake
  beforeAll(() => {
    fake = path.join(tmp, 'fake-helper')
    fs.writeFileSync(fake, `#!/usr/bin/env node
const rl = require('readline').createInterface({ input: process.stdin })
const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n')
out({ type: 'ready', trusted: true, tap: true })
rl.on('line', (line) => {
  const m = JSON.parse(line)
  if (m.cmd === 'context') out({ type: 'context', id: m.id, app: { name: 'Terminal', bundleId: 'com.apple.Terminal' }, selectedText: 'npm ERR! missing script' })
  else if (m.cmd === 'status' || m.cmd === 'configure') { out({ type: 'status', id: m.id, trusted: true, tap: true }); if (m.cmd === 'configure') out({ type: 'hotkey', phase: 'down' }) }
})
rl.on('close', () => process.exit(0))
`, { mode: 0o755 })
  })

  it('reports status, answers context requests and forwards hotkey events', async () => {
    const statuses = []
    const phases = []
    const h = createHelper({ binaryPath: fake, onStatus: (s) => statuses.push(s), onHotkey: (p) => phases.push(p) })
    expect(h.start()).toBe(true)
    await expect.poll(() => statuses.length).toBe(1)
    expect(h.status()).toEqual({ trusted: true, tap: true })
    const ctx = await h.context()
    expect(ctx).toMatchObject({ app: { bundleId: 'com.apple.Terminal' }, selectedText: 'npm ERR! missing script' })
    await h.configure({ keyCode: 49, modifiers: ['option'] })
    await expect.poll(() => phases).toEqual(['down'])
    h.stop()
  })

  it('resolves null when there is no helper binary', async () => {
    const h = createHelper({ binaryPath: path.join(tmp, 'no-helper') })
    h.start()
    expect(await h.context()).toBeNull()
    h.stop()
  })
})

describe('destination and selection context', () => {
  const { destinationFor, buildContextBlock } = require('../main/prompts.js')

  it('maps apps to destinations', () => {
    expect(destinationFor('com.apple.Terminal').key).toBe('agent')
    expect(destinationFor('com.todesktop.230313mzl4w4u92').key).toBe('agent') // Cursor
    expect(destinationFor('com.microsoft.VSCode').key).toBe('agent')
    expect(destinationFor('com.google.Chrome').key).toBe('chat')
    expect(destinationFor('com.anthropic.claudefordesktop').key).toBe('chat')
    expect(destinationFor('com.figma.Desktop').key).toBe('design')
    expect(destinationFor('com.apple.finder')).toBeNull()
  })

  it('adds destination guidance to Prompt, Code and Design only', () => {
    const prompt = buildModePrompt('fix the flaky test', 'prompt', { context: { bundleId: 'com.apple.Terminal', appName: 'Terminal' } })
    expect(prompt).toContain('AI coding agent')
    expect(prompt.indexOf('AI coding agent')).toBeLessThan(prompt.indexOf('<transcript>'))
    expect(buildModePrompt('x', 'design', { context: { bundleId: 'com.apple.Terminal' } })).toContain('AI coding agent')
    expect(buildModePrompt('x', 'polish', { context: { bundleId: 'com.apple.Terminal' } })).not.toContain('AI coding agent')
  })

  it('includes selected text and dictionary words, and nothing when there is no context', () => {
    const prompt = buildModePrompt('tighten this', 'polish', { context: { selectedText: 'We are going to be doing a launch', appName: 'Notes', dictionary: ['Promptly'] } })
    expect(prompt).toContain('<selected_text>\nWe are going to be doing a launch\n</selected_text>')
    expect(prompt).toContain('selected this text in Notes')
    expect(prompt).toContain('Spell these names and terms exactly as written: Promptly.')
    expect(buildContextBlock({ kind: 'standalone', destination: true }, {})).toBe('')
    expect(buildModePrompt('x', 'prompt')).toBe(buildModePrompt('x', 'prompt', { context: {} }))
  })
})

describe('streaming', () => {
  const { createStreamParser } = require('../main/llm.js')

  it('collects text deltas and the final result', () => {
    const seen = []
    const p = createStreamParser((t) => seen.push(t))
    const ev = (o) => JSON.stringify(o) + '\n'
    p.feed(ev({ type: 'system' }) + ev({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Role:' } } }).slice(0, 20))
    p.feed(ev({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Role:' } } }).slice(20))
    p.feed(ev({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: ' You are' } } }))
    p.feed(ev({ type: 'result', is_error: false, result: 'Role: You are' }))
    expect(seen).toEqual(['Role:', 'Role: You are'])
    expect(p.result().result).toBe('Role: You are')
  })

  it('streams through the runner and falls back on CLIs without stream flags', async () => {
    const bin = path.join(tmp, 'claude-stream')
    fs.writeFileSync(bin, `#!/bin/bash
cat > /dev/null
if [[ " $* " == *" stream-json "* ]]; then
  echo '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}}'
  echo '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":" there"}}}'
  echo '{"type":"result","is_error":false,"result":"Hello there"}'
else
  echo "Hello there"
fi
`, { mode: 0o755 })
    const deltas = []
    const r = await createClaudeRunner({ getClaudePath: () => bin }).run('hi', { onDelta: (t) => deltas.push(t) })
    expect(r).toEqual({ success: true, prompt: 'Hello there' })
    expect(deltas).toEqual(['Hello', 'Hello there'])
  })

  it('reports errors from the result event', async () => {
    const bin = path.join(tmp, 'claude-stream-err')
    fs.writeFileSync(bin, `#!/bin/bash\ncat > /dev/null\necho '{"type":"result","is_error":true,"result":"Not logged in · Please run /login"}'\nexit 1\n`, { mode: 0o755 })
    const r = await createClaudeRunner({ getClaudePath: () => bin }).run('hi', { onDelta: () => {} })
    expect(r).toMatchObject({ success: false, errorType: 'auth' })
  })
})

describe('It writes like you', () => {
  const { createEditLog, profileFor, isMeaningfulEdit, formatEdits } = require('../main/profile.js')
  const { buildLearnStylePrompt } = require('../main/prompts.js')

  it('uses "How you write" for Polish and Email, "About you" for prompts, nothing for builders', () => {
    const notes = { voiceNotes: '- Short sentences', aboutMe: 'PM at a fintech' }
    expect(profileFor(getMode('polish'), notes)).toEqual({ voiceNotes: '- Short sentences' })
    expect(profileFor(getMode('email'), notes)).toEqual({ voiceNotes: '- Short sentences' })
    expect(profileFor(getMode('balanced'), notes)).toEqual({ aboutMe: 'PM at a fintech' })
    expect(profileFor(getMode('design'), notes)).toEqual({ aboutMe: 'PM at a fintech' })
    expect(profileFor(getMode('image'), notes)).toEqual({})
  })

  it('puts the notes in the prompt only when there are some', () => {
    const polish = buildModePrompt('send me the numbers', 'polish', { context: { voiceNotes: '- Sign off: Cheers, Sam' } })
    expect(polish).toContain('<how_i_write>\n- Sign off: Cheers, Sam\n</how_i_write>')
    const code = buildModePrompt('add a retry', 'code', { context: { aboutMe: 'We use TypeScript' } })
    expect(code).toContain('<about_me>\nWe use TypeScript\n</about_me>')
    const plain = buildModePrompt('add a retry', 'code', { context: { aboutMe: '' } })
    expect(plain).not.toContain('about_me')
  })

  it('keeps the last 20 real edits, ignoring no-op and whitespace-only ones', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edits-'))
    const log = createEditLog(path.join(dir, 'style-edits.json'))
    expect(log.add({ mode: 'email', before: 'Hi', after: 'Hi' })).toBe(false)
    expect(log.add({ mode: 'email', before: 'Hi  there', after: 'Hi there' })).toBe(false)
    expect(isMeaningfulEdit('', 'x')).toBe(false)
    for (let i = 0; i < 25; i++) log.add({ mode: 'email', before: `Dear team ${i}`, after: `Hi all ${i}` })
    expect(log.count()).toBe(20)
    expect(log.list()[0].before).toBe('Dear team 5')
    log.clear()
    expect(log.count()).toBe(0)
  })

  it('asks Claude for style notes from samples, or from edits, keeping current notes', () => {
    const fromSamples = buildLearnStylePrompt({ current: '- Short', samples: 'Cheers, Sam' })
    expect(fromSamples).toContain('<current_notes>\n- Short\n</current_notes>')
    expect(fromSamples).toContain('<samples>\nCheers, Sam\n</samples>')
    expect(fromSamples).toContain('Never copy personal facts')
    const fromEdits = buildLearnStylePrompt({ edits: formatEdits([{ mode: 'email', before: 'Dear team', after: 'Hi all' }]) })
    expect(fromEdits).toContain('<before>\nDear team\n</before>\n<after>\nHi all\n</after>')
    expect(fromEdits).not.toContain('current_notes')
  })
})

describe('Dictation', () => {
  const { tidyDictation, describeRemoved } = require('../main/dictation.js')
  const tidy = (t, o) => tidyDictation(t, o).text

  it('keeps your words and only drops hesitation sounds', () => {
    expect(tidy('Um, so I think we should, uh, ship it on Friday.')).toBe('So I think we should ship it on Friday.')
    expect(tidy('I was, um, thinking.')).toBe('I was thinking.')
    expect(tidy('Hmm. I like it, you know, a lot.')).toBe('I like it, you know, a lot.')
    // Real words that contain filler sounds stay put.
    expect(tidy('The human error rate is low, umbrella and all.')).toBe('The human error rate is low, umbrella and all.')
  })

  it('only capitalises where a dropped filler started the sentence', () => {
    expect(tidy('Wait... what? Er, yes.')).toBe('Wait... what? Yes.')
    expect(tidy('Uhm okay.')).toBe('Okay.')
  })

  it('turns spoken line breaks into real ones', () => {
    expect(tidy('Three things. New line. First the API. New paragraph. Thanks.')).toBe('Three things.\nFirst the API.\n\nThanks.')
    expect(tidy('Dear team, new line, the build is green')).toBe('Dear team\nthe build is green')
    expect(tidy('Ship it next line')).toBe('Ship it\n'.trim())
  })

  it('leaves "new line" alone when it is part of the sentence', () => {
    expect(tidy('We are launching a new line of products.')).toBe('We are launching a new line of products.')
    expect(tidy('To err is human.')).toBe('To err is human.')
  })

  it('reports what it removed, and can leave fillers in', () => {
    const r = tidyDictation('Um, uh, um, yes.')
    expect(r.text).toBe('Yes.')
    expect(describeRemoved(r.removed)).toBe('um ×2, uh')
    expect(tidy('Um, yes.', { removeFillers: false })).toBe('Um, yes.')
  })

  it('is the default mode for new installs, and needs no Claude call', () => {
    expect(MODES.defaultMode).toBe('dictate')
    expect(getMode('dictate').kind).toBe('dictation')
  })
})

describe('Double-tap Control', () => {
  const { createHoldToTalk, hotkeyWords, getPreset, DEFAULT_HOTKEY } = require('../main/hotkey.js')

  function machine() {
    let t = 0
    let recording = false
    const log = []
    const h = createHoldToTalk({
      isRecording: () => recording,
      onStart: () => { recording = true; log.push('start') },
      onStop: () => { recording = false; log.push('stop') },
      onCancel: () => { recording = false; log.push('cancel') },
      now: () => t,
    })
    return { h, log, at: (ms) => { t = ms } }
  }

  it('is the default, and needs the helper (no globalShortcut fallback of its own)', () => {
    expect(DEFAULT_HOTKEY).toBe('double-control')
    expect(getPreset('double-control').accelerator).toBeNull()
    expect(getPreset('double-control').helper).toMatchObject({ doubleTap: true, modifierOnly: true })
  })

  it('double-tap starts hands-free; one tap stops', () => {
    const { h, log, at } = machine()
    at(0); h.tap() // first tap of the double: nothing to stop
    at(150); h.down(); at(210); h.up() // second tap: start, released quickly → keeps recording
    expect(log).toEqual(['start'])
    at(5000); h.tap()
    expect(log).toEqual(['start', 'stop'])
  })

  it('double-tap and hold is hold to talk', () => {
    const { h, log, at } = machine()
    at(0); h.tap(); at(150); h.down(); at(2000); h.up()
    expect(log).toEqual(['start', 'stop'])
  })

  it('double-tapping to stop does not start a new recording', () => {
    const { h, log, at } = machine()
    at(0); h.down(); at(60); h.up() // start
    at(5000); h.tap() // first tap stops…
    at(5150); h.down(); at(5210); h.up() // …the second press is ignored
    expect(log).toEqual(['start', 'stop'])
  })

  it('always names the chosen shortcut, and what it needs', () => {
    expect(hotkeyWords('double-control', { helperActive: true })).toEqual({ short: 'double-tap ⌃', action: 'Double-tap Control', needsAccess: false })
    // Without Accessibility it still names double-tap Control, says what it needs, and what works meanwhile.
    expect(hotkeyWords('double-control', { helperActive: false })).toEqual({ short: 'double-tap ⌃', action: 'Double-tap Control', needsAccess: true, fallback: 'Press ⌥ Space' })
    expect(hotkeyWords('option-space', { helperActive: true }).action).toBe('Hold ⌥ Space')
    expect(hotkeyWords('option-space', { helperActive: false })).toMatchObject({ action: 'Press ⌥ Space', needsAccess: false })
  })
})

describe('talk shortcuts on each system', () => {
  const { presetsFor, fallbackHotkeyFor, getPreset, hotkeyWords, HOTKEY_PRESETS, DEFAULT_HOTKEY } = require('../main/hotkey.js')

  it('the Mac keeps its six presets and double-tap Control', () => {
    expect(Object.keys(presetsFor('darwin'))).toEqual(['double-control', 'option-space', 'right-option', 'fn', 'control-option-space', 'command-shift-space'])
    expect(presetsFor('darwin')['option-space'].short).toBe('⌥ Space')
    expect(fallbackHotkeyFor('darwin')).toBe('option-space')
    if (process.platform === 'darwin') expect(HOTKEY_PRESETS).toBe(presetsFor('darwin'))
  })

  it('Windows offers exactly five, default double-tap Ctrl, and no Fn', () => {
    const win = presetsFor('win32')
    expect(Object.keys(win)).toEqual(['double-control', 'alt-space', 'right-alt', 'ctrl-alt-space', 'ctrl-shift-space'])
    expect(DEFAULT_HOTKEY).toBe('double-control')
    expect(getPreset(undefined, 'win32').label).toBe('Double-tap Ctrl')
    expect(win.fn).toBeUndefined()
  })

  it('Windows presets use Windows words, the same combo spelling as the rest of the app, and virtual-key codes', () => {
    const { formatCombo } = require('../main/keys.js')
    const win = presetsFor('win32')
    for (const p of Object.values(win)) expect(`${p.label} ${p.short} ${p.action}`).not.toMatch(/[⌘⌥⌃⇧]|Option|Command|Control\b/)
    expect(win['alt-space'].short).toBe(formatCombo(['Alt', 'Space'], 'win32'))
    expect(win['ctrl-alt-space'].short).toBe(formatCombo(['Ctrl', 'Alt', 'Space'], 'win32'))
    expect(win['ctrl-shift-space'].short).toBe(formatCombo(['Ctrl', 'Shift', 'Space'], 'win32'))
    expect(win['double-control'].helper).toEqual({ keyCode: 0x11, modifiers: [], modifierOnly: true, doubleTap: true })
    expect(win['right-alt'].helper.keyCode).toBe(0xA5)
    // Keys with an accelerator work without the helper; modifier-only ones need it.
    expect(Object.entries(win).filter(([, p]) => p.accelerator).map(([k]) => k)).toEqual(['alt-space', 'ctrl-alt-space', 'ctrl-shift-space'])
    for (const p of Object.values(win)) expect(p.helper.modifiers.every((m) => ['control', 'alt', 'shift'].includes(m))).toBe(true)
  })

  it('a Mac-only choice copied to Windows falls back to double-tap Ctrl', () => {
    expect(getPreset('option-space', 'win32').label).toBe('Double-tap Ctrl')
    expect(getPreset('fn', 'win32').label).toBe('Double-tap Ctrl')
    expect(getPreset('alt-space', 'darwin').label).toBe('Double-tap Control')
  })

  it('without the helper, Windows hints name Alt+Space as the stand-in', () => {
    expect(hotkeyWords('double-control', { helperActive: false, platform: 'win32' }))
      .toEqual({ short: 'double-tap Ctrl', action: 'Double-tap Ctrl', needsAccess: true, fallback: 'Press Alt+Space' })
    expect(hotkeyWords('ctrl-shift-space', { helperActive: false, platform: 'win32' }))
      .toEqual({ short: 'Ctrl+Shift+Space', action: 'Press Ctrl+Shift+Space', needsAccess: false })
    expect(hotkeyWords('right-alt', { helperActive: true, platform: 'win32' }).action).toBe('Hold right Alt')
  })
})

describe('eval scorecard shape', () => {
  it('keeps only what the panel can render', () => {
    const r = normalizeEval({
      rawScore: 40, promptlyScore: 80, rawReasons: '+ one reason', promptlyReasons: ['+ a', 5, '', '- b'],
      critique: { text: 'x' }, gap: 'Missing audience', intentDrift: 'huge', intentDriftLabel: 'Kept',
      dimensions: { clarity: { raw: 30, structured: 90 }, context: { raw: 'high' }, extra: { raw: 1, structured: 2 } },
    })
    expect(r).toEqual({
      rawScore: 40, promptlyScore: 80, rawReasons: ['+ one reason'], promptlyReasons: ['+ a', '- b'],
      critique: '', gap: 'Missing audience', intentDrift: '', intentDriftLabel: 'Kept',
      dimensions: { clarity: { raw: 30, structured: 90 } },
    })
  })

  it('rejects answers without both scores', () => {
    expect(normalizeEval({ rawScore: 40 })).toBeNull()
    expect(normalizeEval({ rawScore: '40', promptlyScore: 80 })).toBeNull()
    expect(normalizeEval(null)).toBeNull()
  })
})

describe('terminate', () => {
  it('forces a process that ignores SIGTERM', async () => {
    const child = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"])
    await new Promise((r) => setTimeout(r, 300))
    const exited = new Promise((r) => child.on('exit', (_code, signal) => r(signal)))
    terminate(child, 200)
    expect(await exited).toBe('SIGKILL')
  })

  it('does nothing for a process that already exited', async () => {
    const child = spawn(process.execPath, ['-e', ''])
    await new Promise((r) => child.on('exit', r))
    expect(() => terminate(child)).not.toThrow()
  })
})

describe('small main-process edges', () => {
  it('adds the claude folder to PATH unless that exact folder is already there', () => {
    const env = makeClaudeEnv('/opt/x/bin/claude', { PATH: '/opt/x/bin2:/usr/bin' })
    expect(env.PATH.split(':')).toContain('/opt/x/bin')
    const same = makeClaudeEnv('/opt/x/bin/claude', { PATH: '/opt/x/bin:/usr/bin' })
    expect(same.PATH.split(':').filter((d) => d === '/opt/x/bin')).toHaveLength(1)
  })

  it('never throws while logging odd values', () => {
    const logger = createLogger(path.join(tmp, 'logs-odd'))
    const loop = {}; loop.self = loop
    expect(() => logger.info('x', loop, 10n, undefined)).not.toThrow()
    expect(fs.readFileSync(logger.file, 'utf8')).toMatch(/\[info\] x \[object Object\] 10 undefined/)
  })
})

describe('uninstall', () => {
  it('finds the .app Promptly runs from, wherever it was installed', () => {
    expect(darwin.appBundlePath('/Users/x/Applications/Promptly.app/Contents/MacOS/Promptly')).toBe('/Users/x/Applications/Promptly.app')
    expect(darwin.appBundlePath('/usr/local/bin/electron')).toBeNull()
  })
})

describe('harness launch agents', () => {
  it('finds only the jobs Promptly created', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-home-'))
    const dir = darwin.launchAgentsDir(home)
    fs.mkdirSync(dir, { recursive: true })
    for (const f of ['com.promptly.harness.site-1a2b3c4d.plist', 'com.other.app.plist', 'com.promptly.harness.x.txt']) fs.writeFileSync(path.join(dir, f), '')
    expect(darwin.harnessLaunchAgents(home)).toEqual([{ label: 'com.promptly.harness.site-1a2b3c4d', plistPath: path.join(dir, 'com.promptly.harness.site-1a2b3c4d.plist') }])
    expect(darwin.harnessLaunchAgents(path.join(home, 'missing'))).toEqual([])
  })
})
