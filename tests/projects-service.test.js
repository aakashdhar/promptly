import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { createProjectService } = require('../main/projects/service.js')
const { createConfigStore } = require('../main/config.js')
const hasSqlite = (() => { try { require('node:sqlite'); return true } catch { return false } })()

// A stand-in for Claude: sorts folders, writes one fact per document, merges facts into the
// seven sections, and answers refresh diffs. Records every prompt it was given.
function fakeRun(log) {
  return async (prompt) => {
    log.push(prompt)
    if (prompt.includes('"folders"') && prompt.includes('Return ONLY this JSON')) {
      return { success: true, prompt: JSON.stringify({ folders: [{ rel: 'comms', kind: 'conversations' }, { rel: 'contracts', kind: 'agreements' }] }) }
    }
    if (prompt.includes('<documents>')) {
      const blocks = [...prompt.matchAll(/<path>([^<]+)<\/path>\n<tag>([^<]+)<\/tag>/g)]
      return { success: true, prompt: blocks.map(([, rel, tag]) => `## ${rel}\n- Aparna Rao (client) asked about ${path.basename(rel)} ${tag}`).join('\n') }
    }
    if (prompt.includes('Return ONLY') && prompt.includes('"latest"')) {
      return { success: true, prompt: JSON.stringify({ add: [], change: [], retire: [], latest: [] }) }
    }
    const tags = [...new Set([...prompt.matchAll(/\[source: [^\]]+\]/g)].map((m) => m[0]))]
    return { success: true, prompt: ['## The project', `- Video learning portal. ${tags[0] || ''}`, '## People', `- **Aparna Rao**, client product owner. ${tags[0] || ''}`, '## How they like to be written to', '## Agreed', '## Open right now', '## Latest activity', '## Words', `- Infer360 ${tags[0] || ''}`].join('\n') }
  }
}

let root, userData, projectDir, prompts, service, events

function write(rel, text) {
  const file = path.join(projectDir, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-service-'))
  userData = path.join(root, 'userData')
  projectDir = path.join(root, 'Infer360')
  fs.mkdirSync(userData, { recursive: true })
  write('README.md', '# Infer360\nVideo learning portal for the client.')
  write('comms/2026-10-04 Aparna.md', 'From: Aparna Rao <aparna@client.com>\nDate: 4 Oct 2026\nSubject: Access email\n\nCan you add a copyable link under the button? Tenant ID is coming.')
  write('contracts/SOW.md', '# SOW phase 2\nAnalytics, SSO and email fixes. Go-live 31 Oct 2026.')
  write('codebase/package.json', '{}')
  write('codebase/index.js', 'module.exports = 1')
  prompts = []
  events = []
  const config = createConfigStore(path.join(userData, 'config.json'))
  service = createProjectService({ config, userData, run: fakeRun(prompts), emit: (name, payload) => events.push([name, payload]), watchImpl: () => ({ on() {}, close() {} }) })
})

afterEach(() => {
  service.stop()
  fs.rmSync(root, { recursive: true, force: true })
})

async function connected() {
  const scan = await service.connect(projectDir)
  const map = await service.classify(scan.token)
  const folders = Object.fromEntries(map.folders.map((f) => [f.rel, { kind: f.kind, on: f.on }]))
  const { id } = await service.save({ token: scan.token, role: 'manager', writes: ['client-emails'], folders })
  await waitFor(() => !service.list()[0].building && service._store.get(id).summaryUpdatedAt)
  return id
}

async function waitFor(check, ms = 5000) {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 20))
  }
}

describe('project service (PRJ-009)', () => {
  it('connect scans locally, refuses a second connect of the same folder, and leaves code out of the map', async () => {
    const scan = await service.connect(projectDir)
    expect(scan.token).toMatch(/^[0-9a-f]{24}$/)
    expect(scan.name).toBe('Infer360')
    const map = await service.classify(scan.token)
    const byRel = Object.fromEntries(map.folders.map((f) => [f.rel, f]))
    expect(byRel[''].kind).toBe('overview')
    expect(byRel.comms.kind).toBe('conversations')
    expect(byRel.codebase.on).toBe(false)
    // Code was never sent to Claude.
    expect(prompts.join('\n')).not.toContain('module.exports')
    await service.save({ token: scan.token, folders: Object.fromEntries(map.folders.map((f) => [f.rel, { kind: f.kind, on: f.on }])) })
    expect((await service.connect(projectDir)).error).toMatch(/Already connected as Infer360/)
  })

  it('save writes the summary from the switched-on files and marks them as in the summary', async () => {
    const id = await connected()
    const summary = service.getSummary(id)
    expect(summary.text).toContain('## People')
    expect(summary.text).toContain('Aparna Rao')
    const p = service.list()[0]
    expect(p.newFiles).toBe(0)
    expect(p.summaryFileCount).toBe(3)
    expect(events.some(([n, e]) => n === 'project-progress' && e.finished)).toBe(true)
    expect(fs.existsSync(path.join(projectDir, 'PROMPTLY.md'))).toBe(false)
  })

  it('a new file counts as new, is found by the next request without a refresh, and refresh clears the count', async () => {
    const id = await connected()
    write('comms/2026-10-06 Shrikant.md', 'From: Shrikant <s@client.com>\nDate: 6 Oct 2026\nSubject: Tenant\n\nThe tenant ID is 7f3a-tenant.')
    await service._sync(id)
    expect(service.list()[0].newFiles).toBe(1)
    const prep = await service.prepare({ id, transcript: 'reply to Shrikant about the tenant ID' })
    expect(prep.output).toBe('email')
    expect(prep.block).toContain('<project name="Infer360">')
    if (hasSqlite) {
      expect(prep.block).toContain('7f3a-tenant')
      expect(prep.sources.map((s) => s.rel)).toContain('comms/2026-10-06 Shrikant.md')
    }
    const r = await service.refresh(id)
    expect(r.ok).toBe(true)
    expect(service.list()[0].newFiles).toBe(0)
  })

  it('switching a folder off drops its files from the cache and the requests', async () => {
    const id = await connected()
    const folders = { ...service._store.get(id).folders, contracts: { kind: 'agreements', on: false } }
    service.update(id, { folders })
    await service._sync(id)
    expect(fs.existsSync(path.join(userData, 'projects', id, 'text', 'contracts', 'SOW.md.txt'))).toBe(false)
    const prep = await service.prepare({ id, transcript: 'write a prompt for the SOW go-live' })
    expect(prep.output).toBe('prompt')
    expect(prep.sources.map((s) => s.rel)).not.toContain('contracts/SOW.md')
  })

  it('an edited summary keeps the person\'s line through a refresh', async () => {
    const id = await connected()
    const before = service.getSummary(id).text
    const edited = before.replace('## People', '## People\n- Dhananjay leads the access emails.')
    service.setSummary(id, edited)
    expect(service.getSummary(id).pins.some((p) => p.text.includes('Dhananjay'))).toBe(true)
    await service.refresh(id)
    expect(service.getSummary(id).text).toContain('Dhananjay leads the access emails.')
  })

  it('suggests the project from a person named in a dictation, and nothing otherwise', async () => {
    const id = await connected()
    expect(service.suggest('Reply to Aparna about the link')).toMatchObject({ id, output: 'email' })
    expect(service.suggest('buy milk on the way home')).toBeNull()
  })

  it('maps Look-deeper file paths back to project paths, and nothing outside the cache', async () => {
    const id = await connected()
    const textDir = path.join(userData, 'projects', id, 'text')
    expect(service.relFromCache(id, path.join(textDir, 'comms', '2026-10-04 Aparna.md.txt'))).toBe('comms/2026-10-04 Aparna.md')
    expect(service.relFromCache(id, path.join(projectDir, 'comms', '2026-10-04 Aparna.md'))).toBeNull()
    expect(service.relFromCache(id, path.join(textDir, '..', 'summary.md'))).toBeNull()
  })

  it('remove deletes Promptly\'s copy and never the folder', async () => {
    const id = await connected()
    service.remove(id)
    expect(fs.existsSync(path.join(userData, 'projects', id))).toBe(false)
    expect(fs.existsSync(path.join(projectDir, 'comms', '2026-10-04 Aparna.md'))).toBe(true)
    expect(service.list()).toEqual([])
  })

  it('a missing folder is reported instead of running', async () => {
    const id = await connected()
    fs.rmSync(projectDir, { recursive: true, force: true })
    expect(service.list()[0].missing).toBe(true)
    expect((await service.prepare({ id, transcript: 'reply to Aparna' })).error).toMatch(/can't find the Infer360 folder/)
  })
})
