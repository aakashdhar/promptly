import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'module'
import fs from 'fs'
import os from 'os'
import path from 'path'

const require = createRequire(import.meta.url)
const { createProjectStore, PROJECT_COLORS, defaultOutputFor } = require('../main/projects/store.js')
const { createConfigStore } = require('../main/config.js')
const MODES = require('../shared/modes.json')

let tmp, config, dataDir, store, folderA, folderB

function makeFolder(name, files = {}) {
  const dir = path.join(tmp, name)
  fs.mkdirSync(dir, { recursive: true })
  for (const [rel, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, rel), text)
  return fs.realpathSync.native(dir)
}

// Every file under dir with its size and mtime, to prove a folder was left exactly as it was.
function snapshot(dir) {
  const out = {}
  for (const rel of fs.readdirSync(dir, { recursive: true })) {
    const st = fs.statSync(path.join(dir, rel))
    out[rel] = `${st.isDirectory() ? 'dir' : st.size}:${st.mtimeMs}`
  }
  return out
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-store-'))
  config = createConfigStore(path.join(tmp, 'userData', 'config.json'))
  config.write({ model: 'sonnet', dictionary: 'Infer360' })
  dataDir = path.join(tmp, 'userData', 'projects')
  folderA = makeFolder('Infer360', { 'notes.md': '# Kickoff', 'mail.eml': 'From: a@b.c' })
  folderB = makeFolder('Acme Sales', { 'deal.txt': 'Pricing' })
  store = createProjectStore({ config, dataDir })
})

afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }))

describe('project store: create', () => {
  it('saves a record with every field of the data model and its defaults', () => {
    const p = store.create({ dir: folderA, role: 'manager', writes: ['client-emails', 'team-prompts'], folders: { comms: { kind: 'conversations', on: true } } })
    expect(p).toEqual({
      id: p.id, name: 'Infer360', dir: folderA, color: '#E3B341', role: 'manager',
      writes: ['client-emails', 'team-prompts'], defaultOutput: 'email',
      folders: { comms: { kind: 'conversations', on: true } },
      lookDeeper: true, keepInFolder: false, wrotePromptlyMd: false,
      summaryUpdatedAt: null, summaryFileCount: 0, lastUsedAt: null,
    })
    expect(p.id).toMatch(/^[0-9a-f]{8}$/)
    expect(store.list()).toEqual([p])
    expect(store.get(p.id)).toEqual(p)
    expect(store.get('ffffffff')).toBeNull()
    // Lives in config.json next to the user's other settings, which are kept.
    expect(config.read()).toMatchObject({ model: 'sonnet', dictionary: 'Infer360', projects: [p] })
  })

  it('takes the name, Look deeper and Keep in folder from the connect flow; defaults the rest', () => {
    const p = store.create({ dir: folderA, name: '  Infer 360  ', lookDeeper: false, keepInFolder: true })
    expect(p).toMatchObject({ name: 'Infer 360', lookDeeper: false, keepInFolder: true, role: 'other', writes: [], defaultOutput: 'prompt', folders: {} })
    // System fields can't be set at creation.
    const q = store.create({ dir: folderB, name: ' ', wrotePromptlyMd: true, summaryFileCount: 9, id: 'deadbeef', color: '#000000' })
    expect(q).toMatchObject({ name: 'Acme Sales', wrotePromptlyMd: false, summaryFileCount: 0, color: '#5AC8A8' })
    expect(q.id).not.toBe('deadbeef')
  })

  it('keeps only known roles, writes and folder kinds, and folder keys inside the project', () => {
    const p = store.create({
      dir: folderA, role: 'ceo',
      writes: ['status-updates', 'poems', 'client-emails', 'client-emails'],
      folders: {
        '': { kind: 'overview' }, comms: { kind: 'conversations', on: false }, _legacy: { kind: 'exclude' },
        '../secrets': { kind: 'reference', on: true }, '/etc': { kind: 'reference' }, 'C:/Windows': { kind: 'reference' },
        'a\\b': { kind: 'reference' }, specs: { kind: 'spreadsheets' }, notes: null,
      },
    })
    expect(p.role).toBe('other')
    expect(p.writes).toEqual(['client-emails', 'status-updates'])
    // An exclude row starts switched off unless the person turned it on.
    expect(p.folders).toEqual({ '': { kind: 'overview', on: true }, comms: { kind: 'conversations', on: false }, _legacy: { kind: 'exclude', on: false } })
  })

  it('stores the real path, and never writes into the folder', () => {
    const before = snapshot(folderA)
    const link = path.join(tmp, 'shortcut')
    // A junction on Windows needs no admin rights (CI); elsewhere the type is ignored.
    fs.symlinkSync(folderA, link, 'junction')
    const p = store.create({ dir: path.join(link, '.') + path.sep })
    expect(p.dir).toBe(folderA)
    expect(snapshot(folderA)).toEqual(before)
    expect(fs.existsSync(dataDir)).toBe(false)
  })

  it('refuses a missing folder or a file', () => {
    expect(() => store.create({ dir: path.join(tmp, 'gone') })).toThrow('Folder not found')
    expect(() => store.create({ dir: path.join(folderA, 'notes.md') })).toThrow('Folder not found')
    expect(() => store.create({})).toThrow('Choose a folder')
    expect(store.list()).toEqual([])
  })
})

describe('project store: two projects on one folder (spec §8)', () => {
  it('refuses the same folder again with the existing project\'s name', () => {
    store.create({ dir: folderA, name: 'Infer360 PM' })
    expect(() => store.create({ dir: folderA, name: 'Again' })).toThrow('Already connected as Infer360 PM')
    expect(store.list()).toHaveLength(1)
  })

  it('sees through symlinks, trailing slashes and relative paths', () => {
    store.create({ dir: folderA, name: 'Infer360 PM' })
    const link = path.join(tmp, 'alias')
    fs.symlinkSync(folderA, link, 'junction')
    expect(() => store.create({ dir: link })).toThrow('Already connected as Infer360 PM')
    expect(() => store.create({ dir: folderA + path.sep })).toThrow('Already connected as Infer360 PM')
    expect(() => store.create({ dir: path.relative(process.cwd(), folderA) })).toThrow('Already connected as Infer360 PM')
    expect(store.findByDir(link).name).toBe('Infer360 PM')
    expect(store.findByDir(folderB)).toBeNull()
    expect(store.findByDir('')).toBeNull()
    expect(store.findByDir(path.join(tmp, 'missing'))).toBeNull()
  })

  const caseInsensitive = fs.existsSync(path.join(os.tmpdir().toUpperCase()))
  it.skipIf(!caseInsensitive)('treats a different letter case as the same folder where the disk does', () => {
    store.create({ dir: folderA, name: 'Infer360 PM' })
    const otherCase = path.join(path.dirname(folderA), 'INFER360')
    expect(() => store.create({ dir: otherCase })).toThrow('Already connected as Infer360 PM')
  })

  it('allows the folder again once its project is removed', () => {
    const p = store.create({ dir: folderA })
    store.remove(p.id)
    expect(store.create({ dir: folderA }).dir).toBe(folderA)
  })
})

describe('project store: ids and colours', () => {
  it('uses 8 lowercase hex ids, retrying a clash or a bad value from the generator', () => {
    const ids = ['ABCDEF01', 'abcdef01', 'nothex!!', '1234', '0badc0de']
    const s = createProjectStore({ config, dataDir, randomId: () => ids.shift() })
    expect(s.create({ dir: folderA }).id).toBe('abcdef01')
    expect(s.create({ dir: folderB }).id).toBe('0badc0de')
    const stuck = createProjectStore({ config, dataDir, randomId: () => 'abcdef01' })
    expect(() => stuck.create({ dir: makeFolder('Third') })).toThrow('Could not make a project id')
  })

  it('gives each project the next unused colour, reusing a freed one first', () => {
    const dirs = Array.from({ length: 9 }, (_, i) => makeFolder(`p${i}`))
    const made = dirs.slice(0, 8).map(dir => store.create({ dir }))
    expect(made.map(p => p.color)).toEqual(PROJECT_COLORS)
    expect(made.slice(0, 2).map(p => p.color)).toEqual(['#E3B341', '#5AC8A8'])
    store.remove(made[2].id)
    expect(store.create({ dir: dirs[8] }).color).toBe(PROJECT_COLORS[2])
    // All eight in use: the least used comes round again.
    expect(store.create({ dir: makeFolder('p9') }).color).toBe(PROJECT_COLORS[0])
    expect(store.create({ dir: makeFolder('p10') }).color).toBe(PROJECT_COLORS[1])
  })

  // OKLab and WCAG contrast, to check the palette against the mode tones and both themes.
  const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  const lum = rgb => { const [r, g, b] = rgb.map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const oklab = rgb => {
    const [r, g, b] = rgb.map(lin)
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]
  }
  const fromOklab = ([L, a, b]) => {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    const enc = c => { c = Math.min(1, Math.max(0, c)); return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) }
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s].map(enc)
  }
  const distance = (a, b) => { const p = oklab(a), q = oklab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) }
  // readableColor(): color-mix(in oklab, colour <strength>, ink), per theme in index.css.
  const mixToward = (rgb, ink, strength) => { const p = oklab(rgb), q = oklab(ink); return fromOklab(p.map((v, i) => strength * v + (1 - strength) * q[i])) }
  const DARK = { bg: rgbOf('#1C1C1F'), ink: [236, 236, 240], strength: 0.64 }
  const LIGHT = { bg: rgbOf('#F4F4F6'), ink: [28, 28, 32], strength: 0.46 }

  it('has 8 different colours, each set apart from every mode tone', () => {
    expect(PROJECT_COLORS).toHaveLength(8)
    for (const c of PROJECT_COLORS) expect(c).toMatch(/^#[0-9A-F]{6}$/)
    const tones = MODES.modes.filter(m => m.tone).flatMap(m => [m.tone.rgb, m.tone.text]).map(t => t.split(',').map(Number))
    // Twice the gap between the two closest mode colours today (Polish and Workflow greens, ~0.017).
    for (const c of PROJECT_COLORS) for (const t of tones) expect(distance(rgbOf(c), t)).toBeGreaterThan(0.035)
    for (const a of PROJECT_COLORS) for (const b of PROJECT_COLORS) if (a !== b) expect(distance(rgbOf(a), rgbOf(b))).toBeGreaterThan(0.06)
  })

  it('reads on the dark and light window, as a dot and as coloured text', () => {
    const faintestModeOnLight = Math.min(...MODES.modes.filter(m => m.tone).map(m => contrast(m.tone.rgb.split(',').map(Number), LIGHT.bg)))
    for (const c of PROJECT_COLORS) {
      const rgb = rgbOf(c)
      expect(contrast(rgb, DARK.bg)).toBeGreaterThanOrEqual(4.5)
      // A dot on light is about as visible as the faintest mode dot already is (gold, like Polish green, is a light colour).
      expect(contrast(rgb, LIGHT.bg)).toBeGreaterThanOrEqual(faintestModeOnLight - 0.1)
      for (const theme of [DARK, LIGHT]) expect(contrast(mixToward(rgb, theme.ink, theme.strength), theme.bg)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('defaultOutputFor (spec §17)', () => {
  it('Client emails → Email, then Prompts for the team → Prompt, then Status updates → Polish', () => {
    expect(defaultOutputFor(['client-emails'])).toBe('email')
    expect(defaultOutputFor(['team-prompts'])).toBe('prompt')
    expect(defaultOutputFor(['status-updates'])).toBe('polish')
    expect(defaultOutputFor(['status-updates', 'team-prompts', 'client-emails'])).toBe('email')
    expect(defaultOutputFor(['status-updates', 'team-prompts'])).toBe('prompt')
    expect(defaultOutputFor(['other', 'status-updates'])).toBe('polish')
  })

  it('only "Something else" or nothing → Prompt', () => {
    expect(defaultOutputFor(['other'])).toBe('prompt')
    expect(defaultOutputFor([])).toBe('prompt')
    expect(defaultOutputFor(undefined)).toBe('prompt')
    expect(defaultOutputFor('client-emails')).toBe('prompt')
  })

  it('sets a new project\'s default from what they write', () => {
    expect(store.create({ dir: folderA, writes: ['status-updates'] }).defaultOutput).toBe('polish')
    expect(store.create({ dir: folderB, writes: ['other'] }).defaultOutput).toBe('prompt')
  })
})

describe('project store: update', () => {
  it('changes the fields a patch names and nothing else, and saves them', () => {
    const p = store.create({ dir: folderA, writes: ['client-emails'] })
    const now = Date.now()
    const u = store.update(p.id, { name: 'Infer360 v2', lookDeeper: false, keepInFolder: true, wrotePromptlyMd: true, summaryUpdatedAt: now, summaryFileCount: 96, lastUsedAt: now, folders: { comms: { kind: 'conversations', on: true } }, color: '#4fb8e0' })
    expect(u).toEqual({ ...p, name: 'Infer360 v2', lookDeeper: false, keepInFolder: true, wrotePromptlyMd: true, summaryUpdatedAt: now, summaryFileCount: 96, lastUsedAt: now, folders: { comms: { kind: 'conversations', on: true } }, color: '#4FB8E0' })
    expect(store.get(p.id)).toEqual(u)
    expect(store.update(p.id, { summaryUpdatedAt: null, lastUsedAt: null })).toMatchObject({ summaryUpdatedAt: null, lastUsedAt: null })
  })

  it('never changes the id or the folder, and ignores unknown keys and bad values', () => {
    const p = store.create({ dir: folderA, role: 'manager' })
    const u = store.update(p.id, {
      id: 'deadbeef', dir: folderB, evil: true,
      name: '   ', role: 'ceo', writes: 'client-emails', defaultOutput: 'tweet', folders: [], lookDeeper: 'yes',
      summaryFileCount: -1, summaryUpdatedAt: 'today', lastUsedAt: NaN, color: 'red',
    })
    expect(u).toEqual(p)
    expect(store.get(p.id)).toEqual(p)
    expect(store.get('deadbeef')).toBeNull()
    expect(store.get(p.id)).not.toHaveProperty('evil')
  })

  it('moves the default output with what they write, unless the patch sets one', () => {
    const p = store.create({ dir: folderA, writes: ['client-emails'] })
    expect(store.update(p.id, { writes: ['team-prompts', 'status-updates'] })).toMatchObject({ writes: ['team-prompts', 'status-updates'], defaultOutput: 'prompt' })
    expect(store.update(p.id, { writes: ['client-emails'], defaultOutput: 'polish' })).toMatchObject({ defaultOutput: 'polish' })
    expect(store.update(p.id, { defaultOutput: 'email' })).toMatchObject({ writes: ['client-emails'], defaultOutput: 'email' })
    expect(store.update(p.id, { writes: [] }).defaultOutput).toBe('prompt')
  })

  it('throws for a project that doesn\'t exist', () => {
    expect(() => store.update('ffffffff', { name: 'x' })).toThrow('Project not found')
  })
})

describe('project store: remove and paths', () => {
  it('lays out Promptly\'s copy of a project in dataDir/<id>', () => {
    const p = store.create({ dir: folderA })
    const root = path.join(path.resolve(dataDir), p.id)
    expect(store.paths(p.id)).toEqual({
      root,
      summary: path.join(root, 'summary.md'),
      pins: path.join(root, 'pins.json'),
      manifest: path.join(root, 'manifest.json'),
      text: path.join(root, 'text'),
      db: path.join(root, 'search.db'),
    })
    // Working out the paths creates nothing.
    expect(fs.existsSync(root)).toBe(false)
  })

  it('deletes only dataDir/<id> and the record; the folder and other projects are untouched', () => {
    const a = store.create({ dir: folderA })
    const b = store.create({ dir: folderB })
    for (const p of [a, b]) {
      const pp = store.paths(p.id)
      fs.mkdirSync(path.join(pp.text, 'comms'), { recursive: true })
      fs.writeFileSync(pp.summary, '## The project')
      fs.writeFileSync(path.join(pp.text, 'comms', 'mail.eml.txt'), 'hi')
    }
    fs.writeFileSync(path.join(folderA, 'PROMPTLY.md'), '# Summary')
    fs.writeFileSync(path.join(dataDir, 'keep.txt'), 'other data')
    const before = snapshot(folderA)

    store.remove(a.id)
    expect(fs.existsSync(store.paths(a.id).root)).toBe(false)
    expect(store.list().map(p => p.id)).toEqual([b.id])
    expect(snapshot(folderA)).toEqual(before)
    expect(fs.readFileSync(store.paths(b.id).summary, 'utf8')).toBe('## The project')
    expect(fs.readFileSync(path.join(dataDir, 'keep.txt'), 'utf8')).toBe('other data')
    expect(config.read()).toMatchObject({ model: 'sonnet', dictionary: 'Infer360' })
  })

  it('removes a project that has no data yet, and an id it doesn\'t know is a no-op', () => {
    const a = store.create({ dir: folderA })
    store.remove(a.id)
    expect(store.list()).toEqual([])
    expect(() => store.remove('ffffffff')).not.toThrow()
  })

  it('refuses any id that could reach outside dataDir', () => {
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(path.join(dataDir, 'keep.txt'), 'x')
    for (const bad of ['', '..', '../..', '../userData', '.', '/', 'abc', 'ABCDEF01', 'abcdef01/..', null, undefined, 42]) {
      expect(() => store.remove(bad)).toThrow('Invalid project id')
      expect(() => store.paths(bad)).toThrow('Invalid project id')
    }
    expect(fs.readFileSync(path.join(dataDir, 'keep.txt'), 'utf8')).toBe('x')
    expect(fs.existsSync(folderA)).toBe(true)
  })

  it('keeps the project listed when its data can\'t be deleted, so Remove can be retried', () => {
    const failing = { ...fs, rmSync: () => { throw new Error('EBUSY: search.db is open') } }
    const s = createProjectStore({ config, dataDir, fsImpl: failing })
    const p = s.create({ dir: folderA })
    expect(() => s.remove(p.id)).toThrow('EBUSY')
    expect(s.get(p.id)).not.toBeNull()
  })
})

describe('project store: reading config.json', () => {
  it('lists nothing when there are no projects, and skips entries that aren\'t projects', () => {
    expect(store.list()).toEqual([])
    config.update({ projects: 'oops' })
    expect(store.list()).toEqual([])
    config.update({ projects: [null, 'x', { name: 'no id' }, { id: 'abcdef01', name: 'Ok', dir: folderA }] })
    expect(store.list()).toEqual([{ id: 'abcdef01', name: 'Ok', dir: folderA }])
    expect(() => store.create({ dir: folderA })).toThrow('Already connected as Ok')
  })
})
