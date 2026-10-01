import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { PROMPT_TARGETS, buildRetargetPrompt, getMode } = require('../main/prompts.js')
const root = path.resolve(import.meta.dirname, '..')

describe('rewriting a prompt for another AI', () => {
  it('starts as written for Claude, and every other AI has its own guide', () => {
    expect(PROMPT_TARGETS[0].key).toBe('claude')
    expect(PROMPT_TARGETS.map((t) => t.key)).toEqual(['claude', 'gemini', 'openai', 'grok', 'standard'])
    for (const t of PROMPT_TARGETS.slice(1)) {
      expect(fs.existsSync(path.join(root, 'main/prompts', `target-${t.key}.txt`)), t.key).toBe(true)
    }
  })

  it('keeps the prompt and what you said word for word, with the target AI\'s guide', () => {
    const prompt = 'Goal:\nBuild the $& dashboard.\n\nRequirements:\n- Flag tickets older than 4 hours.'
    const said = 'so for the support dashboard, um, flag anything waiting more than like four hours'
    const out = buildRetargetPrompt({ prompt, transcript: said, mode: getMode('prompt'), target: PROMPT_TARGETS[1] })
    expect(out).toContain(`<original>\n${prompt}\n</original>`)
    expect(out).toContain(`<said>\n${said}\n</said>`)
    expect(out).toContain('works as well as possible in Gemini')
    expect(out).toContain(fs.readFileSync(path.join(root, 'main/prompts/target-gemini.txt'), 'utf8').trim().split('\n')[0])
    expect(out).not.toMatch(/\{(KIND|TARGET|GUIDE|SAID|PROMPT)\}/)
  })

  it('names what is being rewritten: a coding agent brief for Code, a prompt for Prompt', () => {
    const code = buildRetargetPrompt({ prompt: 'x', mode: getMode('code'), target: PROMPT_TARGETS[2] })
    expect(code).toContain('rewrite a finished task brief for a coding agent so it works as well as possible in ChatGPT')
    const plain = buildRetargetPrompt({ prompt: 'x', mode: getMode('prompt'), target: PROMPT_TARGETS[4] })
    expect(plain).toContain('rewrite a finished prompt so it works as well as possible in Standard')
    expect(plain).toContain('(not available)')
  })

  it('is offered only on prompt results', () => {
    const offered = JSON.parse(fs.readFileSync(path.join(root, 'shared/modes.json'), 'utf8')).modes.filter((m) => m.promptStyle).map((m) => m.key)
    expect(offered).toEqual(['prompt', 'code', 'design'])
    const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8')
    expect(main).toMatch(/if \(!t \|\| t === PROMPT_TARGETS\[0\] \|\| !m\.promptStyle\)/)
  })
})

describe('other AIs\' versions in history', () => {
  const realStorage = globalThis.localStorage
  afterEach(() => { globalThis.localStorage = realStorage })
  const memoryStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } }

  it('are kept on the entry with the original prompt, so reopening it needs no new call', async () => {
    globalThis.localStorage = memoryStorage()
    const { saveToHistory, saveTargetVersion, getTargetVersions, getHistory } = await import('../src/renderer/utils/history.js')
    saveToHistory({ transcript: 'make a dashboard', prompt: 'Goal:\nA dashboard.', mode: 'prompt' })
    expect(getTargetVersions('Goal:\nA dashboard.')).toEqual({})
    saveTargetVersion('Goal:\nA dashboard.', 'gemini', '## Task\nA dashboard.')
    saveTargetVersion('Goal:\nA dashboard.', 'grok', 'Build a dashboard.')
    expect(getTargetVersions('Goal:\nA dashboard.')).toEqual({ gemini: '## Task\nA dashboard.', grok: 'Build a dashboard.' })
    expect(getHistory()[0].prompt).toBe('Goal:\nA dashboard.')
    saveTargetVersion('not in history', 'gemini', 'x')
    expect(getTargetVersions('not in history')).toEqual({})
  })
})
