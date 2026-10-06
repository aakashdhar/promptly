'use strict';

// After a dictation, offers "As an <Project> email" when the text mentions a project (spec G26).
// Pure word matching against names already in the summary: no AI call, and Dictation itself
// never sees any of this.

const { parseSections } = require('./summary');

const MIN_LETTERS = 4;
const MAX_NAME_WORDS = 4;
const OUTPUTS = ['email', 'prompt', 'polish'];
// Far beyond any real dictation; keeps the main process responsive whatever arrives.
const MAX_TEXT = 50000;

// [\p{M}] keeps combining marks inside a word, so a match never ends mid-syllable.
const WORD_BEFORE = /[\p{L}\p{M}\p{N}]$/u;
const WORD_AFTER = /^[\p{L}\p{M}\p{N}]/u;
const HAS_WORD = /[\p{L}\p{N}]/u;
const LETTER = /\p{L}/gu;
const LOWER_START = /^\p{Ll}/u;
const ACRONYM = /^\p{Lu}{2,}$/u;
const HEADING = /^\s{0,3}#{1,6}\s/;
const LIST_ITEM = /^([ \t]*)(?:[-*+•]|\d+[.)])\s/;
// Tags close each bullet, and a path may itself hold brackets ("notes/[draft].md").
const SOURCE_TAG = /[[(] ?sources? ?:.*$/i;
// Run on whitespace-collapsed text, so the spaces around a dash are single.
// Where a name stops and the role or notes begin: "Aparna Rao (PM) — approves scope".
const NAME_END = / -{1,2} |[,;:(\[–—]/;
// Where a term stops and its definition begins: "Tenant ID — what they must send".
const TERM_END = / -{1,2} |[:–—]/;
// The lookbehind starts each try at the beginning of a run, so a long run costs one pass.
const TRAILING_DOTS = /(?<!\.)\.+$/;
const TRAILING_STOPS = /(?<![.!?])[.!?]+$/;
const PARENS = /\([^()]*\)/g;
// Bold, italics, code and quotes; an underscore inside a word ("tenant_id") stays.
const EMPHASIS = /[*`"“”]+|(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu;
const HONORIFIC = /^(?:mr|mrs|ms|mx|dr|prof|sir|dame)\.?\s+/i;
// "Their PM: …" is capitalised like a name, and "their" alone would match nearly any dictation.
const DETERMINER = /^(?:the|our|their|his|her|its|my|your|this|that|these|those|each|every|all|any|some|both)$/i;
// "Finance Team" is a group: "finance" alone says nothing about this project.
const GROUP = /\s(?:team|department|dept|group|office|board|committee|division|unit|council)$/i;
// A hand-edited line that says nobody is known yet; "none" would match far too much.
const PLACEHOLDER = /^(?:none|none yet|nobody|no one|nothing|unknown|not known|tbd|tba|tbc|n\/a|na)$/i;
// The words of a role or a label, so "PM: Aparna Rao" yields the person, not the role.
const ROLE = /^(?:pm|po|qa|ba|vp|ceo|cto|cfo|coo|cio|cmo|lead|head|chief|manager|director|officer|owner|sponsor|contact|client|customer|stakeholder|approver|reviewer|engineer|developer|designer|analyst|architect|consultant|admin|support|sales|marketing|product|engineering|finance|legal|hr|ops|operations|founder|partner|president|assistant|coordinator|accountant|counsel|delivery|project|account|tech|technical)$/i;

const clean = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
const letters = (value) => (value.match(LETTER) || []).length;
// One form for the dictation and every name: composed accents, lower case, single spaces.
const fold = (value) => value.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
const listOf = (value) => (Array.isArray(value) ? value : []);

function addUnique(list, seen, value) {
  const key = value && value.toLowerCase();
  if (!key || seen.has(key)) return;
  seen.add(key);
  list.push(value);
}

// Only a list's own items name someone or something. A deeper bullet (2+ spaces in) or an
// indented line is a note about the item above ("  - Prefers screenshots"), so it is blanked
// before summary.js reads the sections. Lines go on with single spaces: summary.js's heading
// pattern slows down on a long run of them.
function topLevelOnly(text) {
  let top = null;
  return text.split(/\r?\n/).map((line) => {
    const item = LIST_ITEM.exec(line);
    if (item) {
      const indent = item[1].replace(/\t/g, '    ').length;
      if (top !== null && indent >= top + 2) return '';
      top = top === null ? indent : Math.min(top, indent);
    } else if (line.trim()) {
      if (top !== null && !HEADING.test(line) && /^\s/.test(line)) return '';
      top = null;
    }
    return clean(line);
  }).join('\n');
}

// An unclosed "<!--" hides the rest of the line. indexOf, not a lazy regex: one pass however
// many there are.
function withoutComments(line) {
  let out = '';
  let at = 0;
  for (let open = line.indexOf('<!--'); open !== -1; open = line.indexOf('<!--', at)) {
    out += `${line.slice(at, open)} `;
    const close = line.indexOf('-->', open + 4);
    if (close === -1) return out;
    at = close + 3;
  }
  return out + line.slice(at);
}

const bodyOf = (line) => clean(withoutComments(line)).replace(SOURCE_TAG, '').trim();

// One to four words, first and last not lowercase: a name rather than a role ("Client sponsor"),
// a group ("Finance team") or a sentence about someone, which would make common words
// ("their", "prefers") look like people.
function asName(value) {
  const name = clean(value).replace(TRAILING_DOTS, '');
  if (!HAS_WORD.test(name) || PLACEHOLDER.test(name)) return '';
  const words = name.split(' ');
  if (words.length > MAX_NAME_WORDS) return '';
  if (LOWER_START.test(words[0]) || LOWER_START.test(words[words.length - 1]) || DETERMINER.test(words[0])) return '';
  return name;
}

// A role or a label rather than a person: "PM", "Client sponsor", "Head of Sales". As a "name" its
// first word ("product", "head") would match nearly any dictation.
function isRole(name) {
  const words = name.split(' ');
  return words.every((word) => ACRONYM.test(word)) || words.some((word) => ROLE.test(word));
}

// "PM: Aparna Rao", "Acme: Jo Bloggs" and "Sponsor — Rahul Mehta" put a label first;
// "Rahul: Head of Sales" and "José Álvarez: Infer360 support" put the person first.
function pickAroundLabel(lead, after) {
  if (!after || isRole(after)) return lead;
  if (!lead || isRole(lead)) return after;
  return !lead.includes(' ') && after.includes(' ') ? after : lead;
}

// A People bullet starts with the person: bold if the summary bolded it, else the words before
// the role. After a colon, or a dash that follows a role, the person may come second.
function leadingName(body) {
  const bold = body.match(/^(\*\*|__)(.+?)\1/);
  const label = bold && (bold[2].includes(':') || body.slice(bold[0].length).trimStart().startsWith(':'));
  const bolded = bold && !label && asName(clean(bold[2].replace(EMPHASIS, '')).split(NAME_END)[0]);
  if (bolded && !isRole(bolded)) return bolded;
  const plain = clean(body.replace(EMPHASIS, ''));
  const end = plain.match(NAME_END);
  const lead = asName(end ? plain.slice(0, end.index) : plain);
  const labelled = end && (end[0] === ':' || (isRole(lead) && /[-–—]/.test(end[0])));
  const name = labelled ? pickAroundLabel(lead, asName(plain.slice(end.index + end[0].length).split(NAME_END)[0])) : lead;
  return name && !isRole(name) ? name : '';
}

function termsOf(body) {
  // Parens twice, for one level of nesting: "ReportHub (the client's (old) name)".
  return clean(body.replace(EMPHASIS, '').replace(PARENS, ' ').replace(PARENS, ' '))
    .split(TERM_END)[0]
    .split(/[,;]/)
    .map((term) => clean(term).replace(TRAILING_STOPS, ''))
    .filter((term) => HAS_WORD.test(term) && !PLACEHOLDER.test(term));
}

// The People and Words of a summary, read with summary.js's own section rules (headings like
// "## People (both sides)" or "Glossary", "People:" lines, "•" bullets).
function termsFromSummary(summaryText) {
  const people = [];
  const words = [];
  if (typeof summaryText !== 'string') return { people, words };
  const sections = parseSections(topLevelOnly(summaryText));
  const seenPeople = new Set();
  const seenWords = new Set();
  for (const line of sections.People) addUnique(people, seenPeople, leadingName(bodyOf(line)));
  for (const line of sections.Words) for (const term of termsOf(bodyOf(line))) addUnique(words, seenWords, term);
  return { people, words };
}

// Every place the phrase stands as whole words in the folded dictation. Plain indexOf, not a
// regex per name: a Unicode-class regex costs ~1 ms to compile, V8 drops its cache on a major GC,
// and this runs in the main process after every dictation (~650 ms cold for 10 big projects).
function spansOf(text, phrase) {
  const spans = [];
  if (!HAS_WORD.test(phrase)) return spans;
  for (let at = text.indexOf(phrase); at !== -1; at = text.indexOf(phrase, at + 1)) {
    const end = at + phrase.length;
    if (!WORD_BEFORE.test(text.slice(Math.max(0, at - 2), at)) && !WORD_AFTER.test(text.slice(end, end + 2))) {
      spans.push([at, end]);
    }
  }
  return spans;
}

// What a project can be found by. A person is found by the full name, or by the first name alone
// when it is long enough to be distinctive (firstName marks those weaker finds).
function entriesOf(project) {
  const entries = [];
  const name = clean(project.name);
  if (name) entries.push({ weight: 2, short: letters(name) < MIN_LETTERS, phrases: [{ phrase: fold(name), firstName: false }] });
  for (const person of listOf(project.people)) {
    const full = clean(person).replace(HONORIFIC, '');
    if (letters(full) < MIN_LETTERS) continue;
    const phrases = [{ phrase: fold(full), firstName: false }];
    const first = full.split(' ')[0];
    if (first !== full && letters(first) >= MIN_LETTERS && !GROUP.test(full)) phrases.push({ phrase: fold(first), firstName: true });
    entries.push({ weight: 1, short: false, phrases });
  }
  for (const term of listOf(project.words).map(clean)) {
    if (letters(term) >= MIN_LETTERS) entries.push({ weight: 1, short: false, phrases: [{ phrase: fold(term), firstName: false }] });
  }
  return entries;
}

// Each stretch of the dictation that some name covers, with every entry that claims it.
function stretchesOf(text, entries) {
  const byPlace = new Map();
  for (const entry of entries) {
    for (const { phrase, firstName } of entry.phrases) {
      for (const [start, end] of spansOf(text, phrase)) {
        const key = start * (text.length + 1) + end;
        let stretch = byPlace.get(key);
        if (!stretch) byPlace.set(key, (stretch = { start, end, full: false, claims: [] }));
        if (!firstName) stretch.full = true;
        stretch.claims.push({ entry, firstName });
      }
    }
  }
  return [...byPlace.values()];
}

// Who gets an unclaimed stretch: an entry already counted (the second "Priya" after "Priya
// Shah"), else the first full-name claim (claims follow entry order, so the project's own name
// leads), else the first claim.
function claimant(claims) {
  return claims.find((claim) => claim.entry.counted) || claims.find((claim) => !claim.firstName) || claims[0];
}

// Distinct things found: the project's own name counts 2, each person or term 1. Each stretch of
// the dictation goes to one entry, full names before first names alone and longer before shorter,
// so "Priya Patel" can't swallow the "Priya" of "Priya Shah", "Aparna Rao" isn't counted again as
// "Aparna", and a project called "Rao" isn't found in "Aparna Rao". A name under 4 letters
// ("web", "Q4", "2026") only adds to a match; on its own it is too common to suggest anything.
function scoreOf(text, project) {
  const entries = entriesOf(project);
  const stretches = stretchesOf(text, entries);
  if (!stretches.length) return 0;
  stretches.sort((a, b) => b.full - a.full || (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const taken = new Uint8Array(text.length);
  let score = 0;
  let distinctive = false;
  for (const { start, end, claims } of stretches) {
    if (taken.subarray(start, end).includes(1)) continue;
    taken.fill(1, start, end);
    const { entry } = claimant(claims);
    if (entry.counted) continue;
    entry.counted = true;
    score += entry.weight;
    if (!entry.short) distinctive = true;
  }
  return distinctive ? score : 0;
}

const usedAt = (project) => (Number.isFinite(project.lastUsedAt) ? project.lastUsedAt : -Infinity);

// pickOutput is context.js's §17 phrase rule, passed in by main.js.
function suggestProject(text, projects, options) {
  if (typeof text !== 'string' || !text.trim() || !Array.isArray(projects)) return null;
  const pickOutput = options && options.pickOutput;
  const folded = fold(text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text);
  let best = null;
  let bestScore = 0;
  for (const project of projects) {
    if (!project || typeof project !== 'object') continue;
    const score = scoreOf(folded, project);
    if (!score) continue;
    if (score > bestScore || (score === bestScore && usedAt(project) > usedAt(best))) {
      best = project;
      bestScore = score;
    }
  }
  if (!best) return null;
  let output = OUTPUTS.includes(best.defaultOutput) ? best.defaultOutput : 'prompt';
  if (typeof pickOutput === 'function') output = pickOutput(text, best.defaultOutput);
  return { id: best.id, name: best.name, output };
}

module.exports = { suggestProject, termsFromSummary };
