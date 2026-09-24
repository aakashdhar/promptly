import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createRequire } from 'module'
import fs from 'fs'
import os from 'os'
import path from 'path'

const require = createRequire(import.meta.url)
const { fillTemplate, buildModePrompt, buildEvalPrompt, getMode, MODES } = require('../main/prompts.js')
const { createClaudeRunner, parseJsonOutput, classifyError } = require('../main/llm.js')
const { createConfigStore } = require('../main/config.js')
const { createLogger } = require('../main/log.js')
const { resolveFfmpegPath, makeClaudeEnv } = require('../main/binaries.js')
const { whisperCommand, parseTqdmLine, findDownloadedModel, makeWhisperEnv } = require('../main/whisper.js')
const { drawMicIconPng, isTemplateState } = require('../main/tray-icon.js')

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

  it('fills template modes with their name and instruction', () => {
    const out = buildModePrompt(transcript, 'chain')
    expect(out).toContain('Mode: Chain of Thought')
    expect(out).toContain('reason step-by-step')
    expect(out).toContain(`"${transcript}"`)
    expect(out).not.toMatch(/\{(MODE_NAME|MODE_INSTRUCTION|TRANSCRIPT)\}/)
  })

  it('applies the polish tone', () => {
    expect(buildModePrompt(transcript, 'polish', { tone: 'casual' })).toContain('Tone: Casual')
    expect(buildModePrompt(transcript, 'polish')).toContain('Tone: Formal')
  })

  it('falls back to the default mode for unknown keys', () => {
    expect(getMode('nope').key).toBe(MODES.defaultMode)
  })

  it('has a prompt file for every standalone mode and an instruction for every template mode', () => {
    for (const mode of MODES.modes) {
      if (mode.kind === 'standalone') expect(() => buildModePrompt('x', mode.key)).not.toThrow()
      if (mode.kind === 'template') {
        expect(mode.promptName).toBeTruthy()
        expect(mode.instruction).toBeTruthy()
      }
    }
  })

  it('builds the eval prompt with both inputs', () => {
    const out = buildEvalPrompt('raw words', 'Role: X')
    expect(out).toContain('"raw words"')
    expect(out).toContain('"Role: X"')
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
})
