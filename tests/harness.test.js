import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'module'
import fs from 'fs'
import os from 'os'
import path from 'path'

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

    it('writes the files, makes scripts executable, and merges settings', () => {
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

  it('writes a launchd job that runs the harness from the project folder', () => {
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
