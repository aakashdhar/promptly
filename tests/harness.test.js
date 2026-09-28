import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'module'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Tests that need bash or check Mac-only behaviour are skipped on Windows, each with its reason;
// they still run on every Mac.
const onWindows = process.platform === 'win32'

const require = createRequire(import.meta.url)
const { parseWords, serializeWords, hintWords, applyCorrections, replacedRuns, suggestCorrections } = require('../main/words.js')
const harness = require('../main/harness.js')
const MODES = require('../shared/modes.json')

describe('Your words', () => {
  it('reads words and fixes from one list, including the old comma-separated format', () => {
    expect(parseWords('Supabase, Kubernetes\nN10 → n8n\nclod -> Claude')).toEqual({
      words: ['Supabase', 'Kubernetes'],
      corrections: [{ from: 'N10', to: 'n8n' }, { from: 'clod', to: 'Claude' }],
    })
    expect(parseWords('')).toEqual({ words: [], corrections: [] })
    expect(serializeWords(parseWords('a, b\nx->y'))).toBe('a\nb\nx → y')
  })

  it('tells Whisper the words and the right spelling of every fix', () => {
    expect(hintWords(parseWords('Promptly\nN10 → n8n\nn8n'))).toEqual(['Promptly', 'n8n'])
  })

  it('inserts a correction as typed, even with $ in it', () => {
    expect(applyCorrections('the price', [{ from: 'price', to: '$& cost $1' }])).toBe('the $& cost $1')
  })

  it('fixes whole words in any case, and leaves longer words alone', () => {
    const { corrections } = parseWords('N10 → n8n\nclod code → Claude Code')
    expect(applyCorrections('We have, for the N10 version, and the n10 one.', corrections)).toBe('We have, for the n8n version, and the n8n one.')
    expect(applyCorrections('N100 stays, so does SN10', corrections)).toBe('N100 stays, so does SN10')
    expect(applyCorrections('open clod code now', corrections)).toBe('open Claude Code now')
  })

  it('finds the words swapped in an edit', () => {
    expect(replacedRuns('We have, for the N10 version', 'We have, for the n8n version')).toEqual([{ from: 'N10', to: 'n8n' }])
    expect(replacedRuns('same text', 'same text')).toEqual([])
  })

  it('suggests a fix only after the same change in two separate edits, skipping known and dismissed ones', () => {
    const edits = [
      { before: 'Build the N10 flow', after: 'Build the n8n flow' },
      { before: 'Check N10 logs today', after: 'Check n8n logs today' },
      { before: 'ship it friday', after: 'ship it Friday' },
    ]
    expect(suggestCorrections(edits, parseWords(''))).toEqual([{ from: 'N10', to: 'n8n', count: 2 }])
    expect(suggestCorrections(edits, parseWords('N10 → n8n'))).toEqual([])
    expect(suggestCorrections(edits, parseWords(''), ['n10'])).toEqual([])
  })
})

describe('Harness mode', () => {
  it('is a builder mode in the mode list', () => {
    expect(MODES.modes.find((m) => m.key === 'harness')).toMatchObject({ kind: 'builder', group: 'specialist' })
  })

  it('builds both requests from the prompt files', () => {
    const plan = harness.buildPlanPrompt('fix the failing tests every night', '')
    expect(plan).toContain('fix the failing tests every night')
    expect(plan).toContain('"shape": "loop"')
    expect(plan).not.toMatch(/\{(TRANSCRIPT|CONTEXT)\}/)
    const files = harness.buildFilesPrompt({ transcript: 'x', plan: { gaps: [{ id: 'test_command', label: 'Test command' }, { id: 'branch', label: 'Branch' }] }, answers: { test_command: 'npm test' } })
    expect(files).toContain('Test command: npm test')
    expect(files).toContain('Branch: (no answer)')
    expect(files).not.toMatch(/\{(PLAN|ANSWERS|TRANSCRIPT)\}/)
  })

  it('keeps a usable plan and drops what the view cannot show', () => {
    const plan = harness.parsePlan('```json\n' + JSON.stringify({
      name: 'Nightly test fixer',
      shape: 'weird',
      steps: [{ title: 'Pick', detail: 'Next failing test' }, { title: 'Fix', parallel: 99 }, { detail: 'no title' }],
      checks: [{ name: 'Tests', command: 'npm test' }],
      stopWhen: [{ kind: 'done', text: 'All pass' }, { kind: 'odd', text: '25 passes' }],
      gaps: [{ id: 'test command', label: 'Test command', example: 'npm test' }, { id: 'test command', label: 'Dup' }, { label: '' }],
    }) + '\n```')
    expect(plan.shape).toBe('loop')
    expect(plan.steps).toEqual([
      { title: 'Pick', detail: 'Next failing test', runs: 'each pass', parallel: 1 },
      { title: 'Fix', detail: '', runs: 'each pass', parallel: 8 },
    ])
    expect(plan.stopWhen[1]).toEqual({ kind: 'limit', text: '25 passes' })
    expect(plan.gaps).toEqual([{ id: 'test_command', label: 'Test command', example: 'npm test' }])
    expect(harness.parsePlan('not json')).toBeNull()
    expect(harness.parsePlan('{"steps":[{"title":"Only one"}]}')).toBeNull()
  })

  it('reads the files and refuses paths outside the project', () => {
    const out = harness.parseFiles([
      'RUN: bash .harness/run.sh',
      '=== FILE .harness/run.sh ===',
      'PURPOSE: Runs the passes',
      '#!/bin/bash',
      'echo hi',
      '=== END ===',
      '=== FILE ../evil.sh ===',
      'rm -rf ~',
      '=== END ===',
      '=== FILE /etc/hosts ===',
      'x',
      '=== END ===',
      '=== FILE .harness/PROGRESS.md ===',
      '# Progress',
      '=== END ===',
    ].join('\n'))
    expect(out.run).toBe('bash .harness/run.sh')
    expect(out.schedule).toBeNull()
    expect(out.files.map((f) => f.path)).toEqual(['.harness/run.sh', '.harness/PROGRESS.md'])
    expect(out.files[0]).toEqual({ path: '.harness/run.sh', purpose: 'Runs the passes', content: '#!/bin/bash\necho hi\n' })
    expect(harness.parseFiles('nothing here')).toBeNull()
    expect(harness.safeRelativePath('a/../../b')).toBeNull()
    expect(harness.safeRelativePath('./a/b.md')).toBe('a/b.md')
  })

  it('shows which files are finished while Claude is still writing', () => {
    expect(harness.progressText('RUN: x\n=== FILE a.sh ===\nPURPOSE: y\necho\n=== END ===\n=== FILE b.md ===\npartial')).toBe('✓ a.sh\nWriting b.md…')
    expect(harness.progressText('')).toBe('')
  })

  it('adds its hooks to existing Claude settings instead of replacing them', () => {
    const merged = JSON.parse(harness.mergeSettings(
      JSON.stringify({ model: 'opus', hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [] }] } }),
      JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [] }], Stop: [{ hooks: [] }] } }),
    ))
    expect(merged.model).toBe('opus')
    expect(merged.hooks.PreToolUse.map((h) => h.matcher)).toEqual(['Bash', 'Edit|Write'])
    expect(merged.hooks.Stop).toHaveLength(1)
    expect(harness.mergeSettings('not json', '{}')).toBeNull()
  })

  it('combines permission lists and adds each hook only once', () => {
    const existing = JSON.stringify({ permissions: { allow: ['Bash(npm test)'], deny: ['Read(.env)'] }, env: { A: '1' }, hooks: { Stop: [{ hooks: [{ type: 'command', command: 'a' }] }] } })
    const incoming = JSON.stringify({ permissions: { allow: ['Bash(npm test)', 'Bash(git status)'] }, env: { B: '2' }, hooks: { Stop: [{ hooks: [{ type: 'command', command: 'a' }] }, { hooks: [{ type: 'command', command: 'b' }] }] } })
    const once = JSON.parse(harness.mergeSettings(existing, incoming))
    expect(once.permissions).toEqual({ allow: ['Bash(npm test)', 'Bash(git status)'], deny: ['Read(.env)'] })
    expect(once.env).toEqual({ A: '1', B: '2' })
    expect(once.hooks.Stop).toHaveLength(2)
    const twice = JSON.parse(harness.mergeSettings(JSON.stringify(once), incoming))
    expect(twice).toEqual(once)
  })

  it('never writes inside .git', () => {
    expect(harness.safeRelativePath('.git/hooks/pre-commit')).toBeNull()
    expect(harness.safeRelativePath('sub/.git/config')).toBeNull()
    expect(harness.safeRelativePath('.github/workflows/ci.yml')).toBe('.github/workflows/ci.yml')
  })

  describe('saving into a project', () => {
    let dir
    beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-')) })
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

    // Mac only: launchd and POSIX execute bits: Harness on Windows is phase 2 (WIN-024/025).

    it.skipIf(onWindows)('writes the files, makes scripts executable, and merges settings', () => {
      fs.mkdirSync(path.join(dir, '.claude'))
      fs.writeFileSync(path.join(dir, '.claude/settings.json'), JSON.stringify({ model: 'opus' }))
      fs.mkdirSync(path.join(dir, '.harness'))
      fs.writeFileSync(path.join(dir, '.harness/PROGRESS.md'), 'old')
      const files = [
        { path: '.harness/run.sh', content: '#!/bin/bash\necho hi\n' },
        { path: '.harness/PROGRESS.md', content: '# new\n' },
        { path: '.claude/settings.json', content: '{"hooks":{"Stop":[{"hooks":[]}]}}' },
        { path: '../outside.txt', content: 'no' },
      ]
      expect(harness.existingFiles(dir, files)).toEqual(['.harness/PROGRESS.md'])
      expect(harness.writeFiles(dir, files)).toEqual(['.harness/run.sh', '.harness/PROGRESS.md', '.claude/settings.json'])
      expect(fs.statSync(path.join(dir, '.harness/run.sh')).mode & 0o111).toBeTruthy()
      expect(fs.readFileSync(path.join(dir, '.harness/PROGRESS.md'), 'utf8')).toBe('# new\n')
      expect(JSON.parse(fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8'))).toEqual({ model: 'opus', hooks: { Stop: [{ hooks: [] }] } })
      expect(fs.existsSync(path.join(path.dirname(dir), 'outside.txt'))).toBe(false)
    })
  })

  it('reads the schedule Claude suggests, and only schedules it understands', () => {
    expect(harness.parseFiles('RUN: bash x.sh\nSCHEDULE: weekly Mon 2:30\n=== FILE x.sh ===\necho\n=== END ===').schedule).toEqual({ every: 'week', day: 1, time: '02:30' })
    expect(harness.parseSchedule('daily 02:00')).toEqual({ every: 'day', time: '02:00' })
    expect(harness.parseSchedule('weekdays 9:05')).toEqual({ every: 'weekday', time: '09:05' })
    expect(harness.parseSchedule('hourly :15')).toEqual({ every: 'hour', time: '00:15' })
    expect(harness.parseSchedule('none')).toBeNull()
    expect(harness.parseSchedule('daily 25:00')).toBeNull()
    expect(harness.checkSchedule({ every: 'week', day: 7, time: '02:00' })).toBeNull()
    expect(harness.checkSchedule({ every: 'day', time: '2:00', extra: 'x' })).toEqual({ every: 'day', time: '02:00' })
    expect(harness.scheduleLabel({ every: 'week', day: 5, time: '18:00' })).toBe('every Friday at 18:00')
    expect(harness.scheduleLabel({ every: 'hour', time: '00:00' })).toBe('every hour')
  })

  // Mac only: launchd and POSIX execute bits: Harness on Windows is phase 2 (WIN-024/025).

  it.skipIf(onWindows)('writes a launchd job that runs the harness from the project folder', () => {
    expect(harness.calendarIntervals({ every: 'weekday', time: '09:30' })).toHaveLength(5)
    expect(harness.calendarIntervals({ every: 'hour', time: '00:15' })).toEqual([{ Minute: 15 }])
    const label = harness.agentLabel('/Users/me/My App')
    expect(label).toMatch(/^com\.promptly\.harness\.my-app-[0-9a-f]{8}$/)
    expect(harness.agentLabel('/Users/me/My App')).toBe(label)
    expect(harness.agentLabel('/Users/other/My App')).not.toBe(label)
    const plist = harness.launchAgentPlist({ label, dir: '/Users/me/My App', run: 'bash .harness/run.sh && echo <done>', schedule: { every: 'day', time: '02:00' }, pathEnv: '/usr/bin' })
    expect(plist).toContain('<key>WorkingDirectory</key><string>/Users/me/My App</string>')
    expect(plist).toContain('<string>bash .harness/run.sh &amp;&amp; echo &lt;done&gt;</string>')
    expect(plist).toContain('<dict><key>Hour</key><integer>2</integer><key>Minute</key><integer>0</integer></dict>')
    expect(plist).toContain('/Users/me/My App/.harness/schedule.log')
  })
})

// ── Scheduling: one interface over launchd (macOS) and Task Scheduler (Windows) ──
// Every system call is injected, so these run the same on a Mac and on a Windows runner.

describe('Harness scheduler', () => {
  const scheduler = require('../main/platform/scheduler.js')
  const darwin = require('../main/platform/darwin.js')
  const win32 = require('../main/platform/win32.js')
  const WIN_DIR = "C:\\Users\\Zoë O'Neil\\My Projects\\nightly fixer"

  // A fake execFile: records each call and answers from `answers(args)` → { err, stdout, stderr }.
  const fakeRun = (answers = () => ({})) => {
    const calls = []
    const run = (file, args, options, cb) => {
      calls.push({ file, args, options })
      const { err = null, stdout = '', stderr = '' } = answers(args) || {}
      cb(err, stdout, stderr)
    }
    return { run, calls }
  }
  const memFs = () => {
    const files = new Map()
    return {
      files,
      mkdirSync: () => {},
      writeFileSync: (p, c) => files.set(p, String(c)),
      rmSync: (p) => files.delete(p),
      existsSync: (p) => files.has(p),
    }
  }

  it('each system names its backend', () => {
    expect(darwin.HARNESS_SCHEDULER).toBe('launchd')
    expect(win32.HARNESS_SCHEDULER).toBe('task-scheduler')
  })

  it('quotes one argument the way Windows programs read their command line', () => {
    expect(scheduler.quoteArg('-NoProfile')).toBe('-NoProfile')
    expect(scheduler.quoteArg("C:\\Users\\Zoë O'Neil\\a.ps1")).toBe("\"C:\\Users\\Zoë O'Neil\\a.ps1\"")
    expect(scheduler.quoteArg('')).toBe('""')
    expect(scheduler.quoteArg('C:\\my dir\\')).toBe('"C:\\my dir\\\\"')
    expect(scheduler.quoteArg('say "hi"')).toBe('"say \\"hi\\""')
    expect(scheduler.quoteArg('a\\"b')).toBe('"a\\\\\\"b"')
  })

  it('builds /TR from fixed flags and the quoted runner path, and refuses one too long for schtasks', () => {
    const script = path.win32.join(WIN_DIR, '.harness', 'schedule.ps1')
    expect(scheduler.taskRunLine(script)).toBe(
      "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"C:\\Users\\Zoë O'Neil\\My Projects\\nightly fixer\\.harness\\schedule.ps1\"",
    )
    expect(scheduler.createArgs({ name: 'x', script: `C:\\${'a'.repeat(300)}\\s.ps1`, schedule: { every: 'day', time: '02:00' } })).toBeNull()
  })

  it('names one ASCII task per project folder, the same every time', () => {
    const name = scheduler.taskName(WIN_DIR)
    expect(name).toMatch(/^Promptly Harness - nightly fixer \([0-9a-f]{8}\)$/)
    expect(scheduler.taskName(WIN_DIR.replace('Users', 'USERS'))).toBe(name)
    expect(scheduler.taskName('C:\\Other\\nightly fixer')).not.toBe(name)
    expect(scheduler.taskName('C:\\Users\\a\\Café — notes')).toMatch(/^Promptly Harness - Caf_ _ notes \([0-9a-f]{8}\)$/)
    expect(scheduler.taskName('C:\\')).toMatch(/^Promptly Harness - project \(/)
  })

  it('gives schtasks a separate argument for every value, per schedule kind', () => {
    const base = { name: 'Promptly Harness - app (0123abcd)', script: 'C:\\app\\.harness\\schedule.ps1' }
    const tr = scheduler.taskRunLine(base.script)
    const head = ['/Create', '/F', '/TN', base.name, '/TR', tr]
    expect(scheduler.createArgs({ ...base, schedule: { every: 'day', time: '02:00' } })).toEqual([...head, '/SC', 'DAILY', '/ST', '02:00'])
    expect(scheduler.createArgs({ ...base, schedule: { every: 'weekday', time: '09:30' } })).toEqual([...head, '/SC', 'WEEKLY', '/D', 'MON,TUE,WED,THU,FRI', '/ST', '09:30'])
    expect(scheduler.createArgs({ ...base, schedule: { every: 'week', day: 0, time: '18:00' } })).toEqual([...head, '/SC', 'WEEKLY', '/D', 'SUN', '/ST', '18:00'])
    expect(scheduler.createArgs({ ...base, schedule: { every: 'week', day: 5, time: '18:00' } })).toContain('FRI')
    expect(scheduler.createArgs({ ...base, schedule: { every: 'hour', time: '00:15' } })).toEqual([...head, '/SC', 'HOURLY', '/MO', '1', '/ST', '00:15'])
    expect(scheduler.deleteArgs(base.name)).toEqual(['/Delete', '/F', '/TN', base.name])
    expect(scheduler.queryArgs(base.name)).toEqual(['/Query', '/TN', base.name])
  })

  it('finds only Promptly harness tasks in the CSV task list', () => {
    const out = [
      '"\\Promptly Harness - app (0123abcd)","29/09/2026 02:00:00","Ready"',
      '"\\Promptly Harness - My ""Q"" app (89abcdef)","N/A","Désactivé"',
      '"\\Microsoft\\Windows\\Defrag\\ScheduledDefrag","N/A","Ready"',
      '"\\Promptly Harness - not ours","N/A","Ready"',
      '"\\Promptly Harness - app (0123abcd)","29/09/2026 02:00:00","Ready"',
      'INFO: There are no scheduled tasks presently available at your access level.',
      '',
    ].join('\r\n')
    expect(scheduler.parseTaskList(out)).toEqual(['Promptly Harness - app (0123abcd)', 'Promptly Harness - My "Q" app (89abcdef)'])
    expect(scheduler.parseTaskList('')).toEqual([])
    expect(scheduler.LIST_ARGS).toEqual(['/Query', '/FO', 'CSV', '/NH'])
  })

  it('writes a runner that works from the project folder and quotes every value for PowerShell', () => {
    const ps1 = scheduler.runnerScript({ run: "powershell -NoProfile -File .harness\\run.ps1 -Note 'it’s'", pathEnv: "C:\\Users\\Zoë O'Neil\\.local\\bin" })
    expect(ps1.startsWith('\uFEFF')).toBe(true)
    expect(ps1).toContain('Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)')
    expect(ps1).toContain("$env:Path = 'C:\\Users\\Zoë O''Neil\\.local\\bin' + ';' + $env:Path")
    expect(ps1).toContain("Invoke-Expression 'powershell -NoProfile -File .harness\\run.ps1 -Note ''it’’s''' *>&1 | Out-File -LiteralPath $log -Append -Encoding utf8")
    expect(ps1).toContain("Join-Path $PSScriptRoot 'schedule.log'")
    expect(scheduler.runnerScript({ run: 'x', pathEnv: '' })).not.toContain('$env:Path')
  })

  it('Windows: schedules, replaces, removes and lists through schtasks', async () => {
    const tasks = new Set()
    const { run, calls } = fakeRun((args) => {
      const name = args[args.indexOf('/TN') + 1]
      if (args[0] === '/Create') { tasks.add(name); return {} }
      if (args[0] === '/Delete') { tasks.delete(name); return {} }
      if (args[0] === '/Query' && args[1] === '/TN') return tasks.has(name) ? {} : { err: new Error('exit 1'), stderr: 'ERROR: not found' }
      return { stdout: [...tasks].map((t) => `"\\${t}","N/A","Ready"`).join('\r\n') }
    })
    const fsFake = memFs()
    const s = scheduler.createScheduler({ kind: win32.HARNESS_SCHEDULER, run, fsImpl: fsFake })
    expect(s.systemName).toBe('Windows')
    const label = s.labelFor(WIN_DIR)
    expect(label).toBe(scheduler.taskName(WIN_DIR))

    const job = { label, dir: WIN_DIR, run: 'powershell -NoProfile -ExecutionPolicy Bypass -File .harness\\run.ps1', schedule: { every: 'day', time: '02:00' }, pathEnv: 'C:\\claude' }
    expect(await s.install(job)).toEqual({ ok: true })
    const script = path.win32.join(WIN_DIR, '.harness', 'schedule.ps1')
    expect(fsFake.files.get(script)).toContain("Invoke-Expression 'powershell -NoProfile -ExecutionPolicy Bypass -File .harness\\run.ps1'")
    expect(calls[0]).toMatchObject({ file: 'schtasks.exe', options: { windowsHide: true } })
    expect(calls[0].args).toEqual(scheduler.createArgs({ name: label, script, schedule: job.schedule }))
    expect(await s.has(label)).toBe(true)

    // Scheduling again is the same /Create /F on the same name: a replace, not a second task.
    await s.install({ ...job, schedule: { every: 'hour', time: '00:15' } })
    expect(calls.filter((c) => c.args[0] === '/Create').map((c) => c.args[3])).toEqual([label, label])
    expect(await s.list()).toEqual([{ label }])

    expect(await s.remove(label)).toEqual({ ok: true })
    expect(calls.at(-1).args).toEqual(['/Delete', '/F', '/TN', label])
    expect(await s.has(label)).toBe(false)
    // Removing what isn't there asks first and deletes nothing.
    const before = calls.length
    expect(await s.remove(label)).toEqual({ ok: true })
    expect(calls.slice(before).map((c) => c.args[0])).toEqual(['/Query'])
    expect(await s.list()).toEqual([])
  })

  it('Windows: reports what schtasks refused, and never registers a task in tests', async () => {
    const refusing = fakeRun((args) => (args[0] === '/Create' ? { err: new Error('exit 1'), stderr: 'ERROR: Access is denied.\r\n' } : {}))
    const s = scheduler.createScheduler({ kind: 'task-scheduler', run: refusing.run, fsImpl: memFs() })
    const daily = { every: 'day', time: '02:00' }
    expect(await s.install({ label: 'L', dir: 'C:\\app', run: 'x', schedule: daily, pathEnv: '' }))
      .toEqual({ ok: false, error: 'ERROR: Access is denied.', refused: true })
    const tooLong = await s.install({ label: 'L', dir: `C:\\${'a'.repeat(260)}`, run: 'x', schedule: daily, pathEnv: '' })
    expect(tooLong.ok).toBe(false)
    expect(tooLong.refused).toBeUndefined()

    const dry = fakeRun()
    const d = scheduler.createScheduler({ kind: 'task-scheduler', run: dry.run, fsImpl: memFs(), dryRun: true })
    expect(await d.install({ label: 'L', dir: 'C:\\app', run: 'x', schedule: daily, pathEnv: '' })).toEqual({ ok: true })
    expect(await d.remove('L')).toEqual({ ok: true })
    expect(await d.list()).toEqual([])
    expect(dry.calls).toEqual([])
  })

  it("macOS: the same interface writes today's plist and loads it with launchctl", async () => {
    const agentsDir = '/Users/me/Library/LaunchAgents'
    const loads = []
    const launchd = {
      loadLaunchAgent: async (plistPath, label) => { loads.push(['load', plistPath, label]); return { ok: true } },
      unloadLaunchAgent: async (label) => { loads.push(['unload', label]); return { ok: true } },
      harnessLaunchAgents: (_home, dir) => [{ label: 'com.promptly.harness.a-12345678', plistPath: `${dir}/com.promptly.harness.a-12345678.plist` }],
    }
    const fsFake = memFs()
    const s = scheduler.createScheduler({ kind: darwin.HARNESS_SCHEDULER, agentsDir, launchd, fsImpl: fsFake })
    expect(s.systemName).toBe('macOS')
    const dir = '/Users/me/My App'
    const label = s.labelFor(dir)
    expect(label).toBe(harness.agentLabel(dir))
    const job = { label, dir, run: 'bash .harness/run.sh', schedule: { every: 'weekday', time: '09:30' }, pathEnv: '/usr/bin' }
    expect(await s.install(job)).toEqual({ ok: true })
    const plistPath = `${agentsDir}/${label}.plist`
    expect(fsFake.files.get(plistPath)).toBe(harness.launchAgentPlist(job))
    expect(loads).toEqual([['load', plistPath, label]])
    expect(await s.has(label)).toBe(true)
    expect(await s.list()).toEqual([{ label: 'com.promptly.harness.a-12345678' }])
    expect(await s.remove(label)).toEqual({ ok: true })
    expect(loads.at(-1)).toEqual(['unload', label])
    expect(await s.has(label)).toBe(false)

    // launchctl refusing keeps the plist, so a retry can still find and stop the job.
    const refusing = { ...launchd, unloadLaunchAgent: async () => ({ ok: false, error: 'Operation not permitted' }), loadLaunchAgent: async () => ({ ok: false, error: 'Bootstrap failed' }) }
    const r = scheduler.createScheduler({ kind: 'launchd', agentsDir, launchd: refusing, fsImpl: fsFake })
    expect(await r.install(job)).toEqual({ ok: false, error: 'Bootstrap failed', refused: true })
    expect(await r.remove(label)).toEqual({ ok: false, error: 'Operation not permitted', refused: true })
    expect(fsFake.files.has(plistPath)).toBe(true)

    // Tests write the plist but never call launchctl.
    const quiet = []
    const noisy = { ...launchd, loadLaunchAgent: async () => quiet.push('load'), unloadLaunchAgent: async () => quiet.push('unload') }
    const d = scheduler.createScheduler({ kind: 'launchd', agentsDir, dryRun: true, launchd: noisy, fsImpl: memFs() })
    expect(await d.install(job)).toEqual({ ok: true })
    expect(await d.remove(label)).toEqual({ ok: true })
    expect(quiet).toEqual([])
  })

  // Mac only: reads a real folder with POSIX paths.
  it.skipIf(onWindows)('macOS: lists harness plists from the folder it is given', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-'))
    try {
      fs.writeFileSync(path.join(dir, 'com.promptly.harness.x-1.plist'), '')
      fs.writeFileSync(path.join(dir, 'com.other.plist'), '')
      expect(darwin.harnessLaunchAgents(null, dir)).toEqual([{ label: 'com.promptly.harness.x-1', plistPath: path.join(dir, 'com.promptly.harness.x-1.plist') }])
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
  })
})
