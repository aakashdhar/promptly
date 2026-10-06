import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { openIndex, chunkText, queryTerms } = require('../main/projects/search.js')

// node:sqlite needs Node 22.5+; the Node on PATH may be older. `npm run test:sqlite` runs this
// file under Electron's Node 24, the one the app uses.
const hasSqlite = (() => { try { require('node:sqlite'); return true } catch { return false } })()

const STANDUP = {
  rel: 'meetings/2026-10-02-standup.md', kind: 'conversations', date: '2026-10-02', sender: '', title: 'Standup 2 Oct',
  text: 'Rahul is blocked on single sign-on: the client still has not sent the tenant ID for Azure AD.\n\nDemo moved to Friday. SSO work resumes once the tenant ID arrives.',
}
const SSO_EMAIL = {
  rel: 'comms/sso-setup.eml', kind: 'conversations', date: '2026-10-01', sender: 'Aparna Rao <aparna@client.com>', title: 'SSO setup for the pilot',
  text: 'Hi team,\n\nTo finish SSO on our side we need your tenant ID and the redirect URI. Can you send both this week?\n\nThanks, Aparna',
}
const INVOICES = {
  rel: 'agreements/invoices.md', kind: 'agreements', date: '2026-09-15', sender: '', title: 'How invoicing works',
  text: 'Every invoice carries a purchase order ID. Payment is due 30 days after the invoice date.',
}
const UNRELATED = [
  { rel: 'agreements/sow.md', kind: 'agreements', date: '2026-08-01', sender: '', title: 'Statement of work', text: 'Phase 1 covers the dashboard and reports. 40% is paid on signing, the rest on delivery.' },
  { rel: 'reference/brand.md', kind: 'reference', date: '2026-08-20', sender: '', title: 'Brand colours', text: 'Primary colour is teal. Headings use the brand typeface; body text stays at 15 px.' },
  { rel: 'build/api-notes.md', kind: 'build', date: '2026-09-30', sender: '', title: 'API notes', text: 'The reports endpoint is rate limited. Retries back off exponentially up to five times.' },
  { rel: 'meetings/2026-09-20-kickoff.md', kind: 'conversations', date: '2026-09-20', sender: '', title: 'Kickoff', text: 'We agreed the launch date and the weekly status call on Mondays.' },
]

const dirs = []
const indexes = []
function tempIndex(...parts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-search-'))
  dirs.push(dir)
  const dbPath = path.join(dir, ...(parts.length ? parts : ['search.db']))
  const index = openIndex(dbPath)
  indexes.push(index)
  return { index, dbPath }
}
function filled() {
  const made = tempIndex()
  for (const doc of [STANDUP, SSO_EMAIL, INVOICES, ...UNRELATED]) made.index.upsert(doc)
  return made
}
function rowCount(dbPath, rel) {
  const { DatabaseSync } = require('node:sqlite')
  const db = new DatabaseSync(dbPath)
  try {
    return db.prepare('SELECT count(*) AS n FROM chunks WHERE rel = ?').get(rel).n
  } finally {
    db.close()
  }
}

afterEach(() => {
  // Windows can't delete an open database file, so close first.
  while (indexes.length) indexes.pop().close()
  while (dirs.length) fs.rmSync(dirs.pop(), { recursive: true, force: true })
})

describe('chunkText', () => {
  it('keeps short text as one chunk and gives nothing for empty text', () => {
    expect(chunkText('Hello there.')).toEqual(['Hello there.'])
    expect(chunkText('')).toEqual([])
    expect(chunkText('   \n\n  ')).toEqual([])
    expect(chunkText(null)).toEqual([])
    expect(chunkText('one\r\ntwo')).toEqual(['one\ntwo'])
  })

  it('packs whole paragraphs into chunks of at most the size', () => {
    const paragraphs = Array.from({ length: 12 }, (_, i) => `Paragraph ${i} ` + 'word '.repeat(60).trim())
    const chunks = chunkText(paragraphs.join('\n\n'), 1000)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1000)
      // Every chunk is made of whole paragraphs.
      for (const part of chunk.split('\n\n')) expect(paragraphs).toContain(part)
    }
    expect(chunks.join('\n\n')).toBe(paragraphs.join('\n\n'))
  })

  it('cuts a paragraph longer than the size at a sentence or word, losing no words', () => {
    const sentences = Array.from({ length: 80 }, (_, i) => `Sentence number ${i} talks about the tenant.`).join(' ')
    const chunks = chunkText(sentences, 500)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(500)
      expect(chunk.endsWith('.')).toBe(true)
    }
    expect(chunks.join(' ').split(/\s+/)).toEqual(sentences.split(/\s+/))
    // No spaces at all: a hard cut at the limit.
    expect(chunkText('x'.repeat(4500), 2000).map((c) => c.length)).toEqual([2000, 2000, 500])
  })

  it('falls back to the default size for a size that is not a positive number', () => {
    // A size under 1 used to loop forever.
    for (const size of [0, -5, NaN, 0.5, undefined]) {
      expect(chunkText('x'.repeat(4500), size).map((c) => c.length)).toEqual([2000, 2000, 500])
      expect(chunkText('abc def', size)).toEqual(['abc def'])
    }
    expect(chunkText('abcdef', 2.7)).toEqual(['ab', 'cd', 'ef'])
  })

  it('never splits an emoji across chunks', () => {
    const text = 'a' + '😀'.repeat(1500)
    const chunks = chunkText(text)
    expect(chunks.length).toBeGreaterThan(1)
    const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2000)
      expect(lone.test(chunk)).toBe(false)
    }
    expect(chunks.join('')).toBe(text)
  })

  it('defaults to about 2,000 characters', () => {
    const text = Array.from({ length: 100 }, () => 'a sentence of some length here.').join('\n\n')
    const chunks = chunkText(text)
    expect(Math.max(...chunks.map((c) => c.length))).toBeLessThanOrEqual(2000)
    expect(Math.max(...chunks.map((c) => c.length))).toBeGreaterThan(1900)
  })
})

describe('queryTerms', () => {
  it('drops stop words and 1-letter words, keeps names and numbers, lowercased and deduped', () => {
    expect(queryTerms('tenant ID SSO')).toEqual(['tenant', 'id', 'sso'])
    expect(queryTerms('reply to Aparna, yes we can add the copyable link this week, and remind them we need the tenant ID'))
      .toEqual(['reply', 'aparna', 'add', 'copyable', 'link', 'week', 'remind', 'need', 'tenant', 'id'])
    expect(queryTerms('Invoice 4021 for phase 2, due 30 Oct — invoice INVOICE')).toEqual(['invoice', '4021', 'phase', '2', 'due', '30', 'oct'])
    expect(queryTerms("Aparna's team doesn't have it")).toEqual(['aparna', 'team'])
    expect(queryTerms('Zoë Müller')).toEqual(['zoë', 'müller'])
  })

  it('gives nothing for empty, stop-word-only or punctuation-only text', () => {
    expect(queryTerms('')).toEqual([])
    expect(queryTerms(undefined)).toEqual([])
    expect(queryTerms('and the of to I a')).toEqual([])
    expect(queryTerms('"" ** () : ^ - + ,')).toEqual([])
  })

  it('strips quotes and query syntax from words', () => {
    expect(queryTerms('"tenant" OR (SSO)* title:launch NEAR/3 -budget')).toEqual(['tenant', 'sso', 'title', 'launch', 'near', '3', 'budget'])
  })

  it('caps the list at 24 terms', () => {
    const words = Array.from({ length: 40 }, (_, i) => `word${i}`)
    expect(queryTerms(words.join(' '))).toEqual(words.slice(0, 24))
  })
})

describe('openIndex without node:sqlite', () => {
  it('is unavailable and every method is a no-op', () => {
    const Module = require('module')
    const load = Module._load
    Module._load = function (request, ...rest) {
      if (request === 'node:sqlite') throw new Error('No such built-in module: node:sqlite')
      return load.call(this, request, ...rest)
    }
    try {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-search-'))
      dirs.push(dir)
      const index = openIndex(path.join(dir, 'nested', 'search.db'))
      expect(index.available).toBe(false)
      expect(() => index.upsert(STANDUP)).not.toThrow()
      expect(() => index.remove(STANDUP.rel)).not.toThrow()
      expect(index.search('tenant ID SSO')).toEqual([])
      expect(() => index.close()).not.toThrow()
      expect(fs.existsSync(path.join(dir, 'nested'))).toBe(false)
    } finally {
      Module._load = load
    }
  })
})

describe('openIndex (node:sqlite FTS5)', () => {
  it.skipIf(!hasSqlite)('creates the parent folder and an FTS5 table in WAL mode', () => {
    const { index, dbPath } = tempIndex('projects', 'abc', 'search.db')
    expect(index.available).toBe(true)
    expect(fs.existsSync(dbPath)).toBe(true)
    const { DatabaseSync } = require('node:sqlite')
    const db = new DatabaseSync(dbPath)
    expect(db.prepare('PRAGMA journal_mode').get().journal_mode).toBe('wal')
    expect(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'chunks'").get().sql).toMatch(/fts5[\s\S]*porter unicode61 remove_diacritics 2/)
    db.close()
  })

  it.skipIf(!hasSqlite)('"tenant ID SSO" ranks the standup note and the SSO email above unrelated docs', () => {
    const { index } = filled()
    const hits = index.search('tenant ID SSO')
    expect(hits.slice(0, 2).map((h) => h.rel).sort()).toEqual([SSO_EMAIL.rel, STANDUP.rel].sort())
    // The invoice note only shares "ID"; the rest share nothing and aren't returned.
    expect(hits.map((h) => h.rel)).toEqual([...hits.slice(0, 2).map((h) => h.rel), INVOICES.rel])
    expect(hits[1].score).toBeGreaterThan(hits[2].score)
    const email = hits.find((h) => h.rel === SSO_EMAIL.rel)
    expect(email).toEqual({
      rel: SSO_EMAIL.rel, date: '2026-10-01', kind: 'conversations', title: 'SSO setup for the pilot',
      excerpt: `SSO setup for the pilot · 2026-10-01 · Aparna Rao <aparna@client.com>\n${SSO_EMAIL.text}`,
      score: expect.any(Number),
    })
    expect(hits.every((h, i) => i === 0 || h.score <= hits[0].score)).toBe(true)
  })

  it.skipIf(!hasSqlite)('finds people by sender, folds accents and matches word forms', () => {
    const { index } = filled()
    index.upsert({ rel: 'comms/zoe.eml', kind: 'conversations', date: '2026-10-03', sender: 'Zoë Müller', title: 'Re: logo', text: 'Looks good to me.' })
    expect(index.search('aparna')[0].rel).toBe(SSO_EMAIL.rel)
    expect(index.search('zoe muller')[0].rel).toBe('comms/zoe.eml')
    // porter: "invoices" and "invoicing" meet "invoice".
    expect(index.search('invoices')[0].rel).toBe(INVOICES.rel)
  })

  it.skipIf(!hasSqlite)('a newer near-tie wins; a clearly better older match stays first', () => {
    const { index } = tempIndex()
    // Other files give the terms real weight (BM25 all but ignores a word found in most files).
    for (const doc of UNRELATED) index.upsert(doc)
    const text = 'The tenant ID for SSO arrives next week from the client IT team.'
    index.upsert({ rel: 'comms/old.eml', kind: 'conversations', date: '2026-09-01', sender: '', title: 'Tenant ID', text })
    index.upsert({ rel: 'comms/new.eml', kind: 'conversations', date: '2026-10-04', sender: '', title: 'Tenant ID', text: `${text} Thanks.` })
    const [first, second] = index.search('tenant ID SSO')
    expect(first.rel).toBe('comms/new.eml')
    // The older one really scored higher, within 10%.
    expect(second.rel).toBe('comms/old.eml')
    expect(second.score).toBeGreaterThan(first.score)
    expect(first.score).toBeGreaterThanOrEqual(second.score * 0.9)
    expect(first.score).toBeGreaterThan(1)

    index.upsert({ rel: 'comms/old.eml', kind: 'conversations', date: '2026-09-01', sender: 'SSO team', title: 'Tenant ID for SSO: tenant ID', text })
    const again = index.search('tenant ID SSO')
    expect(again.map((h) => h.rel)).toEqual(['comms/old.eml', 'comms/new.eml'])
    expect(again[0].score).toBeGreaterThan(again[1].score / 0.9)
  })

  it.skipIf(!hasSqlite)('a newer near-tie wins even when more than 60 files score higher, whatever the limit', () => {
    const { index } = tempIndex()
    for (let i = 0; i < 200; i++) index.upsert({ rel: `other/${i}.md`, kind: 'reference', date: '2026-01-01', sender: '', title: 'Other', text: `Unrelated note ${i} about colours and layout.` })
    // 80 weekly standups saying the same thing; later ones run a little longer, so score a little lower.
    const dateOf = (week) => new Date(Date.UTC(2025, 3, 1) + week * 7 * 864e5).toISOString().slice(0, 10)
    for (let week = 0; week < 80; week++) {
      const more = ' More.'.repeat(Math.floor(week / 16))
      index.upsert({ rel: `meetings/${dateOf(week)}-standup.md`, kind: 'conversations', date: dateOf(week), sender: '', title: `Standup ${dateOf(week)}`, text: `Status: still waiting for the tenant ID so SSO can go live. The reports page and the launch checklist were reviewed.${more}` })
    }
    const all = index.search('tenant ID SSO', { limit: 1000 })
    expect(all).toHaveLength(80)
    const best = Math.max(...all.map((h) => h.score))
    const newestNearTie = all.filter((h) => h.score >= best * 0.9).map((h) => h.date).sort().pop()
    const hits = index.search('tenant ID SSO')
    expect(hits).toHaveLength(20)
    expect(hits[0].date).toBe(newestNearTie)
    expect(hits[0].date).toBe(dateOf(79))
    // The winner ranks past position 60 on raw score alone.
    expect(all.filter((h) => h.score > hits[0].score).length).toBeGreaterThanOrEqual(60)
    expect(hits).toEqual(all.slice(0, 20))
    expect(index.search('tenant ID SSO', { limit: 1 })).toEqual(all.slice(0, 1))
    // Within 10% of each other, newest first.
    for (let i = 1; i < hits.length; i++) expect(hits[i].date < hits[i - 1].date).toBe(true)
  })

  it.skipIf(!hasSqlite)('upsert replaces a file\'s chunks and remove() deletes them', () => {
    const { index, dbPath } = filled()
    index.upsert({ ...SSO_EMAIL, text: 'Rescheduled: the pilot call moves to Thursday.' })
    expect(rowCount(dbPath, SSO_EMAIL.rel)).toBe(1)
    expect(index.search('redirect URI')).toEqual([])
    expect(index.search('Thursday')[0].rel).toBe(SSO_EMAIL.rel)

    index.remove(SSO_EMAIL.rel)
    expect(rowCount(dbPath, SSO_EMAIL.rel)).toBe(0)
    expect(index.search('tenant ID SSO').map((h) => h.rel)).not.toContain(SSO_EMAIL.rel)
    expect(index.search('Aparna')).toEqual([])
    // Other files are untouched.
    expect(index.search('tenant ID SSO')[0].rel).toBe(STANDUP.rel)
    expect(() => index.remove('not/indexed.md')).not.toThrow()
  })

  it.skipIf(!hasSqlite)('returns one hit per file, with the best chunk as the excerpt', () => {
    const { index, dbPath } = tempIndex()
    const filler = (n) => Array.from({ length: 30 }, () => `Notes on the reports page layout, part ${n}.`).join(' ')
    const text = [filler(1), filler(2), 'The client confirmed the tenant ID today; SSO can go live.', filler(3)].join('\n\n')
    index.upsert({ rel: 'notes/long.md', kind: 'overview', date: '2026-10-01', sender: '', title: 'Long notes', text })
    expect(rowCount(dbPath, 'notes/long.md')).toBeGreaterThan(2)
    const hits = index.search('tenant SSO reports')
    expect(hits).toHaveLength(1)
    const [header, ...body] = hits[0].excerpt.split('\n')
    expect(header).toBe('Long notes · 2026-10-01')
    expect(body.join('\n')).toContain('tenant ID today')
    expect(body.join('\n').length).toBeLessThanOrEqual(2000)
  })

  it.skipIf(!hasSqlite)('heads each excerpt with "title · date · sender", leaving out empty parts', () => {
    const { index } = filled()
    const standup = index.search('tenant ID SSO').find((h) => h.rel === STANDUP.rel)
    expect(standup.excerpt).toBe(`Standup 2 Oct · 2026-10-02\n${STANDUP.text}`)
    index.upsert({ rel: 'notes/bare.md', kind: 'reference', date: '', sender: '', title: '', text: 'Kiosk wiring notes.' })
    expect(index.search('kiosk')[0].excerpt).toBe('Kiosk wiring notes.')
    index.upsert({ rel: 'comms/folded.eml', kind: 'conversations', date: '2026-10-05', sender: ' Dev  Team\n', title: 'Re: kiosk\n  wiring', text: 'Wiring diagram attached.' })
    expect(index.search('diagram')[0].excerpt).toBe('Re: kiosk wiring · 2026-10-05 · Dev Team\nWiring diagram attached.')
  })

  it.skipIf(!hasSqlite)('filters by kind and honours the limit', () => {
    const { index } = filled()
    expect(index.search('tenant ID SSO', { kinds: ['agreements'] }).map((h) => h.rel)).toEqual([INVOICES.rel])
    expect(index.search('tenant ID SSO', { kinds: ['conversations'] }).map((h) => h.kind)).toEqual(['conversations', 'conversations'])
    expect(index.search('tenant ID SSO', { kinds: ['build', 'reference'] })).toEqual([])
    expect(index.search('tenant ID SSO', { kinds: [] })).toHaveLength(3)
    expect(index.search('tenant ID SSO', { limit: 1 })).toHaveLength(1)
    for (let i = 0; i < 30; i++) index.upsert({ rel: `comms/${i}.eml`, kind: 'conversations', date: '2026-10-01', sender: '', title: 'Tenant', text: `Tenant note ${i}` })
    expect(index.search('tenant')).toHaveLength(20)
    expect(index.search('tenant', { limit: 2.9 })).toHaveLength(2)
    // A limit that isn't a whole number of at least 1 means the default.
    for (const limit of [0, 0.5, -3, NaN, Infinity, '5']) expect(index.search('tenant', { limit })).toHaveLength(20)
  })

  it.skipIf(!hasSqlite)('takes missing or null options', () => {
    const { index } = filled()
    expect(index.search('tenant ID SSO', null)).toHaveLength(3)
    expect(index.search('tenant ID SSO', undefined)).toHaveLength(3)
    expect(index.search('tenant ID SSO', { kinds: null, limit: null })).toHaveLength(3)
  })

  it.skipIf(!hasSqlite)('punctuation, quotes and FTS syntax in the query never throw', () => {
    const { index } = filled()
    for (const q of ['"', '""tenant"', 'tenant" OR "', 'SSO*', '(tenant', 'title:SSO', 'NEAR(tenant SSO)', '^SSO', 'tenant - id', "it's the client's", '', 'the and of']) {
      expect(() => index.search(q)).not.toThrow()
      expect(Array.isArray(index.search(q))).toBe(true)
    }
    expect(index.search('"tenant" (SSO)')[0].rel).toMatch(/standup|sso-setup/)
  })

  it.skipIf(!hasSqlite)('keeps the index on disk across close and reopen; closed indexes do nothing', () => {
    const { index, dbPath } = filled()
    index.close()
    expect(() => index.close()).not.toThrow()
    expect(index.search('tenant')).toEqual([])
    expect(() => index.upsert(STANDUP)).not.toThrow()
    const reopened = openIndex(dbPath)
    indexes.push(reopened)
    expect(reopened.search('tenant ID SSO')).toHaveLength(3)
  })

  it.skipIf(!hasSqlite)('searches 5,000 files of several chunks each in under 300 ms', () => {
    const { index } = tempIndex()
    // A Zipf-like spread over 600 words, the query's words among the common ones, so most of the
    // 20,000 chunks match and every one of them is ranked and grouped.
    const vocab = Array.from({ length: 600 }, (_, i) => `w${i.toString(36)}x`)
    'tenant sso login invoice payment design review meeting standup client scope deadline budget aparna reply'.split(' ').forEach((w, i) => { vocab[i * 3 + 1] = w })
    let seed = 1
    const word = () => vocab[Math.floor(((seed = (seed * 16807) % 2147483647) / 2147483647) ** 2.2 * vocab.length)]
    let chunks = 0
    for (let i = 0; i < 5000; i++) {
      const text = Array.from({ length: 4 }, () => Array.from({ length: 300 }, word).join(' ')).join('\n\n')
      chunks += chunkText(text).length
      index.upsert({ rel: `comms/${i}.eml`, kind: i % 2 ? 'conversations' : 'reference', date: `2026-09-${String(i % 28 + 1).padStart(2, '0')}`, sender: `Person ${i}`, title: `Message ${i}`, text })
    }
    expect(chunks).toBeGreaterThanOrEqual(15000)
    const request = 'reply to Aparna about the tenant ID, SSO login and the invoice, and the payment deadline for the design review'
    // The median of three runs, so one scheduler hiccup on a busy CI machine doesn't fail it.
    const times = []
    let hits
    for (let run = 0; run < 3; run++) {
      const started = performance.now()
      hits = index.search(request, { kinds: ['conversations', 'reference'] })
      times.push(performance.now() - started)
    }
    expect(times.sort((a, b) => a - b)[1]).toBeLessThan(300)
    expect(hits).toHaveLength(20)
    expect(hits.every((h) => h.excerpt.startsWith(`${h.title} · ${h.date} · Person `))).toBe(true)
  }, 120000)
})
