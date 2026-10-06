import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createRequire } from 'module'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { EventEmitter } from 'events'
import { PassThrough } from 'stream'

// Tests that need bash are skipped on Windows, like the runner tests in main.test.js.
const onWindows = process.platform === 'win32'

const require = createRequire(import.meta.url)
const { createClaudeRunner, createStreamParser, claudeUnavailable } = require('../main/llm.js')

const STREAM_FLAGS = ['--output-format', 'stream-json', '--include-partial-messages', '--verbose']
const SYSTEM_PROMPT = "Follow the user's instructions exactly and output only what they ask for."
const READ_ONLY = ['Read', 'Grep', 'Glob']

let tmp
beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-projects-llm-')) })
afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }) })

// True when `seq` appears in `args` as consecutive items.
function hasSeq(args, seq) {
  return args.some((_, i) => seq.every((s, j) => args[i + j] === s))
}

// What Claude Code prints with stream-json for a run that opens two files before answering.
const TOOL_STREAM = [
  { type: 'system', subtype: 'init' },
  { type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Let me check the emails.' } } },
  { type: 'assistant', message: { content: [{ type: 'text', text: 'Let me check the emails.' }] } },
  { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: 'comms/2026-10-04 Aparna.eml.txt' } }] } },
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'Can you add the copyable link?' }] } },
  { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'toolu_2', name: 'Grep', input: { pattern: 'tenant' } }] } },
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_2', content: 'agreements/sow.md:12: tenant ID' }] } },
  { type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hi Aparna,' } } },
  { type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' yes, this week.' } } },
  { type: 'assistant', message: { content: [{ type: 'text', text: 'Hi Aparna, yes, this week.' }] } },
  { type: 'result', subtype: 'success', is_error: false, result: 'Hi Aparna, yes, this week.' },
].map((e) => JSON.stringify(e)).join('\n')

const OUT_OF_TURNS = [
  { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: 'comms/a.eml.txt' } }] } },
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '…' }] } },
  { type: 'result', subtype: 'error_max_turns', is_error: true, num_turns: 12 },
].map((e) => JSON.stringify(e)).join('\n')

const OUT_OF_TURNS_AFTER_WRITING = [
  { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: 'comms/a.eml.txt' } }] } },
  { type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hi Aparna, the link ships Friday.' } } },
  { type: 'result', subtype: 'error_max_turns', is_error: true, num_turns: 12 },
].map((e) => JSON.stringify(e)).join('\n')

// A bash stand-in for `claude`. Every run records its arguments (NUL-separated, one run per
// line), its working folder and its stdin next to the script, then runs `body`. Without the
// stream flags it answers in plain text, as the real CLI would.
function writeFake(name, body) {
  const dir = fs.mkdtempSync(path.join(tmp, `${name}-`))
  const file = path.join(dir, 'claude')
  fs.writeFileSync(file, `#!/bin/bash
here=$(dirname "$0")
input=$(cat)
printf '%s' "$input" > "$here/stdin.txt"
{ printf '%s\\0' "$@"; printf '\\n'; } >> "$here/args.log"
pwd -P >> "$here/pwd.log"
streaming=0
for a in "$@"; do if [ "$a" = "stream-json" ]; then streaming=1; fi; done
${body}
if [ $streaming = 0 ]; then printf 'plain answer'; exit 0; fi
`)
  fs.chmodSync(file, 0o755)
  const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8') } catch { return '' } }
  return {
    file,
    runs: () => read('args.log').split('\n').slice(0, -1).map((line) => line.split('\0').slice(0, -1)),
    pwds: () => read('pwd.log').split('\n').filter(Boolean),
    stdin: () => read('stdin.txt'),
  }
}

const emit = (stream) => `if [ $streaming = 1 ]; then cat <<'JSON'\n${stream}\nJSON\nexit 0; fi`
const reject = (flag, message) => `for a in "$@"; do if [ "$a" = "${flag}" ]; then echo "${message}" >&2; exit 1; fi; done`

function runner(fake) {
  return createClaudeRunner({ getClaudePath: () => fake.file, getModel: () => 'test-model' })
}

describe('stream parser: tool calls (Look deeper)', () => {
  it('hands each tool call to onTool and keeps the text after the last one', () => {
    const tools = []
    const deltas = []
    const parser = createStreamParser((t) => deltas.push(t), (call) => tools.push(call))
    parser.feed(TOOL_STREAM + '\n')
    expect(tools).toEqual([
      { name: 'Read', input: { file_path: 'comms/2026-10-04 Aparna.eml.txt' } },
      { name: 'Grep', input: { pattern: 'tenant' } },
    ])
    expect(parser.text()).toBe('Hi Aparna, yes, this week.')
    // Thinking aloud before the first file isn't carried into the answer as it streams.
    expect(deltas).toEqual(['Let me check the emails.', 'Hi Aparna,', 'Hi Aparna, yes, this week.'])
    expect(parser.result()).toMatchObject({ subtype: 'success', result: 'Hi Aparna, yes, this week.' })
  })

  it('keeps going when onTool throws, and works without onTool', () => {
    const parser = createStreamParser(() => {}, () => { throw new Error('caller bug') })
    expect(() => parser.feed(TOOL_STREAM + '\n')).not.toThrow()
    expect(parser.result()).toMatchObject({ result: 'Hi Aparna, yes, this week.' })

    const quiet = createStreamParser(() => {})
    expect(() => quiet.feed(TOOL_STREAM + '\n')).not.toThrow()
    expect(quiet.text()).toBe('Hi Aparna, yes, this week.')
  })

  it('gives a tool call without input an empty object, and ignores odd assistant events', () => {
    const tools = []
    const parser = createStreamParser(() => {}, (call) => tools.push(call))
    parser.feed([
      { type: 'assistant', message: { content: 'just text' } },
      { type: 'assistant' },
      { type: 'assistant', message: { content: [null, { type: 'tool_use', name: 'Glob' }] } },
    ].map((e) => JSON.stringify(e)).join('\n') + '\n')
    expect(tools).toEqual([{ name: 'Glob', input: {} }])
  })
})

// A spawn stand-in that records each call and answers at once (stream-json when asked for it).
function recordingSpawn() {
  const calls = []
  const spawnImpl = (cmd, args, options) => {
    calls.push({ cmd, args, options })
    const child = new EventEmitter()
    child.stdout = new PassThrough(); child.stderr = new PassThrough()
    child.stdin = { on() {}, end() {} }
    child.kill = () => {}
    const out = args.includes('stream-json') ? JSON.stringify({ type: 'result', is_error: false, result: 'ok' }) : 'ok'
    setTimeout(() => { child.stdout.end(out); setTimeout(() => child.emit('close', 0), 5) })
    return child
  }
  return { calls, spawnImpl }
}

describe('createClaudeRunner: tool runs, without bash', () => {
  it('a run without tools sends exactly the arguments and spawn options it always has', async () => {
    const { calls, spawnImpl } = recordingSpawn()
    const claude = createClaudeRunner({ getClaudePath: () => '/x/claude', getModel: () => 'test-model', spawnImpl })
    expect(await claude.run('hi')).toEqual({ success: true, prompt: 'ok' })
    expect(calls[0].args).toEqual(['-p', '--model', 'test-model', '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--system-prompt', SYSTEM_PROMPT, '--disable-slash-commands'])
    expect(Object.keys(calls[0].options)).toEqual(['env'])

    await claude.run('hi', { onDelta: () => {} })
    expect(calls[1].args).toEqual(['-p', '--model', 'test-model', '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--system-prompt', SYSTEM_PROMPT, '--disable-slash-commands', ...STREAM_FLAGS])
  })

  it('maxTurns alone, or an empty tool list, changes nothing', async () => {
    const { calls, spawnImpl } = recordingSpawn()
    const claude = createClaudeRunner({ getClaudePath: () => '/x/claude', getModel: () => 'test-model', spawnImpl })
    await claude.run('hi', { maxTurns: 12 })
    await claude.run('hi', { tools: [] })
    for (const { args } of calls) {
      expect(hasSeq(args, ['--tools', ''])).toBe(true)
      expect(args).not.toContain('--max-turns')
      expect(args).not.toContain('stream-json')
    }
  })

  it('a tool run spawns in cwd and passes the env as before', async () => {
    const { calls, spawnImpl } = recordingSpawn()
    const claude = createClaudeRunner({ getClaudePath: () => '/x/claude', getModel: () => 'test-model', spawnImpl })
    const cache = fs.mkdtempSync(path.join(tmp, 'cache-'))
    const r = await claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: cache })
    expect(r).toEqual({ success: true, prompt: 'ok' })
    expect(calls[0].options.cwd).toBe(cache)
    expect(Object.keys(calls[0].options).sort()).toEqual(['cwd', 'env'])
    expect(calls[0].options.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe('1')
  })

  it('a missing folder fails without starting Claude, and doesn\'t read as Claude Code missing', async () => {
    const { calls, spawnImpl } = recordingSpawn()
    const claude = createClaudeRunner({ getClaudePath: () => '/x/claude', spawnImpl })
    const r = await claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: path.join(tmp, 'gone') })
    expect(r.success).toBe(false)
    expect(calls).toHaveLength(0)
    expect(claudeUnavailable(r)).toBeNull()
  })
})

describe('createClaudeRunner: tool runs with a stand-in claude', () => {
  it.skipIf(onWindows)('runs read-only: named tools, no MCP servers, max turns, streaming, the user\'s settings kept', async () => {
    const fake = writeFake('reader', emit(TOOL_STREAM))
    const cache = fs.mkdtempSync(path.join(tmp, 'cache-'))
    const r = await runner(fake).run('secret project prompt', { tools: READ_ONLY, maxTurns: 12, cwd: cache })
    expect(r).toEqual({ success: true, prompt: 'Hi Aparna, yes, this week.' })
    const [args] = fake.runs()
    expect(hasSeq(args, ['--tools', 'Read', 'Grep', 'Glob'])).toBe(true)
    expect(args).not.toContain('')
    expect(args).toContain('--strict-mcp-config')
    expect(args).toContain('--no-session-persistence')
    expect(hasSeq(args, ['--max-turns', '12'])).toBe(true)
    expect(hasSeq(args, STREAM_FLAGS)).toBe(true)
    expect(hasSeq(args, ['--model', 'test-model'])).toBe(true)
    expect(args).not.toContain('--setting-sources')
    expect(args).not.toContain('--restricted')
    // The prompt still goes on stdin.
    expect(args.join(' ')).not.toContain('secret project prompt')
    expect(fake.stdin()).toBe('secret project prompt')
  })

  it.skipIf(onWindows)('runs in the cache folder it is given', async () => {
    const fake = writeFake('reader', emit(TOOL_STREAM))
    const cache = fs.mkdtempSync(path.join(tmp, 'cache-'))
    await runner(fake).run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: cache })
    expect(fake.pwds()).toEqual([fs.realpathSync(cache)])
  })

  it.skipIf(onWindows)('tells onTool about every file Claude opens, and a throwing onTool doesn\'t break the run', async () => {
    const fake = writeFake('reader', emit(TOOL_STREAM))
    const cache = fs.mkdtempSync(path.join(tmp, 'cache-'))
    const tools = []
    const r = await runner(fake).run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: cache, onTool: (call) => tools.push(call) })
    expect(r.success).toBe(true)
    expect(tools[0]).toEqual({ name: 'Read', input: { file_path: 'comms/2026-10-04 Aparna.eml.txt' } })
    expect(tools.map((t) => t.name)).toEqual(['Read', 'Grep'])

    const again = await runner(fake).run('hi', { tools: READ_ONLY, cwd: cache, onTool: () => { throw new Error('caller bug') } })
    expect(again).toEqual({ success: true, prompt: 'Hi Aparna, yes, this week.' })
  })

  it.skipIf(onWindows)('streams only the answer to onDelta, not the thinking aloud before a tool call', async () => {
    const fake = writeFake('reader', emit(TOOL_STREAM))
    const deltas = []
    await runner(fake).run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: tmp, onDelta: (t) => deltas.push(t) })
    expect(deltas.at(-1)).toBe('Hi Aparna, yes, this week.')
    expect(deltas.slice(1).some((t) => t.includes('Let me check'))).toBe(false)
  })

  it.skipIf(onWindows)('a run without tools still sends --tools with an empty argument and no tool-run flags', async () => {
    const fake = writeFake('reader', emit(TOOL_STREAM))
    const r = await runner(fake).run('hi')
    expect(r).toEqual({ success: true, prompt: 'plain answer' })
    const [args] = fake.runs()
    expect(hasSeq(args, ['--tools', ''])).toBe(true)
    expect(args).not.toContain('--max-turns')
    expect(args).not.toContain('stream-json')
    expect(fake.pwds()).toEqual([fs.realpathSync(process.cwd())])
  })

  it.skipIf(onWindows)('a tool run the CLI rejects is not retried without the lean flags, and ordinary runs keep them', async () => {
    const fake = writeFake('no-max-turns', reject('--max-turns', "error: unknown option '--max-turns'"))
    const claude = runner(fake)
    const r = await claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: tmp })
    expect(r.success).toBe(false)
    expect(r).not.toHaveProperty('stderr')
    // One run only: never again without --tools (which would mean every tool and the user's MCP servers).
    expect(fake.runs()).toHaveLength(1)

    expect(await claude.run('hi')).toEqual({ success: true, prompt: 'plain answer' })
    const ordinary = fake.runs()[1]
    expect(hasSeq(ordinary, ['--tools', ''])).toBe(true)
    expect(ordinary).toContain('--strict-mcp-config')
  })

  it.skipIf(onWindows)('on a CLI without the lean flags, a tool run doesn\'t start at all', async () => {
    const fake = writeFake('old-cli', reject('--tools', "error: unknown option '--tools'"))
    const claude = runner(fake)
    // An ordinary run finds out the CLI is old and carries on without the lean flags, as today.
    expect(await claude.run('hi')).toEqual({ success: true, prompt: 'plain answer' })
    expect(fake.runs()).toHaveLength(2)
    expect(fake.runs()[1]).not.toContain('--tools')

    const r = await claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: tmp })
    expect(r.success).toBe(false)
    expect(fake.runs()).toHaveLength(2)
  })

  it.skipIf(onWindows)('a tool run whose quick start fails is retried once as a normal tool run, as ordinary runs are', async () => {
    const fake = writeFake('needs-settings', `${reject('--disable-slash-commands', 'Invalid API key · Please run /login')}\n${emit(TOOL_STREAM)}`)
    const claude = runner(fake)
    const tools = []
    const r = await claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: tmp, onTool: (call) => tools.push(call) })
    expect(r).toEqual({ success: true, prompt: 'Hi Aparna, yes, this week.' })
    const [quick, plain] = fake.runs()
    expect(quick).toContain('--disable-slash-commands')
    expect(plain).not.toContain('--disable-slash-commands')
    expect(hasSeq(plain, ['--tools', 'Read', 'Grep', 'Glob'])).toBe(true)
    expect(plain).toContain('--strict-mcp-config')
    expect(hasSeq(plain, ['--max-turns', '12'])).toBe(true)
    expect(tools.map((t) => t.name)).toEqual(['Read', 'Grep'])

    // Later calls go straight to the normal start, exactly as after an ordinary run.
    await claude.run('hi')
    expect(fake.runs()[2]).not.toContain('--disable-slash-commands')
  })

  it.skipIf(onWindows)('running out of turns with nothing written fails once, without a second try', async () => {
    const fake = writeFake('out-of-turns', `${emit(OUT_OF_TURNS).replace('exit 0', 'exit 1')}`)
    const tools = []
    const r = await runner(fake).run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: tmp, onTool: (call) => tools.push(call) })
    expect(r).toMatchObject({ success: false, maxTurns: true })
    expect(claudeUnavailable(r)).toBeNull()
    expect(fake.runs()).toHaveLength(1)
    expect(tools).toEqual([{ name: 'Read', input: { file_path: 'comms/a.eml.txt' } }])
  })

  it.skipIf(onWindows)('running out of turns after writing returns what was written', async () => {
    const fake = writeFake('out-of-turns', `${emit(OUT_OF_TURNS_AFTER_WRITING).replace('exit 0', 'exit 1')}`)
    const r = await runner(fake).run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: tmp })
    expect(r).toEqual({ success: true, prompt: 'Hi Aparna, the link ships Friday.' })
  })

  it.skipIf(onWindows)('a tool run can be cancelled like any other', async () => {
    const fake = writeFake('slow', 'sleep 5')
    const children = new Set()
    const claude = createClaudeRunner({ getClaudePath: () => fake.file, children })
    const pending = claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: tmp, timeoutMs: 5000, slowWarningMs: 0 })
    await new Promise((res) => setTimeout(res, 100))
    expect(children.size).toBe(1)
    claude.cancelAll()
    expect((await pending).cancelled).toBe(true)
  })
})
