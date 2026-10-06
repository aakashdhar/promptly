import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { suggestProject, termsFromSummary } = require('../main/projects/suggest.js')

// Stands in for context.pickOutput: "email"/"reply to" → email, else the project's default.
const pickOutput = (text, fallback) => (/\b(email|reply to)\b/i.test(text) ? 'email' : fallback)

function project(fields) {
  return { id: fields.name.toLowerCase(), people: [], words: [], lastUsedAt: null, defaultOutput: 'prompt', ...fields }
}

const SUMMARY = `# Infer360

## The project
- Infer360 rollout of the reporting module, phase 2 of 3; go-live 14 Nov [source: overview/plan.md · 2 Oct]

## People
- **Aparna Rao** — Infer360 product lead (client); approves scope [source: comms · 31 emails]
- **Rahul Mehta (CTO)** — signs off budget [source: agreements/sow.md · 12 Sep]
- Priya Shah, our delivery manager [source: comms · 8 emails]
- Dev Patel – backend developer [source: build/team.md · 1 Oct]
- Olu Ade - designer [source: comms · 3 emails]
- Sam (QA) [source: comms · 2 emails]
  - prefers bug reports with screenshots [source: comms · 2 emails]
- Their PM is the person who signs every change request [source: comms · 4 emails]
- José Álvarez: Infer360 support [source: comms · 1 email] <!-- pin:p7 -->

## How they like to be written to
- **Aparna** likes short emails, bullet points, no greetings [source: comms · 31 emails]

## Agreed
- Copyable link ships this week [source: comms/2026-10-03 re-link.eml · 3 Oct]

## Open right now
- Waiting on the tenant ID from Rahul [source: comms/2026-10-04 tenant.eml · 4 Oct]

## Latest activity
- Kickoff notes shared [source: notes/kickoff.md · 1 Oct]

## Words
- Tenant ID, copyable link; SSO [source: comms · 12 emails]
- **Hypercare** — the two weeks after go-live [source: agreements/sow.md · 12 Sep]
- \`ReportHub\` (the client's name for the module), RLS. [source: build/spec.md · 20 Sep]
- Change request: anything outside the SOW [source: agreements/sow.md · 12 Sep]
`

describe('termsFromSummary', () => {
  it('takes each People bullet\'s leading name and each Words bullet\'s terms from a real summary', () => {
    expect(termsFromSummary(SUMMARY)).toEqual({
      people: ['Aparna Rao', 'Rahul Mehta', 'Priya Shah', 'Dev Patel', 'Olu Ade', 'Sam', 'José Álvarez'],
      words: ['Tenant ID', 'copyable link', 'SSO', 'Hypercare', 'ReportHub', 'RLS', 'Change request'],
    })
  })

  it('skips sentences in People (more than 4 words, or a lowercase start), and bullets in other sections', () => {
    const { people, words } = termsFromSummary(SUMMARY)
    expect(people.join(' ')).not.toMatch(/Their|prefers|Aparna likes/)
    expect(words).not.toContain('Copyable link ships this week')
    expect(termsFromSummary('## People\n- Anna Maria Lopez Garcia Ruiz, sponsor').people).toEqual([])
    expect(termsFromSummary('## People\n- Anna Maria Lopez Garcia, sponsor').people).toEqual(['Anna Maria Lopez Garcia'])
  })

  it('reads headings at any level and any case, numbered bullets, CRLF, and drops duplicates', () => {
    const text = '### people:\r\n1. Aparna Rao — PM\r\n2. aparna rao, again\r\n* **Rahul**\r\n## WORDS\r\n- SSO, sso; Tenant ID\r\n'
    expect(termsFromSummary(text)).toEqual({ people: ['Aparna Rao', 'Rahul'], words: ['SSO', 'Tenant ID'] })
  })

  it('never throws on empty or odd input', () => {
    for (const odd of [undefined, null, '', 42, {}, [], '## People\n-\n- \n- **\n## Words\n- ,;, [source: x]']) {
      expect(termsFromSummary(odd)).toEqual({ people: [], words: [] })
    }
  })

  it('reads hand-edited People lines: nested notes, roles before the name, groups', () => {
    const text = [
      '## People',
      '- Client sponsor: Aparna Rao (Acme) — approves scope [source: comms · 3 emails]',
      '  - Prefers screenshots [source: comms · 2 emails]',
      '\t- Signs every change request',
      '- Finance team (Acme) — pays invoices',
      '- **Rahul Mehta** — CTO',
      '- _Priya Shah_ (Acme), delivery',
      '- Their PM: whoever signs the SOW',
    ].join('\n')
    expect(termsFromSummary(text).people).toEqual(['Aparna Rao', 'Rahul Mehta', 'Priya Shah'])
    // A list indented as a whole is still read; only lines deeper than the first bullet are notes.
    expect(termsFromSummary('## People\n  - Aparna Rao (PM)\n    - Prefers calls\n  - Rahul').people).toEqual(['Aparna Rao', 'Rahul'])
  })

  it('strips italics and source tags whose path holds brackets from Words', () => {
    const text = '## Words\n- _Hypercare_ — the two weeks after go-live\n- SSO [source: notes/[draft].md · 1 Oct]\n- tenant_id, *RLS* [source: a · 2 Oct]'
    expect(termsFromSummary(text).words).toEqual(['Hypercare', 'SSO', 'tenant_id', 'RLS'])
  })
})

describe('suggestProject', () => {
  const infer = project({ id: 'p1', name: 'Infer360', people: ['Aparna Rao', 'Rahul Mehta'], words: ['Tenant ID', 'copyable link'], defaultOutput: 'email' })

  it('matches the project name as a whole phrase, any case', () => {
    const acme = project({ id: 'p2', name: 'Acme Corp' })
    expect(suggestProject('send the acme   corp numbers', [acme], { pickOutput })).toEqual({ id: 'p2', name: 'Acme Corp', output: 'prompt' })
    expect(suggestProject('INFER360 is late again', [infer], { pickOutput })).toEqual({ id: 'p1', name: 'Infer360', output: 'email' })
    // Part of a word, or only part of the phrase: no match.
    expect(suggestProject('acmecorp and acme', [acme], { pickOutput })).toBeNull()
    expect(suggestProject('the Infer3600 build', [infer], { pickOutput })).toBeNull()
  })

  it('matches a person by full name, or by a first name of 4+ letters, and a term as a whole word', () => {
    expect(suggestProject('reply to Aparna about the launch', [infer], { pickOutput })).toEqual({ id: 'p1', name: 'Infer360', output: 'email' })
    expect(suggestProject("rahul mehta's sign-off is pending", [infer], { pickOutput })?.id).toBe('p1')
    expect(suggestProject('we still need the tenant id', [infer], { pickOutput })?.id).toBe('p1')
    // The surname alone isn't a match, and neither is a term's first word.
    expect(suggestProject('Mehta and tenant are both words here', [infer], { pickOutput })).toBeNull()
    // Unicode letters stay whole words.
    const es = project({ name: 'Madrid office', people: ['José Álvarez'] })
    expect(suggestProject('ask josé about it', [es], { pickOutput })?.name).toBe('Madrid office')
    expect(suggestProject('ask Joséa about it', [es], { pickOutput })).toBeNull()
  })

  it('ignores people and terms under 4 letters, including a short first name', () => {
    const short = project({ name: 'Northwind', people: ['Raj', 'Bo', 'Raj Kumar'], words: ['SSO', 'API', 'Q4'] })
    expect(suggestProject('Raj and Bo need the SSO API for Q4', [short], { pickOutput })).toBeNull()
    // The full name still counts once it has 4+ letters.
    expect(suggestProject('Raj Kumar needs the SSO', [short], { pickOutput })?.name).toBe('Northwind')
  })

  it('picks the project with the most distinct matches; its own name counts 2', () => {
    const acme = project({ id: 'acme', name: 'Acme', people: ['Priya Shah'], words: ['Hypercare'], lastUsedAt: 1 })
    const globex = project({ id: 'globex', name: 'Globex', people: ['Aparna Rao', 'Daniel Ito'], words: ['Hypercare'], lastUsedAt: 2 })
    // Acme: name (2) + Priya + Hypercare = 4 beats Globex: Aparna + Daniel + Hypercare = 3.
    expect(suggestProject('Acme: Priya, Aparna and Daniel on hypercare', [globex, acme], { pickOutput })?.id).toBe('acme')
    // Globex: Aparna + Daniel = 2 beats Acme: Priya = 1.
    expect(suggestProject('Priya, Aparna and Daniel', [acme, globex], { pickOutput })?.id).toBe('globex')
    // Acme: name alone (2) beats Globex: Daniel (1).
    expect(suggestProject('Acme with Daniel', [globex, acme], { pickOutput })?.id).toBe('acme')
  })

  it('counts each match once: repeats, a person found by both names, a term equal to the name', () => {
    const acme = project({ id: 'acme', name: 'Acme', people: ['Priya Shah'], words: ['acme', 'Hypercare'], lastUsedAt: 1 })
    const globex = project({ id: 'globex', name: 'Globex', people: ['Aparna Rao', 'Daniel Ito'], words: ['Tenant ID'], lastUsedAt: 2 })
    // Acme: "Acme" (2, not 3) + Priya once (1) = 3 ties Globex: Aparna + Daniel + Tenant ID = 3, so the newer wins.
    expect(suggestProject('Acme acme Priya Shah, Priya again; Aparna, Daniel, tenant ID', [acme, globex], { pickOutput })?.id).toBe('globex')
  })

  it('breaks a tie with the most recently used project, never-used counting oldest', () => {
    const a = project({ id: 'a', name: 'Alpha', people: ['Aparna Rao'], lastUsedAt: 100 })
    const b = project({ id: 'b', name: 'Beta', people: ['Aparna Rao'], lastUsedAt: 200 })
    const c = project({ id: 'c', name: 'Gamma', people: ['Aparna Rao'], lastUsedAt: null })
    const d = project({ id: 'd', name: 'Delta', people: ['Aparna Rao'] })
    expect(suggestProject('ask Aparna', [a, b, c], { pickOutput })?.id).toBe('b')
    expect(suggestProject('ask Aparna', [c, a], { pickOutput })?.id).toBe('a')
    // Neither ever used: the first listed stays.
    expect(suggestProject('ask Aparna', [c, d], { pickOutput })?.id).toBe('c')
    expect(suggestProject('ask Aparna', [d, c], { pickOutput })?.id).toBe('d')
  })

  it('needs at least one match of 4+ letters: a short project name alone never suggests', () => {
    const ops = project({ id: 'ops', name: 'Ops', people: ['Aparna Rao'] })
    for (const name of ['Ops', 'web', 'API', 'AI', 'X', '2026', 'Q4']) {
      expect(suggestProject(`the ${name} is down, fix it`, [project({ name })], { pickOutput })).toBeNull()
    }
    expect(suggestProject('the ops dashboard is down', [ops], { pickOutput })).toBeNull()
    // With a longer match the short name still counts its 2: Ops 2 + Aparna 1 beats Aparna + Daniel.
    const globex = project({ id: 'globex', name: 'Globex', people: ['Aparna Rao', 'Daniel Ito'], lastUsedAt: 9 })
    expect(suggestProject('ask Aparna and Daniel about the ops dashboard', [globex, ops], { pickOutput })?.id).toBe('ops')
  })

  it('counts one stretch of the dictation once, even when two entries cover it', () => {
    const both = project({ id: 'both', name: 'Alpha', people: ['Aparna', 'Aparna Rao'], words: ['Aparna Rao'], lastUsedAt: 1 })
    const one = project({ id: 'one', name: 'Beta', people: ['Aparna Rao'], lastUsedAt: 2 })
    // 1 each, so the newer project wins; scoring "Aparna Rao" three times would pick the older.
    expect(suggestProject('send it to Aparna Rao', [both, one], { pickOutput })?.id).toBe('one')
    expect(suggestProject('Aparna said yes, then Aparna Rao said no', [both, one], { pickOutput })?.id).toBe('one')
    // Two different people still count 2.
    const two = project({ id: 'two', name: 'Gamma', people: ['Aparna Rao', 'Daniel Ito'], lastUsedAt: 0 })
    expect(suggestProject('Aparna Rao and Daniel', [one, two], { pickOutput })?.id).toBe('two')
  })

  it('matches names however they are spelled out: accents decomposed, honorifics, groups', () => {
    const es = project({ name: 'Madrid office', people: ['José Álvarez'] })
    expect(suggestProject('ask josé about it', [es], { pickOutput })?.name).toBe('Madrid office')
    const dr = project({ name: 'Clinic', people: ['Dr. Aparna Rao', 'Dr Raj'] })
    expect(suggestProject('ask Aparna about it', [dr], { pickOutput })?.name).toBe('Clinic')
    expect(suggestProject('ask Dr Aparna Rao about it', [dr], { pickOutput })?.name).toBe('Clinic')
    expect(suggestProject('ask Raj about it', [dr], { pickOutput })).toBeNull()
    // A group's first word alone is a common word, so only the whole name counts.
    const fin = project({ name: 'Northwind', people: ['Finance Team'] })
    expect(suggestProject('finance said no', [fin], { pickOutput })).toBeNull()
    expect(suggestProject('the finance team said no', [fin], { pickOutput })?.name).toBe('Northwind')
  })

  it('stays fast on a cold call with hundreds of names (it runs in the main process)', () => {
    // Unique names so nothing is cached; one regex per name used to cost ~650 ms here.
    let n = 0
    const name = () => `Zq${(n++).toString(36)}vel`
    const projects = Array.from({ length: 10 }, (_, i) =>
      project({ id: `p${i}`, name: `Project ${name()}`, people: Array.from({ length: 30 }, () => `${name()} ${name()}`), words: Array.from({ length: 30 }, name) }))
    const started = performance.now()
    expect(suggestProject('please send the numbers to the client before the launch', projects, { pickOutput })).toBeNull()
    expect(performance.now() - started).toBeLessThan(100)
  })

  it('returns null when nothing matches', () => {
    expect(suggestProject('buy milk and call mum', [infer], { pickOutput })).toBeNull()
    expect(suggestProject('Aparna', [], { pickOutput })).toBeNull()
  })

  it('asks pickOutput for the output with the dictation and the project default', () => {
    const pick = vi.fn(() => 'polish')
    expect(suggestProject('Aparna wants the status', [infer], { pickOutput: pick })).toEqual({ id: 'p1', name: 'Infer360', output: 'polish' })
    expect(pick).toHaveBeenCalledWith('Aparna wants the status', 'email')
    expect(pick).toHaveBeenCalledTimes(1)
    // Without one, the project's default (or Prompt) is used.
    expect(suggestProject('Aparna wants the status', [infer])?.output).toBe('email')
    expect(suggestProject('Aparna wants it', [{ id: 'x', name: 'X', people: ['Aparna'] }], null)?.output).toBe('prompt')
    expect(suggestProject('Aparna wants it', [project({ name: 'Y', people: ['Aparna'], defaultOutput: 'xyz' })])?.output).toBe('prompt')
  })

  it('never throws on empty or odd input', () => {
    const odd = [null, 7, 'text', {}, { name: 5, people: 'Aparna', words: [null, 3, {}, '  '] }, { id: 'ok', name: '***', people: [' '], words: ['(', '[x'] }]
    for (const text of [undefined, null, '', '   ', 42, {}, 'Aparna (+[ *** ']) {
      expect(() => suggestProject(text, odd, { pickOutput })).not.toThrow()
      expect(suggestProject(text, odd, { pickOutput })).toBeNull()
    }
    expect(suggestProject('Aparna', undefined)).toBeNull()
    expect(suggestProject('Aparna', 'Infer360')).toBeNull()
    // Regex characters in names are matched literally.
    const dotted = project({ id: 'n', name: 'Node.js (v2)', people: ['A.J. Smith'], words: ['C++ build', 'R&D team'] })
    expect(suggestProject('the nodexjs app', [dotted], { pickOutput })).toBeNull()
    expect(suggestProject('the node.js (v2) app', [dotted], { pickOutput })?.id).toBe('n')
    expect(suggestProject('the r&d team and the c++ build', [dotted], { pickOutput })?.id).toBe('n')
  })

  it('works on terms read from a summary', () => {
    const terms = termsFromSummary(SUMMARY)
    const p = project({ id: 'p1', name: 'Infer360', defaultOutput: 'polish', ...terms })
    expect(suggestProject('Reply to José, the hypercare plan is fine', [p], { pickOutput })).toEqual({ id: 'p1', name: 'Infer360', output: 'email' })
    expect(suggestProject('ask Olu for the mockups', [p], { pickOutput })).toBeNull() // "Olu Ade": first name too short
    expect(suggestProject('ask Sam for the bugs', [p], { pickOutput })).toBeNull()
    expect(suggestProject('their PM prefers screenshots', [p], { pickOutput })).toBeNull()
  })
})
