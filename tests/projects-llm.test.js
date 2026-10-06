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

// stream-json events in the shapes Claude Code 2.1 prints them. A successful tool_result carries no
// is_error; one Claude Code refused (a read outside cwd) has is_error: true.
const textDelta = (text) => ({ type: 'stream_event', event: { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text } } })
const toolStart = (id, name) => ({ type: 'stream_event', event: { type: 'content_block_start', index: 2, content_block: { type: 'tool_use', id, name, input: {} } } })
const toolUse = (id, name, input) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name, input }] } })
const toolResult = (id, content, isError) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content, ...(isError ? { is_error: true } : {}) }] } })
const lines = (...events) => events.map((e) => JSON.stringify(e)).join('\n')
const OUT_OF_TURNS_RESULT = { type: 'result', subtype: 'error_max_turns', is_error: true, result: null, stop_reason: 'tool_use', num_turns: 12 }

// A run that thinks aloud, opens two files, has a third read refused, then answers.
const TOOL_STREAM = lines(
  { type: 'system', subtype: 'init' },
  textDelta('Let me check the emails.'),
  { type: 'assistant', message: { content: [{ type: 'text', text: 'Let me check the emails.' }] } },
  toolStart('toolu_1', 'Read'),
  toolUse('toolu_1', 'Read', { file_path: 'comms/2026-10-04 Aparna.eml.txt' }),
  toolResult('toolu_1', 'Can you add the copyable link?'),
  toolStart('toolu_2', 'Grep'),
  toolUse('toolu_2', 'Grep', { pattern: 'tenant' }),
  toolResult('toolu_2', 'agreements/sow.md:12: tenant ID'),
  toolStart('toolu_3', 'Read'),
  toolUse('toolu_3', 'Read', { file_path: '/etc/hosts' }),
  { type: 'system', subtype: 'permission_denied', tool_name: 'Read', tool_use_id: 'toolu_3' },
  toolResult('toolu_3', 'Claude requested permissions to read from /etc/hosts', true),
  textDelta('Hi Aparna,'),
  textDelta(' yes, this week.'),
  { type: 'assistant', message: { content: [{ type: 'text', text: 'Hi Aparna, yes, this week.' }] } },
  { type: 'result', subtype: 'success', is_error: false, result: 'Hi Aparna, yes, this week.' },
)
const TOOLS_THAT_RAN = [
  { name: 'Read', input: { file_path: 'comms/2026-10-04 Aparna.eml.txt' } },
  { name: 'Grep', input: { pattern: 'tenant' } },
]

// What Claude Code 2.1 prints when it runs out of turns: it stops on a tool call, nothing after it.
const OUT_OF_TURNS = lines(
  textDelta("I'll read the emails first."),
  toolStart('toolu_1', 'Read'),
  toolUse('toolu_1', 'Read', { file_path: 'comms/a.eml.txt' }),
  toolResult('toolu_1', '…'),
  OUT_OF_TURNS_RESULT,
)

const OUT_OF_TURNS_REFUSED = lines(
  toolStart('toolu_1', 'Read'),
  toolUse('toolu_1', 'Read', { file_path: '/etc/hosts' }),
  toolResult('toolu_1', 'Claude requested permissions to read from /etc/hosts', true),
  OUT_OF_TURNS_RESULT,
)

const OUT_OF_TURNS_AFTER_WRITING = lines(
  textDelta("I'll read the emails first."),
  toolStart('toolu_1', 'Read'),
  toolUse('toolu_1', 'Read', { file_path: 'comms/a.eml.txt' }),
  toolResult('toolu_1', '…'),
  textDelta('Hi Aparna, the link ships Friday.'),
  OUT_OF_TURNS_RESULT,
)

// Opens a file, then fails part way (Probe B: error_during_execution, exit 1).
const FAILS_AFTER_READING = lines(
  toolStart('toolu_1', 'Read'),
  toolUse('toolu_1', 'Read', { file_path: 'comms/a.eml.txt' }),
  toolResult('toolu_1', '…'),
  { type: 'result', subtype: 'error_during_execution', is_error: true, result: 'API Error: 500 Internal server error' },
)

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

const emit = (stream, code = 0) => `if [ $streaming = 1 ]; then cat <<'JSON'\n${stream}\nJSON\nexit ${code}; fi`
const reject = (flag, message) => `for a in "$@"; do if [ "$a" = "${flag}" ]; then echo "${message}" >&2; exit 1; fi; done`

function runner(fake) {
  return createClaudeRunner({ getClaudePath: () => fake.file, getModel: () => 'test-model' })
}

describe('stream parser: tool calls (Look deeper)', () => {
  it('hands onTool each tool that ran, not one Claude Code refused, and keeps the text after the last call', () => {
    const tools = []
    const deltas = []
    const parser = createStreamParser((t) => deltas.push(t), (call) => tools.push(call))
    parser.feed(TOOL_STREAM + '\n')
    expect(tools).toEqual(TOOLS_THAT_RAN)
    expect(parser.text()).toBe('Hi Aparna, yes, this week.')
    // The thinking aloud is taken back ('') before the first tool runs; only the answer follows.
    expect(deltas).toEqual(['Let me check the emails.', '', 'Hi Aparna,', 'Hi Aparna, yes, this week.'])
    expect(parser.result()).toMatchObject({ subtype: 'success', result: 'Hi Aparna, yes, this week.' })
  })

  it('takes the thinking aloud off the screen as soon as a tool call starts streaming', () => {
    const deltas = []
    const parser = createStreamParser((t) => deltas.push(t))
    const feed = (e) => parser.feed(JSON.stringify(e) + '\n')
    feed(textDelta('Let me look.'))
    expect(deltas).toEqual(['Let me look.'])
    feed(toolStart('toolu_1', 'Read'))
    expect(deltas).toEqual(['Let me look.', ''])
    expect(parser.text()).toBe('')
    // The full tool_use event that follows doesn't clear it a second time.
    feed(toolUse('toolu_1', 'Read', { file_path: 'a.txt' }))
    expect(deltas).toEqual(['Let me look.', ''])
  })

  it('without an earlier text, a tool call sends nothing to onDelta', () => {
    const deltas = []
    const parser = createStreamParser((t) => deltas.push(t))
    parser.feed(lines(toolStart('toolu_1', 'Read'), toolUse('toolu_1', 'Read', { file_path: 'a.txt' }), toolResult('toolu_1', 'x')) + '\n')
    expect(deltas).toEqual([])
  })

  it('reports a tool only once its result is back, once, and never one that failed or never answered', () => {
    const tools = []
    const parser = createStreamParser(() => {}, (call) => tools.push(call))
    const feed = (...events) => parser.feed(lines(...events) + '\n')
    feed(toolUse('toolu_1', 'Read', { file_path: 'a.txt' }))
    expect(tools).toEqual([])
    feed(toolResult('toolu_1', 'contents'))
    expect(tools).toEqual([{ name: 'Read', input: { file_path: 'a.txt' } }])
    feed(toolResult('toolu_1', 'contents again'))
    feed(toolResult('toolu_unknown', 'contents'))
    feed(toolUse('toolu_2', 'Read', { file_path: '/etc/hosts' }), toolResult('toolu_2', 'refused', true))
    feed(toolUse('toolu_3', 'Grep', { pattern: 'x' }))
    feed({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'b.txt' } }] } })
    feed({ type: 'result', subtype: 'success', is_error: false, result: 'done' })
    expect(tools).toEqual([{ name: 'Read', input: { file_path: 'a.txt' } }])
  })

  it('keeps going when onTool throws, and works without onTool', () => {
    const parser = createStreamParser(() => {}, () => { throw new Error('caller bug') })
    expect(() => parser.feed(TOOL_STREAM + '\n')).not.toThrow()
    expect(parser.result()).toMatchObject({ result: 'Hi Aparna, yes, this week.' })

    const quiet = createStreamParser(() => {})
    expect(() => quiet.feed(TOOL_STREAM + '\n')).not.toThrow()
    expect(quiet.text()).toBe('Hi Aparna, yes, this week.')
  })

  it('gives a tool call without input an empty object, and ignores odd assistant and user events', () => {
    const tools = []
    const parser = createStreamParser(() => {}, (call) => tools.push(call))
    parser.feed(lines(
      { type: 'assistant', message: { content: 'just text' } },
      { type: 'assistant' },
      { type: 'user', message: { content: 'just text' } },
      { type: 'user', message: { content: [null] } },
      { type: 'assistant', message: { content: [null, { type: 'tool_use', id: 'toolu_1', name: 'Glob' }] } },
      toolResult('toolu_1', 'a.txt'),
    ) + '\n')
    expect(tools).toEqual([{ name: 'Glob', input: {} }])
  })
})

// A spawn stand-in that records each call and answers at once. `answer(args)` may return
// { out, err, code } to script the run, or { throws } to make spawn itself throw.
function scriptedSpawn(answer = () => ({})) {
  const calls = []
  const spawnImpl = (cmd, args, options) => {
    calls.push({ cmd, args, options })
    const { out, err = '', code = 0, throws, emitError } = answer(args, calls.length) || {}
    if (throws) throw throws
    const child = new EventEmitter()
    child.stdout = new PassThrough(); child.stderr = new PassThrough()
    child.stdin = { on() {}, end() {} }
    child.kill = () => {}
    child.exitCode = null; child.signalCode = null
    if (emitError) { setTimeout(() => child.emit('error', emitError)); return child }
    const text = out ?? (args.includes('stream-json') ? JSON.stringify({ type: 'result', is_error: false, result: 'ok' }) : 'ok')
    setTimeout(() => { child.stderr.end(err); child.stdout.end(text); setTimeout(() => child.emit('close', code), 5) })
    return child
  }
  return { calls, spawnImpl }
}

function scriptedRunner(answer) {
  const s = scriptedSpawn(answer)
  return { ...s, claude: createClaudeRunner({ getClaudePath: () => '/x/claude', getModel: () => 'test-model', spawnImpl: s.spawnImpl }) }
}

const UNSUPPORTED = { success: false, error: 'Unsupported tool', errorType: 'unknown' }

describe('createClaudeRunner: tool runs, without bash', () => {
  it('a run without tools sends exactly the arguments and spawn options it always has', async () => {
    const { calls, claude } = scriptedRunner()
    expect(await claude.run('hi')).toEqual({ success: true, prompt: 'ok' })
    expect(calls[0].args).toEqual(['-p', '--model', 'test-model', '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--system-prompt', SYSTEM_PROMPT, '--disable-slash-commands'])
    expect(Object.keys(calls[0].options)).toEqual(['env'])

    await claude.run('hi', { onDelta: () => {} })
    expect(calls[1].args).toEqual(['-p', '--model', 'test-model', '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--system-prompt', SYSTEM_PROMPT, '--disable-slash-commands', ...STREAM_FLAGS])
  })

  it('maxTurns alone, an empty tool list or a falsy one changes nothing', async () => {
    const { calls, claude } = scriptedRunner()
    await claude.run('hi', { maxTurns: 12 })
    await claude.run('hi', { tools: [] })
    await claude.run('hi', { tools: null })
    await claude.run('hi', { tools: false })
    expect(calls).toHaveLength(4)
    for (const { args } of calls) {
      expect(hasSeq(args, ['--tools', ''])).toBe(true)
      expect(args).not.toContain('--max-turns')
      expect(args).not.toContain('--permission-mode')
      expect(args).not.toContain('stream-json')
    }
  })

  it('refuses every tool but Read, Grep and Glob, flags included, and starts nothing', async () => {
    const { calls, claude } = scriptedRunner()
    const cache = fs.mkdtempSync(path.join(tmp, 'cache-'))
    const bad = [
      ['Read', '--dangerously-skip-permissions', 'Bash'],
      ['Read', 'Bash'],
      ['Write'],
      ['Edit', 'Read'],
      ['read'],
      ['Read', ''],
      ['Read(/etc/**)'],
      [{}],
      [null],
      'Read',
      true,
      { 0: 'Read', length: 1 },
    ]
    for (const tools of bad) {
      const r = await claude.run('hi', { tools, maxTurns: 12, cwd: cache })
      expect(r, JSON.stringify(tools)).toEqual(UNSUPPORTED)
    }
    expect(calls).toHaveLength(0)
  })

  it('accepts any of the read-only tools, each named once', async () => {
    const { calls, claude } = scriptedRunner()
    const cache = fs.mkdtempSync(path.join(tmp, 'cache-'))
    await claude.run('hi', { tools: ['Read'], cwd: cache })
    await claude.run('hi', { tools: ['Grep', 'Glob'], cwd: cache })
    await claude.run('hi', { tools: ['Read', 'Read', 'Glob'], cwd: cache })
    expect(hasSeq(calls[0].args, ['--tools', 'Read', '--no-session-persistence'])).toBe(true)
    expect(hasSeq(calls[1].args, ['--tools', 'Grep', 'Glob', '--no-session-persistence'])).toBe(true)
    expect(hasSeq(calls[2].args, ['--tools', 'Read', 'Glob', '--no-session-persistence'])).toBe(true)
  })

  it('caps every tool run: maxTurns 1-50 as given, anything else 12', async () => {
    const { calls, claude } = scriptedRunner()
    const cache = fs.mkdtempSync(path.join(tmp, 'cache-'))
    const cases = [[undefined, '12'], [1, '1'], [20, '20'], [50, '50'], [0, '12'], [-1, '12'], [12.7, '12'], [51, '12'], [Infinity, '12'], [NaN, '12'], ['20', '12'], [null, '12']]
    for (const [maxTurns] of cases) await claude.run('hi', { tools: READ_ONLY, maxTurns, cwd: cache })
    cases.forEach(([maxTurns, sent], i) => {
      const { args } = calls[i]
      expect(args.filter((a) => a === '--max-turns'), String(maxTurns)).toHaveLength(1)
      expect(hasSeq(args, ['--max-turns', sent]), String(maxTurns)).toBe(true)
    })
  })

  it('a tool run spawns in cwd and passes the env as before', async () => {
    const { calls, claude } = scriptedRunner()
    const cache = fs.mkdtempSync(path.join(tmp, 'cache-'))
    const r = await claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: cache })
    expect(r).toEqual({ success: true, prompt: 'ok' })
    expect(calls[0].options.cwd).toBe(cache)
    expect(Object.keys(calls[0].options).sort()).toEqual(['cwd', 'env'])
    expect(calls[0].options.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe('1')
  })

  it('a missing folder, a file or no folder at all fails without starting Claude, and doesn\'t read as Claude Code missing', async () => {
    const { calls, claude } = scriptedRunner()
    const file = path.join(tmp, 'not-a-folder.txt')
    fs.writeFileSync(file, 'x')
    const runs = [
      claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: path.join(tmp, 'gone') }),
      claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: file }),
      claude.run('hi', { tools: READ_ONLY, maxTurns: 12 }),
      claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: 42 }),
      // An ordinary run given a file as its folder resolves the same way instead of throwing.
      claude.run('hi', { cwd: file }),
    ]
    for (const r of await Promise.all(runs)) {
      expect(r).toMatchObject({ success: false, errorType: 'unknown' })
      expect(claudeUnavailable(r)).toBeNull()
    }
    expect(calls).toHaveLength(0)
  })

  it.skipIf(onWindows || process.getuid?.() === 0)('a folder Claude can\'t open fails without starting Claude', async () => {
    const { calls, claude } = scriptedRunner()
    const locked = fs.mkdtempSync(path.join(tmp, 'locked-'))
    fs.chmodSync(locked, 0o000)
    try {
      const r = await claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: locked })
      expect(r).toMatchObject({ success: false, errorType: 'unknown' })
      expect(claudeUnavailable(r)).toBeNull()
      expect(calls).toHaveLength(0)
    } finally {
      fs.chmodSync(locked, 0o755)
    }
  })

  it('a spawn that throws resolves as a failed run instead of rejecting', async () => {
    const { calls, claude } = scriptedRunner(() => ({ throws: new Error('spawn ENOTDIR') }))
    const cache = fs.mkdtempSync(path.join(tmp, 'cache-'))
    const r = await claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: cache })
    expect(r).toMatchObject({ success: false, error: 'spawn ENOTDIR', errorType: 'unknown' })
    expect(calls.length).toBeGreaterThan(0)
    await expect(claude.run('hi')).resolves.toMatchObject({ success: false, errorType: 'unknown' })
  })

  it('a folder removed just before Claude starts doesn\'t read as Claude Code missing', async () => {
    const cache = fs.mkdtempSync(path.join(tmp, 'cache-'))
    const { calls, claude } = scriptedRunner(() => {
      fs.rmSync(cache, { recursive: true, force: true })
      return { emitError: new Error('spawn /x/claude ENOENT') }
    })
    const r = await claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: cache })
    expect(r).toMatchObject({ success: false, errorType: 'unknown' })
    expect(r.error).not.toMatch(/ENOENT/)
    expect(claudeUnavailable(r)).toBeNull()
    // Not the quick start's fault, so no second try.
    expect(calls).toHaveLength(1)
  })

  it('a failed tool run never turns off the quick start for ordinary runs', async () => {
    const cache = fs.mkdtempSync(path.join(tmp, 'cache-'))
    const failing = (args) => (args.includes('--max-turns')
      ? { out: JSON.stringify({ type: 'result', is_error: true, result: 'API Error: 500' }), code: 1 }
      : {})
    const { calls, claude } = scriptedRunner(failing)
    const r = await claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: cache })
    expect(r.success).toBe(false)
    // Before any tool ran, the tool run gets one more try without the quick start …
    expect(calls).toHaveLength(2)
    expect(calls[1].args).not.toContain('--disable-slash-commands')
    // … and whatever came of it, ordinary runs start as they did.
    expect(await claude.run('hi')).toEqual({ success: true, prompt: 'ok' })
    expect(calls[2].args).toEqual(['-p', '--model', 'test-model', '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--system-prompt', SYSTEM_PROMPT, '--disable-slash-commands'])
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
    // A user's own permission settings can't widen a tool run.
    expect(hasSeq(args, ['--permission-mode', 'default'])).toBe(true)
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

  it.skipIf(onWindows)('tells onTool about each tool that ran, not a read Claude Code refused, and a throwing onTool doesn\'t break the run', async () => {
    const fake = writeFake('reader', emit(TOOL_STREAM))
    const cache = fs.mkdtempSync(path.join(tmp, 'cache-'))
    const tools = []
    const r = await runner(fake).run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: cache, onTool: (call) => tools.push(call) })
    expect(r.success).toBe(true)
    expect(tools).toEqual(TOOLS_THAT_RAN)

    const again = await runner(fake).run('hi', { tools: READ_ONLY, cwd: cache, onTool: () => { throw new Error('caller bug') } })
    expect(again).toEqual({ success: true, prompt: 'Hi Aparna, yes, this week.' })
  })

  it.skipIf(onWindows)('takes the thinking aloud off the screen when a tool call starts, then streams the answer', async () => {
    const fake = writeFake('reader', emit(TOOL_STREAM))
    const deltas = []
    await runner(fake).run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: tmp, onDelta: (t) => deltas.push(t) })
    expect(deltas).toEqual(['Let me check the emails.', '', 'Hi Aparna,', 'Hi Aparna, yes, this week.'])
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
    expect(ordinary).toContain('--disable-slash-commands')
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

  it.skipIf(onWindows)('a tool run that fails before any tool ran gets one more try without the quick start; ordinary runs keep it', async () => {
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
    expect(tools).toEqual(TOOLS_THAT_RAN)

    // The tool run didn't decide for ordinary runs: the next one still tries the quick start, finds
    // out for itself, and only then do later calls skip it.
    expect(await claude.run('hi')).toEqual({ success: true, prompt: 'plain answer' })
    expect(fake.runs()[2]).toContain('--disable-slash-commands')
    expect(fake.runs()[3]).not.toContain('--disable-slash-commands')
    await claude.run('hi')
    expect(fake.runs()[4]).not.toContain('--disable-slash-commands')
  })

  it.skipIf(onWindows)('a CLI that rejects only the quick-start flag still gets a tool run with --tools and no MCP servers', async () => {
    const fake = writeFake('no-quick-flag', `${reject('--disable-slash-commands', "error: unknown option '--disable-slash-commands'")}\n${emit(TOOL_STREAM)}`)
    const claude = runner(fake)
    const r = await claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: tmp })
    expect(r).toEqual({ success: true, prompt: 'Hi Aparna, yes, this week.' })
    expect(fake.runs()).toHaveLength(2)
    const retry = fake.runs()[1]
    expect(retry).not.toContain('--disable-slash-commands')
    expect(hasSeq(retry, ['--tools', 'Read', 'Grep', 'Glob'])).toBe(true)
    expect(retry).toContain('--strict-mcp-config')
    expect(retry).toContain('--no-session-persistence')

    // Ordinary runs still start with their lean and quick-start flags.
    await claude.run('hi')
    expect(hasSeq(fake.runs()[2], ['--tools', ''])).toBe(true)
    expect(fake.runs()[2]).toContain('--disable-slash-commands')
  })

  it.skipIf(onWindows)('a tool run that fails after a tool ran is not run twice, and doesn\'t turn off the quick start', async () => {
    const fake = writeFake('fails-late', emit(FAILS_AFTER_READING, 1))
    const claude = runner(fake)
    const tools = []
    const r = await claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: tmp, onTool: (call) => tools.push(call) })
    expect(r).toMatchObject({ success: false, errorType: 'unknown' })
    expect(fake.runs()).toHaveLength(1)
    // Reported once: no second run to report it again.
    expect(tools).toEqual([{ name: 'Read', input: { file_path: 'comms/a.eml.txt' } }])

    expect(await claude.run('hi')).toEqual({ success: true, prompt: 'plain answer' })
    expect(fake.runs()[1]).toContain('--disable-slash-commands')
  })

  it.skipIf(onWindows)('running out of turns on a tool call fails once as max-turns, and leaves nothing on screen', async () => {
    const fake = writeFake('out-of-turns', emit(OUT_OF_TURNS, 1))
    const tools = []
    const deltas = []
    const claude = runner(fake)
    const r = await claude.run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: tmp, onTool: (call) => tools.push(call), onDelta: (t) => deltas.push(t) })
    expect(r).toEqual({ success: false, error: 'Claude opened too many files without answering — try again', errorType: 'max-turns' })
    expect(claudeUnavailable(r)).toBeNull()
    expect(fake.runs()).toHaveLength(1)
    expect(tools).toEqual([{ name: 'Read', input: { file_path: 'comms/a.eml.txt' } }])
    expect(deltas).toEqual(["I'll read the emails first.", ''])

    // Out of turns with only refused reads: still no second try.
    const refused = writeFake('out-of-turns-refused', emit(OUT_OF_TURNS_REFUSED, 1))
    expect(await runner(refused).run('hi', { tools: READ_ONLY, maxTurns: 12, cwd: tmp })).toMatchObject({ success: false, errorType: 'max-turns' })
    expect(refused.runs()).toHaveLength(1)

    // Ordinary runs still start quick.
    await claude.run('hi')
    expect(fake.runs()[1]).toContain('--disable-slash-commands')
  })

  // Claude Code 2.1 never writes after its last tool call when out of turns; this guards a CLI that does.
  it.skipIf(onWindows)('running out of turns after writing returns only what was written after the last tool call', async () => {
    const fake = writeFake('out-of-turns', emit(OUT_OF_TURNS_AFTER_WRITING, 1))
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
