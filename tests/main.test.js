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
const { whisperCommand, parseTqdmLine, findDownloadedModel, makeWhisperEnv, findBundledEngine, cleanTranscript, silentWav, createWhisperRunner } = require('../main/whisper.js')
const { getClaudeStatus, installScript, loginScript, shellQuote, INSTALL_COMMAND } = require('../main/claude-setup.js')
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

  it('adds destination guidance to template modes only', () => {
    const prompt = buildModePrompt('fix the flaky test', 'balanced', { context: { bundleId: 'com.apple.Terminal', appName: 'Terminal' } })
    expect(prompt).toContain('AI coding agent')
    expect(prompt.indexOf('AI coding agent')).toBeLessThan(prompt.indexOf('The user said:'))
    expect(buildModePrompt('x', 'polish', { context: { bundleId: 'com.apple.Terminal' } })).not.toContain('AI coding agent')
  })

  it('includes selected text and dictionary words, and nothing when there is no context', () => {
    const prompt = buildModePrompt('tighten this', 'polish', { context: { selectedText: 'We are going to be doing a launch', appName: 'Notes', dictionary: ['Promptly'] } })
    expect(prompt).toContain('<selected_text>\nWe are going to be doing a launch\n</selected_text>')
    expect(prompt).toContain('selected this text in Notes')
    expect(prompt).toContain('Spell these names and terms exactly as written: Promptly.')
    expect(buildContextBlock({ kind: 'template' }, {})).toBe('')
    expect(buildModePrompt('x', 'balanced')).toBe(buildModePrompt('x', 'balanced', { context: {} }))
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
