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
})
