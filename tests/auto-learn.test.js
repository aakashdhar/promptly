import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { newRules, appendRules, removeRules, MAX_NOTES } = require('../main/profile.js')
const { buildLearnFromEditPrompt } = require('../main/prompts.js')
const main = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'main.js'), 'utf8')

describe('learning from one edit (D-AUTO-LEARN)', () => {
  it('takes only new "- " lines from the answer, at most two', () => {
    expect(newRules('NONE')).toEqual([])
    expect(newRules('')).toEqual([])
    expect(newRules('Sure! Here are notes:\n- Opens with "Hey", not "Hi".')).toEqual(['Opens with "Hey", not "Hi".'])
    expect(newRules('- One\n- Two\n- Three')).toEqual(['One', 'Two'])
    // Already in the notes (any case, any punctuation) or repeated: left out.
    expect(newRules('- short sentences!\n- Signs off "Cheers"\n- Signs off "Cheers"', '- Short sentences.')).toEqual(['Signs off "Cheers"'])
  })

  it('adds lines to the end of the notes without touching the rest, and Undo takes only those back', () => {
    const notes = 'Short sentences.\nBritish spelling.'
    const added = appendRules(notes, ['Opens with "Hey", not "Hi".'])
    expect(added).toBe('Short sentences.\nBritish spelling.\n- Opens with "Hey", not "Hi".')
    expect(appendRules('', ['A'])).toBe('- A')
    expect(appendRules('x'.repeat(MAX_NOTES), ['A'])).toBeNull()
    // The user edited the notes in between: Undo still removes just the learned line.
    expect(removeRules(added + '\nNo exclamation marks.', ['Opens with "Hey", not "Hi".'])).toBe('Short sentences.\nBritish spelling.\nNo exclamation marks.')
  })

  it('shows Claude the current notes and the edit, word for word', () => {
    const out = buildLearnFromEditPrompt({ current: '- Short sentences.', before: 'Hi team,\nThe $& release…', after: 'Hey team,\nThe $& release…' })
    expect(out).toContain('Work out what this one edit shows')
    expect(out).toContain('<current_notes>\n- Short sentences.\n</current_notes>')
    expect(out).toContain('<before>\nHi team,\nThe $& release…\n</before>')
    expect(out).toContain('<after>\nHey team,\nThe $& release…\n</after>')
    expect(buildLearnFromEditPrompt({ before: 'a', after: 'b' })).not.toContain('current_notes')
  })

  it('learns after every recorded edit, notes only from Email and Polish, and respects the switch', () => {
    expect(main).toMatch(/if \(recorded\) learnFromEdit\(\{ mode, before, after \}\)/)
    expect(main).toMatch(/if \(getMode\(mode\)\.profile !== 'voice'\) return;/)
    expect(main).toMatch(/autoLearn: stored\.autoLearn !== false/)
    expect((main.match(/autoLearn === false\) return;/g) || []).length).toBe(2)
  })
})
