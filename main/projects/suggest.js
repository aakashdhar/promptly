'use strict';

// After a dictation, offers "As an <Project> email" when the text mentions a project (spec G26).
// Pure word matching against names already in the summary: no AI call, and Dictation itself
// never sees any of this.

const MIN_LETTERS = 4;
const MAX_NAME_WORDS = 4;
const OUTPUTS = ['email', 'prompt', 'polish'];

// [\p{M}] keeps combining marks inside a word, so a match never ends mid-syllable.
const WORD_BEFORE = /[\p{L}\p{M}\p{N}]$/u;
const WORD_AFTER = /^[\p{L}\p{M}\p{N}]/u;
const HAS_WORD = /[\p{L}\p{N}]/u;
const LETTER = /\p{L}/gu;
const LOWER_START = /^\p{Ll}/u;
const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;
const BULLET = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;
// Tags close each bullet, and a path may itself hold brackets ("notes/[draft].md").
const SOURCE_TAG = /\[source:.*$/i;
const COMMENT = /<!--[\s\S]*?-->/g;
// Where a name stops and the role or notes begin: "Aparna Rao (PM) — approves scope".
const NAME_END = /\s+-{1,2}\s+|[,;:(\[–—]/;
// Where a term stops and its definition begins: "Tenant ID — what they must send".
const TERM_END = /\s+-{1,2}\s+|[:–—]/;
// Bold, italics, code and quotes; an underscore inside a word ("tenant_id") stays.
const EMPHASIS = /[*`"“”]+|(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu;
const HONORIFIC = /^(?:mr|mrs|ms|mx|dr|prof|sir|dame)\.?\s+/i;
// "Their PM: …" is capitalised like a name, and "their" alone would match nearly any dictation.
const DETERMINER = /^(?:the|our|their|his|her|its|my|your|this|that|these|those|each|every|all|any|some|both)$/i;
// "Finance Team" is a group: "finance" alone says nothing about this project.
const GROUP = /\s(?:team|department|dept|group|office|board|committee|division|unit|council)$/i;

const clean = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
const keyOf = (value) => value.toLowerCase();
const letters = (value) => (value.match(LETTER) || []).length;
// One form for the dictation and every name: composed accents, lower case, single spaces.
const fold = (value) => value.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');

function addUnique(list, value) {
  if (value && !list.some((item) => keyOf(item) === keyOf(value))) list.push(value);
}

function sectionOf(heading) {
  return heading.replace(/[*_#:]/g, '').trim().toLowerCase();
}

// One to four words, first and last not lowercase: a name rather than a role ("Client sponsor"),
// a group ("Finance team") or a sentence about someone, which would make common words
// ("their", "prefers") look like people.
function asName(value) {
  const name = clean(value).replace(/\.+$/, '');
  const words = name ? name.split(' ') : [];
  if (!words.length || words.length > MAX_NAME_WORDS) return '';
  if (LOWER_START.test(words[0]) || LOWER_START.test(words[words.length - 1]) || DETERMINER.test(words[0])) return '';
  return name;
}

// A People bullet starts with the person: bold if the summary bolded it, else the words before
// the role. A hand-edited "Client sponsor: Aparna Rao" puts the role first, so after a colon is
// tried too.
function leadingName(body) {
  const bold = body.match(/^(\*\*|__)(.+?)\1/);
  const bolded = bold && asName(bold[2].split(NAME_END)[0]);
  if (bolded) return bolded;
  const plain = body.replace(EMPHASIS, '');
  const end = plain.match(NAME_END);
  const lead = asName(end ? plain.slice(0, end.index) : plain);
  if (lead || !end || end[0] !== ':') return lead;
  return asName(plain.slice(end.index + 1).split(NAME_END)[0]);
}

function termsOf(body) {
  const head = body.replace(EMPHASIS, '').replace(/\([^)]*\)/g, ' ').split(TERM_END)[0];
  return head.split(/[,;]/).map((term) => clean(term).replace(/[.!?]+$/, '').trim()).filter(Boolean);
}

function termsFromSummary(summaryText) {
  const people = [];
  const words = [];
  if (typeof summaryText !== 'string') return { people, words };
  let section = '';
  let top = null;
  for (const line of summaryText.split(/\r?\n/)) {
    const heading = line.match(HEADING);
    if (heading) {
      section = sectionOf(heading[1]);
      top = null;
      continue;
    }
    const bullet = line.match(BULLET);
    if (!bullet || (section !== 'people' && section !== 'words')) continue;
    // A nested bullet is detail about the line above ("  - Prefers screenshots"), not a new entry.
    const indent = bullet[1].replace(/\t/g, '    ').length;
    top = top === null ? indent : Math.min(top, indent);
    if (indent > top) continue;
    const body = bullet[2].replace(COMMENT, ' ').replace(SOURCE_TAG, ' ').trim();
    if (section === 'people') addUnique(people, leadingName(body));
    else for (const term of termsOf(body)) addUnique(words, term);
  }
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

// The full name, plus the first name alone when it is long enough to be distinctive.
function personSpans(text, person) {
  const name = clean(person).replace(HONORIFIC, '');
  if (letters(name) < MIN_LETTERS) return [];
  const spans = spansOf(text, fold(name));
  const first = name.split(' ')[0];
  if (first !== name && letters(first) >= MIN_LETTERS && !GROUP.test(name)) spans.push(...spansOf(text, fold(first)));
  return spans;
}

const overlaps = (a, b) => a[0] < b[1] && b[0] < a[1];

// Distinct things found: the project's own name counts 2, each person or term 1. Each stretch of
// the dictation counts once, longest names first, so "Aparna Rao" isn't scored again as a separate
// "Aparna", nor a term that is just the project's name. A name under 4 letters ("web", "Q4",
// "2026") only adds to a match; on its own it is too common to suggest anything.
function scoreOf(text, project) {
  const name = clean(project.name);
  const people = Array.isArray(project.people) ? project.people : [];
  const words = Array.isArray(project.words) ? project.words : [];
  const entries = [
    ...people.map((person) => ({ size: clean(person).length, spans: personSpans(text, person) })),
    ...words
      .map(clean)
      .filter((term) => letters(term) >= MIN_LETTERS)
      .map((term) => ({ size: term.length, spans: spansOf(text, fold(term)) })),
  ].sort((a, b) => b.size - a.size);
  if (name) entries.unshift({ weight: 2, short: letters(name) < MIN_LETTERS, spans: spansOf(text, fold(name)) });

  const claimed = [];
  let score = 0;
  let distinctive = false;
  for (const { spans, weight = 1, short = false } of entries) {
    if (!spans.some((span) => !claimed.some((taken) => overlaps(span, taken)))) continue;
    claimed.push(...spans);
    score += weight;
    if (!short) distinctive = true;
  }
  return distinctive ? score : 0;
}

const usedAt = (project) => (Number.isFinite(project.lastUsedAt) ? project.lastUsedAt : -Infinity);

// pickOutput is context.js's §17 phrase rule, passed in by main.js.
function suggestProject(text, projects, options) {
  if (typeof text !== 'string' || !text.trim() || !Array.isArray(projects)) return null;
  const pickOutput = options && options.pickOutput;
  const folded = fold(text);
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
