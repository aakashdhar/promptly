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
function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-search-'))
  dirs.push(dir)
  return dir
}
function tracked(index) {
  indexes.push(index)
  return index
}
function tempIndex(...parts) {
  const dbPath = path.join(tempDir(), ...(parts.length ? parts : ['search.db']))
  return { index: tracked(openIndex(dbPath)), dbPath }
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
    return db.prepare('SELECT count(*) AS n FROM chunk_files WHERE rel = ?').get(rel).n
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

  it('keeps first names that are also English words', () => {
    expect(queryTerms('Reply to Will and Don about the invoice')).toEqual(['reply', 'will', 'don', 'invoice'])
    expect(queryTerms('Email Won-ho and Mark')).toEqual(['email', 'won', 'ho', 'mark'])
    expect(queryTerms("Will's invoice: ask Can and So-yeon, then An")).toEqual(['will', 'invoice', 'ask', 'can', 'so', 'yeon', 'an'])
    // The helper verb stays out: written in lowercase, or capitalised only because a sentence starts.
    expect(queryTerms('Will you send it? I will. Then ask Will.')).toEqual(['send', 'ask', 'will'])
    expect(queryTerms('we will see if we can do it so my team knows')).toEqual(['see', 'team', 'knows'])
    expect(queryTerms('Okay, Yes, Please do')).toEqual([])
  })

  it('keeps a name after a title, an abbreviation, a colon or a semicolon', () => {
    expect(queryTerms('Please email Mr. Will Smith and Dr. Can Yilmaz about the invoice'))
      .toEqual(['email', 'mr', 'will', 'smith', 'dr', 'can', 'yilmaz', 'invoice'])
    expect(queryTerms('cc: Will')).toEqual(['cc', 'will'])
    expect(queryTerms('Ask the leads, e.g. Will and Don')).toEqual(['ask', 'leads', 'will', 'don'])
    expect(queryTerms('Notes; Can is out on Friday')).toEqual(['notes', 'can', 'friday'])
    // A real sentence end still drops the helper verb.
    expect(queryTerms('The invoice is late. Will you resend it?')).toEqual(['invoice', 'late', 'resend'])
    expect(queryTerms('Is it late?! Can you check')).toEqual(['late', 'check'])
  })

  it('drops contractions whole and keeps names written with an apostrophe', () => {
    expect(queryTerms("don't won't isn't can't shouldn't've we're they'll I'm it's let's")).toEqual([])
    expect(queryTerms("Aparna's note for O'Brien and D'Souza")).toEqual(['aparna', 'note', 'brien', 'souza'])
    expect(queryTerms('it’s Zoë’s turn, don’t wait')).toEqual(['zoë', 'turn', 'wait'])
  })

  it('cuts Chinese, Japanese and Korean into pairs of characters, leaving out particles', () => {
    expect(queryTerms('プロジェクト')).toEqual(['プロ', 'ロジ', 'ジェ', 'ェク', 'クト'])
    expect(queryTerms('项目截止日期')).toEqual(['项目', '目截', '截止', '止日', '日期'])
    expect(queryTerms('프로젝트의 마감')).toEqual(['프로', '로젝', '젝트', '트의', '마감'])
    expect(queryTerms('Promptlyの設定')).toEqual(['promptly', 'の設', '設定'])
    expect(queryTerms('締め切りまで')).toEqual(['締め', 'め切', '切り'])
    expect(queryTerms('までに')).toEqual(['まで', 'でに'])
    expect(queryTerms('猫')).toEqual(['猫'])
    expect(queryTerms('の')).toEqual([])
    // Decomposed kana gives the same pairs as composed kana.
    expect(queryTerms('フ\u309aロシ\u3099ェクト')).toEqual(queryTerms('プロジェクト'))
  })

  it('caps the list at 24 terms', () => {
    const words = Array.from({ length: 40 }, (_, i) => `word${i}`)
    expect(queryTerms(words.join(' '))).toEqual(words.slice(0, 24))
    expect(queryTerms('来週の金曜日までにプロジェクトの締め切りについてクライアントにメールを書いてください')).toHaveLength(24)
  })

  it('fills the cap with whole words before pairs that straddle a Japanese particle', () => {
    const terms = queryTerms('クライアントとのプロジェクトの締め切りについて来週の金曜日までに田中さんに連絡して')
    expect(terms).toHaveLength(24)
    // The person and the action come last in the sentence and used to be cut.
    for (const word of ['田中', '連絡', '来週', '金曜', '曜日', 'プロ', 'クト', '締め', '切り']) expect(terms).toContain(word)
    for (const pair of ['の金', 'に田', 'に連', 'て来']) expect(terms).not.toContain(pair)
    // Still in the order they were said.
    expect(terms.slice(0, 2)).toEqual(['クラ', 'ライ'])
    expect(terms.indexOf('田中')).toBeGreaterThan(terms.indexOf('金曜'))
    // English words keep the first 24 in order, whatever CJK follows.
    const words = Array.from({ length: 30 }, (_, i) => `word${i}`)
    expect(queryTerms(`${words.join(' ')} 田中さんに連絡`)).toEqual(words.slice(0, 24))
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
      expect(index).toMatchObject({ available: false, fresh: false, movedAside: null })
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
    expect(index).toMatchObject({ available: true, fresh: true, movedAside: null })
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

  it.skipIf(!hasSqlite)('takes kinds as one string or any list; kinds it can\'t read find nothing, not everything', () => {
    const { index } = filled()
    expect(index.search('tenant ID SSO', { kinds: 'agreements' }).map((h) => h.rel)).toEqual([INVOICES.rel])
    expect(index.search('tenant ID SSO', { kinds: new Set(['agreements']) }).map((h) => h.rel)).toEqual([INVOICES.rel])
    expect(index.search('tenant ID SSO', { kinds: Object.freeze(['conversations']) })).toHaveLength(2)
    expect(index.search('tenant ID SSO', { kinds: 'reference' })).toEqual([])
    for (const kinds of [5, {}, true]) expect(index.search('tenant ID SSO', { kinds })).toEqual([])
  })

  it.skipIf(!hasSqlite)('a name that is also an English word still finds that person\'s email', () => {
    const { index } = filled()
    const ask = { kind: 'conversations', title: 'Invoice query', text: 'Could you resend the invoice?' }
    index.upsert({ ...ask, rel: 'comms/will.eml', date: '2026-09-28', sender: 'Will Turner <will@client.com>' })
    index.upsert({ ...ask, rel: 'comms/don.eml', date: '2026-09-29', sender: 'Don Lee <don@client.com>' })
    index.upsert({ ...ask, rel: 'comms/priya.eml', date: '2026-10-04', sender: 'Priya Shah <priya@client.com>' })
    // Without the name these three tie and the newest (Priya's) comes first.
    expect(index.search('Reply to Will about the invoice')[0].rel).toBe('comms/will.eml')
    expect(index.search('Email Don about the invoice')[0].rel).toBe('comms/don.eml')
    const emails = ['comms/will.eml', 'comms/don.eml', 'comms/priya.eml']
    expect(index.search('Ask them about the invoice').map((h) => h.rel).filter((rel) => emails.includes(rel))).toEqual([...emails].reverse())
  })

  it.skipIf(!hasSqlite)('finds Chinese, Japanese and Korean words inside sentences without spaces', () => {
    const { index } = filled()
    const ja = { rel: 'meetings/ja.md', kind: 'conversations', date: '2026-10-03', sender: '', title: '定例会議', text: 'プロジェクトの締め切りは金曜日です。Promptlyの設定も確認します。' }
    index.upsert(ja)
    index.upsert({ rel: 'meetings/ja-photo.md', kind: 'conversations', date: '2026-10-04', sender: '', title: 'メモ', text: 'プロフィール写真を更新しました。' })
    index.upsert({ rel: 'meetings/zh.md', kind: 'conversations', date: '2026-10-03', sender: '', title: '会议记录', text: '客户确认了项目截止日期，下周开始测试。' })
    index.upsert({ rel: 'meetings/ko.md', kind: 'conversations', date: '2026-10-03', sender: '', title: '회의', text: '프로젝트의 마감은 금요일입니다.' })
    const rels = (q) => index.search(q).map((h) => h.rel)
    // The photo note shares only "プロ", so it comes second.
    expect(rels('プロジェクト')).toEqual(['meetings/ja.md', 'meetings/ja-photo.md'])
    for (const q of ['締め切り', '金曜日', '定例会議', 'Promptly', '来週の金曜日までにプロジェクトの締め切りを確認して']) expect(rels(q)[0]).toBe('meetings/ja.md')
    for (const q of ['截止日期', '项目', '客']) expect(rels(q)).toEqual(['meetings/zh.md'])
    expect(rels('프로젝트')).toEqual(['meetings/ko.md'])
    expect(rels('猫')).toEqual([])
    // The excerpt is the text as written.
    expect(index.search('締め切り')[0].excerpt).toBe(`定例会議 · 2026-10-03\n${ja.text}`)
    // English search is unchanged by the CJK files.
    expect(rels('tenant ID SSO').slice(0, 2).sort()).toEqual([SSO_EMAIL.rel, STANDUP.rel].sort())
    index.remove('meetings/ja.md')
    expect(rels('締め切り')).toEqual([])
  })

  it.skipIf(!hasSqlite)('a long Japanese request still finds the person it names at the end', () => {
    const { index } = filled()
    index.upsert({ rel: 'comms/tanaka.md', kind: 'conversations', date: '2026-10-01', sender: '', title: 'メモ', text: '田中さんの連絡先はメールです。' })
    const request = 'クライアントとのプロジェクトの締め切りについて来週の金曜日までに田中さんに連絡して'
    expect(index.search(request).map((h) => h.rel)).toEqual(['comms/tanaka.md'])
  })

  it.skipIf(!hasSqlite)('a small project keeps hits for the word most of its files share', () => {
    const { index } = tempIndex()
    for (let i = 0; i < 3; i++) {
      index.upsert({ rel: `notes/${i}.md`, kind: 'reference', date: `2026-10-0${i + 1}`, sender: '', title: `Note ${i}`, text: `Tenant portal status, week ${i}.${i === 1 ? ' The kiosk ships on Friday.' : ''}` })
    }
    const hits = index.search('kiosk tenant')
    expect(hits.map((h) => h.rel)).toEqual(['notes/1.md', 'notes/2.md', 'notes/0.md'])
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
    const reopened = tracked(openIndex(dbPath))
    expect(reopened).toMatchObject({ available: true, fresh: false, movedAside: null })
    expect(reopened.search('tenant ID SSO')).toHaveLength(3)
  })

  it.skipIf(!hasSqlite)('sets a corrupt search.db aside and starts a fresh index', () => {
    const dbPath = path.join(tempDir(), 'search.db')
    const junk = Buffer.alloc(8192, 7)
    fs.writeFileSync(dbPath, junk)
    const index = tracked(openIndex(dbPath))
    expect(index).toMatchObject({ available: true, fresh: true })
    expect(index.movedAside).toMatch(/search\.db\.corrupt-\d+$/)
    expect(fs.readFileSync(index.movedAside)).toEqual(junk)
    index.upsert(STANDUP)
    expect(index.search('tenant')[0].rel).toBe(STANDUP.rel)
    index.close()
    const reopened = tracked(openIndex(dbPath))
    expect(reopened).toMatchObject({ available: true, fresh: false, movedAside: null })
    expect(reopened.search('tenant')[0].rel).toBe(STANDUP.rel)
  })

  it.skipIf(!hasSqlite)('moves aside a folder sitting where search.db should be, with any -wal and -shm', () => {
    const dbPath = path.join(tempDir(), 'search.db')
    fs.mkdirSync(dbPath)
    fs.writeFileSync(path.join(dbPath, 'note.txt'), 'kept')
    fs.writeFileSync(`${dbPath}-wal`, 'stale wal')
    fs.writeFileSync(`${dbPath}-shm`, 'stale shm')
    const index = tracked(openIndex(dbPath))
    expect(index).toMatchObject({ available: true, fresh: true })
    expect(fs.readFileSync(path.join(index.movedAside, 'note.txt'), 'utf8')).toBe('kept')
    // Left in place, the old -wal would be replayed into the new file.
    expect(fs.readFileSync(`${index.movedAside}-wal`, 'utf8')).toBe('stale wal')
    expect(fs.readFileSync(`${index.movedAside}-shm`, 'utf8')).toBe('stale shm')
    index.upsert(STANDUP)
    expect(index.search('tenant')).toHaveLength(1)
  })

  it.skipIf(!hasSqlite)('is unavailable, without throwing, when search.db can\'t be made', () => {
    const dir = tempDir()
    fs.writeFileSync(path.join(dir, 'blocker'), 'a file, not a folder')
    const index = tracked(openIndex(path.join(dir, 'blocker', 'search.db')))
    expect(index).toMatchObject({ available: false, fresh: false, movedAside: null })
    expect(() => index.upsert(STANDUP)).not.toThrow()
    expect(index.search('tenant')).toEqual([])
    expect(fs.readFileSync(path.join(dir, 'blocker'), 'utf8')).toBe('a file, not a folder')
  })

  // chmod doesn't stop a rename on Windows, or for root.
  it.skipIf(!hasSqlite || process.platform === 'win32' || process.getuid?.() === 0)('is unavailable when a corrupt search.db can\'t be moved aside', () => {
    const dir = tempDir()
    const dbPath = path.join(dir, 'search.db')
    fs.writeFileSync(dbPath, Buffer.alloc(8192, 7))
    fs.chmodSync(dir, 0o555)
    try {
      const index = tracked(openIndex(dbPath))
      expect(index).toMatchObject({ available: false, movedAside: null })
      expect(index.search('tenant')).toEqual([])
      expect(fs.readdirSync(dir)).toEqual(['search.db'])
    } finally {
      fs.chmodSync(dir, 0o755)
    }
  })

  it.skipIf(!hasSqlite)('leaves a search.db that another connection holds locked alone', () => {
    const { DatabaseSync } = require('node:sqlite')
    const dir = tempDir()
    const dbPath = path.join(dir, 'search.db')
    const other = new DatabaseSync(dbPath)
    other.exec('CREATE TABLE t (x)')
    other.exec('BEGIN EXCLUSIVE')
    other.exec('INSERT INTO t VALUES (1)')
    try {
      const index = tracked(openIndex(dbPath))
      expect(index).toMatchObject({ available: false, movedAside: null })
      expect(fs.readdirSync(dir).filter((name) => name.includes('corrupt'))).toEqual([])
    } finally {
      other.exec('ROLLBACK')
      other.close()
    }
  })

  it.skipIf(!hasSqlite)('empties an index left by an older layout and says it is fresh', () => {
    const { DatabaseSync } = require('node:sqlite')
    const dbPath = path.join(tempDir(), 'search.db')
    const old = new DatabaseSync(dbPath)
    old.exec(`CREATE VIRTUAL TABLE chunks USING fts5(rel UNINDEXED, kind UNINDEXED, date UNINDEXED, sender, title, body);
      CREATE TABLE chunk_files (id INTEGER PRIMARY KEY, rel TEXT NOT NULL);
      INSERT INTO chunks VALUES ('old.md', 'reference', '2026-01-01', '', 'Old', 'tenant notes');`)
    old.close()
    const index = tracked(openIndex(dbPath))
    expect(index).toMatchObject({ available: true, fresh: true, movedAside: null })
    expect(index.search('tenant')).toEqual([])
    index.upsert(STANDUP)
    index.close()
    const reopened = tracked(openIndex(dbPath))
    expect(reopened.fresh).toBe(false)
    expect(reopened.search('tenant').map((h) => h.rel)).toEqual([STANDUP.rel])
  })

  it.skipIf(!hasSqlite)('opens a file left halfway through an older migration (only the old chunk_files) as a fresh index', () => {
    const { DatabaseSync } = require('node:sqlite')
    const dbPath = path.join(tempDir(), 'search.db')
    const old = new DatabaseSync(dbPath)
    old.exec('CREATE TABLE chunk_files (id INTEGER PRIMARY KEY, rel TEXT NOT NULL)')
    old.close()
    let index
    expect(() => { index = tracked(openIndex(dbPath)) }).not.toThrow()
    expect(index).toMatchObject({ available: true, fresh: true, movedAside: null })
    index.upsert(STANDUP)
    expect(index.search('tenant').map((h) => h.rel)).toEqual([STANDUP.rel])
    index.close()
    const reopened = tracked(openIndex(dbPath))
    expect(reopened).toMatchObject({ available: true, fresh: false, movedAside: null })
    expect(reopened.search('tenant').map((h) => h.rel)).toEqual([STANDUP.rel])
  })

  it.skipIf(!hasSqlite)('makes a fresh index when a table is missing at the current version', () => {
    const { DatabaseSync } = require('node:sqlite')
    const { index, dbPath } = filled()
    index.close()
    const db = new DatabaseSync(dbPath)
    db.exec('DROP TABLE chunk_text')
    db.close()
    const reopened = tracked(openIndex(dbPath))
    expect(reopened).toMatchObject({ available: true, fresh: true, movedAside: null })
    expect(reopened.search('tenant')).toEqual([])
  })

  it.skipIf(!hasSqlite)('sets aside a file whose tables at the current version are not the expected ones', () => {
    const { DatabaseSync } = require('node:sqlite')
    const dbPath = path.join(tempDir(), 'search.db')
    const odd = new DatabaseSync(dbPath)
    odd.exec('CREATE TABLE chunks (x); CREATE TABLE chunk_files (y); CREATE TABLE chunk_text (z); PRAGMA user_version = 2')
    odd.close()
    let index
    expect(() => { index = tracked(openIndex(dbPath)) }).not.toThrow()
    expect(index).toMatchObject({ available: true, fresh: true })
    expect(index.movedAside).toMatch(/search\.db\.corrupt-\d+$/)
    index.upsert(STANDUP)
    expect(index.search('tenant')).toHaveLength(1)
  })

  it.skipIf(!hasSqlite)('replaces an older layout in one transaction: a drop that fails leaves the old file whole', () => {
    const { DatabaseSync } = require('node:sqlite')
    const dbPath = path.join(tempDir(), 'search.db')
    const old = new DatabaseSync(dbPath)
    // DROP TABLE refuses a view, so the reset fails after dropping chunks.
    old.exec("CREATE TABLE chunks (x); INSERT INTO chunks VALUES ('kept'); CREATE VIEW chunk_text AS SELECT 1 AS a")
    old.close()
    const index = tracked(openIndex(dbPath))
    expect(index).toMatchObject({ available: true, fresh: true })
    const aside = new DatabaseSync(index.movedAside)
    try {
      expect(aside.prepare('SELECT type, name FROM sqlite_master ORDER BY name').all().map((r) => `${r.type}:${r.name}`)).toEqual(['view:chunk_text', 'table:chunks'])
      expect(aside.prepare('SELECT x FROM chunks').get().x).toBe('kept')
      expect(aside.prepare('PRAGMA user_version').get().user_version).toBe(0)
    } finally {
      aside.close()
    }
  })

  // chmod doesn't stop SQLite opening a file on Windows, or for root.
  it.skipIf(!hasSqlite || process.platform === 'win32' || process.getuid?.() === 0)('leaves a healthy search.db it can\'t open right now where it is', () => {
    const { index, dbPath } = filled()
    index.close()
    fs.chmodSync(dbPath, 0o000)
    try {
      const blocked = tracked(openIndex(dbPath))
      expect(blocked).toMatchObject({ available: false, fresh: false, movedAside: null })
      expect(fs.readdirSync(path.dirname(dbPath))).toEqual(['search.db'])
    } finally {
      fs.chmodSync(dbPath, 0o644)
    }
    const reopened = tracked(openIndex(dbPath))
    expect(reopened).toMatchObject({ available: true, fresh: false, movedAside: null })
    expect(reopened.search('tenant ID SSO')).toHaveLength(3)
  })

  it.skipIf(!hasSqlite)('keeps only the newest damaged copy', () => {
    const dir = tempDir()
    const dbPath = path.join(dir, 'search.db')
    fs.writeFileSync(`${dbPath}.corrupt-1000`, 'old copy')
    fs.writeFileSync(`${dbPath}.corrupt-1000-wal`, 'old wal')
    fs.mkdirSync(`${dbPath}.corrupt-2000`)
    fs.writeFileSync(path.join(dir, 'other.txt'), 'not ours')
    fs.writeFileSync(dbPath, Buffer.alloc(8192, 7))
    const index = tracked(openIndex(dbPath))
    expect(index).toMatchObject({ available: true, fresh: true })
    // A folder is never deleted, only a file copy of ours.
    expect(fs.readdirSync(dir).sort()).toEqual(['other.txt', 'search.db', path.basename(index.movedAside), 'search.db-shm', 'search.db-wal', 'search.db.corrupt-2000'].sort())
  })

  describe('damage found after open', () => {
    // Overwrites every third page in the last 40% of the file: the open-time check reads only the
    // first rows of each table, so it misses this and the first search or write finds it.
    function damaged() {
      const dbPath = path.join(tempDir(), 'search.db')
      const index = openIndex(dbPath)
      for (let i = 0; i < 400; i++) {
        index.upsert({ rel: `notes/${i}.md`, kind: 'reference', date: '2026-10-01', sender: '', title: `Note ${i}`, text: `Tenant notes ${i}. ` + 'Lorem ipsum dolor sit amet. '.repeat(40) })
      }
      index.close()
      const page = 4096
      const pages = Math.floor(fs.statSync(dbPath).size / page)
      const fd = fs.openSync(dbPath, 'r+')
      try {
        for (let p = Math.floor(pages * 0.6); p < pages; p += 3) fs.writeSync(fd, Buffer.alloc(page, 0x5a), 0, page, p * page)
      } finally {
        fs.closeSync(fd)
      }
      return dbPath
    }
    function openDamaged(dbPath) {
      const resets = []
      const index = tracked(openIndex(dbPath, { onReset: (reset) => resets.push(reset) }))
      // The open itself didn't notice, so what follows tests the later check.
      expect(index).toMatchObject({ available: true, fresh: false, movedAside: null })
      return { index, resets }
    }

    it.skipIf(!hasSqlite)('a search sets the file aside, starts a fresh index and asks for a re-index', () => {
      const dbPath = damaged()
      const { index, resets } = openDamaged(dbPath)
      expect(index.search('tenant')).toEqual([])
      expect(resets).toHaveLength(1)
      expect(resets[0]).toEqual({ available: true, movedAside: expect.stringMatching(/search\.db\.corrupt-\d+$/) })
      expect(fs.existsSync(resets[0].movedAside)).toBe(true)
      expect(index.available).toBe(true)
      index.upsert(STANDUP)
      expect(index.search('tenant').map((h) => h.rel)).toEqual([STANDUP.rel])
      expect(resets).toHaveLength(1)
      index.close()
      const reopened = tracked(openIndex(dbPath))
      expect(reopened).toMatchObject({ available: true, fresh: false, movedAside: null })
      expect(reopened.search('tenant').map((h) => h.rel)).toEqual([STANDUP.rel])
    })

    it.skipIf(!hasSqlite)('an upsert that meets the damage still lands in the fresh index', () => {
      const { index, resets } = openDamaged(damaged())
      const doc = { rel: 'notes/399.md', kind: 'reference', date: '2026-10-05', sender: '', title: 'Kiosk', text: 'The kiosk ships on Friday.' }
      expect(() => index.upsert(doc)).not.toThrow()
      expect(resets.map((r) => r.available)).toEqual([true])
      expect(index.search('kiosk').map((h) => h.rel)).toEqual([doc.rel])
      // Everything else waits for the caller's re-index.
      expect(index.search('lorem')).toEqual([])
    })

    it.skipIf(!hasSqlite)('a remove that meets the damage resets the index without throwing', () => {
      const { index, resets } = openDamaged(damaged())
      expect(() => index.remove('notes/399.md')).not.toThrow()
      expect(resets.map((r) => r.available)).toEqual([true])
      expect(index.search('tenant')).toEqual([])
    })

    it.skipIf(!hasSqlite)('works without an onReset callback', () => {
      const dbPath = damaged()
      const index = tracked(openIndex(dbPath))
      expect(index.search('tenant')).toEqual([])
      index.upsert(STANDUP)
      expect(index.search('tenant')).toHaveLength(1)
    })

    // chmod doesn't stop a rename on Windows, or for root.
    it.skipIf(!hasSqlite || process.platform === 'win32' || process.getuid?.() === 0)('becomes unavailable, without throwing, when the damaged file can\'t be moved', () => {
      const dbPath = damaged()
      const { index, resets } = openDamaged(dbPath)
      const dir = path.dirname(dbPath)
      fs.chmodSync(dir, 0o555)
      try {
        expect(index.search('tenant')).toEqual([])
        expect(resets).toEqual([{ available: false, movedAside: null }])
        expect(index.available).toBe(false)
        expect(() => index.upsert(STANDUP)).not.toThrow()
        expect(() => index.remove(STANDUP.rel)).not.toThrow()
        expect(index.search('tenant')).toEqual([])
        expect(resets).toHaveLength(1)
        expect(() => index.close()).not.toThrow()
        expect(fs.readdirSync(dir).filter((name) => name.includes('corrupt'))).toEqual([])
      } finally {
        fs.chmodSync(dir, 0o755)
      }
    })
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

  it.skipIf(!hasSqlite)('a broad 24-word request over 5,000 files of about 20 KB (50,000 chunks) stays under 300 ms', () => {
    const { index } = tempIndex()
    // The request's words are among the most common of 3,000, so nearly every chunk matches some.
    const vocab = Array.from({ length: 3000 }, (_, i) => `w${i.toString(36)}x`)
    const words = 'tenant sso login invoice payment design review meeting standup client scope deadline budget aparna reply status launch report team week project email call update'.split(' ')
    words.forEach((w, i) => { vocab[i * 2 + 1] = w })
    let seed = 1
    const word = () => vocab[Math.floor(((seed = (seed * 16807) % 2147483647) / 2147483647) ** 3 * vocab.length)]
    const kinds = ['conversations', 'reference', 'agreements', 'overview', 'build']
    let chunks = 0
    for (let i = 0; i < 5000; i++) {
      let text = Array.from({ length: 10 }, () => Array.from({ length: 330 }, word).join(' ')).join('\n\n')
      if (i === 4321) text += '\n\nThe kiosk ships on Friday.'
      chunks += chunkText(text).length
      index.upsert({ rel: `comms/${i}.eml`, kind: kinds[i % 5], date: `2026-09-${String(i % 28 + 1).padStart(2, '0')}`, sender: `Person ${i}`, title: `Message ${i}`, text })
    }
    expect(chunks).toBeGreaterThanOrEqual(50000)
    const request = words.join(' ')
    expect(queryTerms(request)).toHaveLength(24)
    const times = []
    let hits
    for (let run = 0; run < 3; run++) {
      const started = performance.now()
      hits = index.search(request, { kinds: kinds.slice(0, 4) })
      times.push(performance.now() - started)
    }
    expect(times.sort((a, b) => a - b)[1]).toBeLessThan(300)
    expect(hits).toHaveLength(20)
    expect(hits.every((h) => kinds.slice(0, 4).includes(h.kind))).toBe(true)
    // "tenant" is in nearly every chunk, so it has no BM25 weight; in an index this size it brings
    // in no hits scored ~0, and the one file with the rare word is all that comes back.
    expect(index.search('kiosk tenant').map((h) => h.rel)).toEqual(['comms/4321.eml'])
  }, 180000)
})
