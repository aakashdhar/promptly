import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { buildModePrompt, loadPrompt } = require('../main/prompts.js')
const main = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'main.js'), 'utf8')

describe('project requests (PRJ-009)', () => {
  it('puts the project block first in the context, and leaves other prompts exactly as before', () => {
    const block = '<project name="Acme"><summary>- Fee is 40k</summary></project>'
    const withProject = buildModePrompt('reply to Aparna', 'email', { context: { project: block, voiceNotes: '- Short emails' } })
    expect(withProject.indexOf(block)).toBeGreaterThan(-1)
    expect(withProject.indexOf(block)).toBeLessThan(withProject.indexOf('<how_i_write>'))
    const plain = buildModePrompt('reply to Aparna', 'email', { context: { voiceNotes: '- Short emails' } })
    expect(plain).not.toContain('<project')
    expect(plain).toBe(buildModePrompt('reply to Aparna', 'email', { context: { voiceNotes: '- Short emails', project: '' } }))
  })

  it('Look deeper runs read-only over the text copy, and falls back to an ordinary run', () => {
    expect(main).toMatch(/tools: \['Read', 'Grep', 'Glob'\], cwd: prep\.textDir, maxTurns: 12/)
    expect(main).toMatch(/if \(!result\) result = await claude\.run\(prompt, \{ onDelta \}\)/)
    expect(loadPrompt('project-look-deeper')).toMatch(/Never mention the files/)
  })

  it('folders are only ever picked in main', () => {
    expect(main).toMatch(/ipcMain\.handle\('project-connect'[\s\S]*?pickFolder\('Connect a project folder'\)/)
    expect(main).toMatch(/ipcMain\.handle\('project-locate'[\s\S]*?pickFolder\('Locate the project folder'\)/)
    expect(main).not.toMatch(/ipcMain\.handle\('project-[a-z-]+', projectCall\(\(dir/)
  })
})
