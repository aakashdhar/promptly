'use strict';

// Dictation: what you said, as you said it. The local tidy only removes hesitation sounds (um,
// uh…), handles the spoken line-break commands, writes money as symbols and puts a question mark
// on sentences that open like a question; every removed word is reported back so the UI can show
// exactly what was taken out. Claude's clean-up (D-DICTATION-CLEANUP) runs after this in main.js
// and only fixes misheard words and punctuation; acceptCleanup() throws out anything more.

// Pure hesitation sounds only. Words like "like", "so" or "you know" can carry meaning, so they
// always stay.
// "Er" only counts when a pause follows it ("Er, yes"), since "err" is also a word ("to err").
const FILLER = /(^|[\s,.;:!?(]|--)(u+m+|u+h+m*|e+r+m+|e+r+(?=[,.;:!?)]|$)|a+h+|h+m+|m+h*m+)(?=$|[\s,.;:!?)])/gi;

// "new line" / "new paragraph", said on their own: at the start, after a pause (punctuation
// before it) or followed by one. "a new line of products" is left as said.
const LINE_COMMAND = /(^|[.,!?;:])?(\s*)\b(new paragraph|next paragraph|new line|next line)\b([.,!?])?\s*/gi;

// Money and percentages said as words become symbols ("12,450 rupees" → "₹12,450",
// "25 percent" → "25%"). Pounds stay as said: they're as often weight as money. Only the unit word moves; the number and everything else stay as said.
const AMOUNT = '(\\d[\\d,]*(?:\\.\\d+)?)';
const SYMBOLS = [
  [new RegExp(`\\b(?:rs\\.?|inr)\\s?${AMOUNT}(?![\\d,])`, 'gi'), (_m, n) => `₹${n}`],
  [new RegExp(`\\b${AMOUNT}\\s(?:rupees?|rs\\b|inr\\b)`, 'gi'), (_m, n) => `₹${n}`],
  [new RegExp(`\\b${AMOUNT}\\s(?:dollars?|usd\\b)`, 'gi'), (_m, n) => `$${n}`],
  [new RegExp(`\\b${AMOUNT}\\s(?:euros?)\\b`, 'gi'), (_m, n) => `€${n}`],
  [new RegExp(`\\b${AMOUNT}\\s?(?:percent|per cent)\\b`, 'gi'), (_m, n) => `${n}%`],
];

function formatSymbols(text) {
  return SYMBOLS.reduce((t, [pattern, replace]) => t.replace(pattern, replace), text);
}

// Marks where a capitalised filler ("Um, so…") started a sentence, so only the word that now
// starts it gets a capital. Nothing else about the user's casing changes.
const SENTENCE_START = '\u0001';

// Speech models often end a spoken question with a full stop. A sentence that opens the way
// questions do gets a question mark instead: a question word followed by a verb ("What is…",
// "Why did…", "How do…") or a verb followed by who it's about ("Can you…", "Is it…",
// "Do we…"). "What I mean is…" and "How we did it." open like statements and are left alone.
const AUX = "is|are|am|was|were|does|did|can|could|would|should|will|shall|may|might|must|has|isn't|aren't|wasn't|weren't|doesn't|didn't|can't|couldn't|wouldn't|shouldn't|won't|haven't|hasn't";
// "Do the dishes", "Have a look", "Don't forget": these open with a verb but give an order, so
// they count as questions only when a person follows ("Do you…", "Have we…").
const AUX_PERSON_ONLY = "do|have|had|don't";
const PERSON = 'you|we|i|he|she|they|anyone|anybody|someone|somebody|everyone';
const THING = 'it|this|that|these|those|there|the|a|an|my|your|our|their|his|her|its';
// Lead-in words people say before a question: "So how…", "Hey, can you…", "Okay, is it…".
const LEAD = '(?:(?:so|and|but|hey|okay|ok|also|well|now|oh|right|then|sorry|quick question),?\\s+)*';
const WH_QUESTION = new RegExp(`^${LEAD}(?:what|why|how|when|where|who|whom|whose|which)\\s+(?:${AUX}|${AUX_PERSON_ONLY}|about|if|else)\\b`, 'i');
const WH_CONTRACTION = new RegExp(`^${LEAD}(?:what|why|how|when|where|who)'(?:s|re)\\b`, 'i');
const YES_NO_QUESTION = new RegExp(`^${LEAD}(?:(?:${AUX})\\s+(?:${PERSON}|${THING})|(?:${AUX_PERSON_ONLY})\\s+(?:${PERSON}))\\b`, 'i');
function fixQuestionMarks(text) {
  return text.replace(/(^|[.!?]\s+|\n)([^.!?\n]+)\.(?=\s|$)/g, (m, before, sentence) => {
    const s = sentence.trim();
    return WH_QUESTION.test(s) || WH_CONTRACTION.test(s) || YES_NO_QUESTION.test(s) ? `${before}${sentence}?` : m;
  });
}

// Claude's clean-up is kept only when it looks like the same text with a few words and marks
// fixed: never empty, no preamble, no extra lines, about the same number of words. Anything
// else (an answer to the dictated question, a rewrite) is dropped and the local text is used.
function acceptCleanup(original, cleaned) {
  let out = String(cleaned || '').trim()
    .replace(/^<transcript>\s*/i, '').replace(/\s*<\/transcript>$/i, '')
    .replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '')
    .trim();
  if (out.length > 1 && /^["“]/.test(out) && /["”]$/.test(out) && !/^["“]/.test(original.trim())) out = out.slice(1, -1).trim();
  if (!out) return null;
  const words = (t) => t.split(/\s+/).filter(Boolean).length;
  const before = words(original), after = words(out);
  const slack = Math.max(2, Math.round(before * 0.3));
  if (Math.abs(after - before) > slack) return null;
  if ((out.match(/\n/g) || []).length > (original.match(/\n/g) || []).length + 1) return null;
  if (/^(here|sure|certainly|corrected|the corrected)\b/i.test(out) && !/^(here|sure|certainly|corrected|the corrected)\b/i.test(original.trim())) return null;
  return capitaliseSentences(out);
}

// Claude sometimes leaves a sentence starting in lower case. Only an all-lowercase first word
// gets a capital, so "iPhone" or "eBay" at the start stays as written.
function capitaliseSentences(text) {
  return text.replace(/(^|[.!?]\s+|\n\s*)([a-z][a-z']*)(?=[\s,.;:!?]|$)/g, (_m, before, word) => before + word[0].toUpperCase() + word.slice(1));
}

function tidyDictation(transcript, { removeFillers = true, symbols = true } = {}) {
  let text = String(transcript || '').trim();
  const removed = [];

  if (removeFillers) {
    text = text.replace(FILLER, (_m, before, word) => {
      removed.push(word.toLowerCase());
      return before + (word[0] === word[0].toUpperCase() ? SENTENCE_START : '');
    });
    // Tidy the punctuation a removed filler leaves behind: "So, , we" → "So, we", ", we" at the start.
    text = text
      .replace(/,(\s*,)+/g, '')                        // "should, , ship" (was ", uh,") → "should ship"
      .replace(/([;:])(\s*[,;:])+/g, '$1')
      .replace(/(^|[.!?]\s+)(\u0001?)[,.;:!?]+\s*/g, '$1$2') // a sentence that was only a filler
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/\u0001[\s,;:]*([a-z])/g, (_m, ch) => ch.toUpperCase())
      .replace(/\u0001[\s,;:]*/g, '');
  }

  if (symbols) text = formatSymbols(text);

  text = text.replace(LINE_COMMAND, (m, before, _space, command, after, offset, whole) => {
    if (before === undefined && after === undefined && offset + m.length < whole.length) return m;
    // A full stop before the command ends the sentence and stays; a comma was only the pause.
    const keep = before && /[.!?]/.test(before) ? before : '';
    return keep + (/paragraph/i.test(command) ? '\n\n' : '\n');
  });

  text = fixQuestionMarks(text);

  text = text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text, removed };
}

// "um ×2, uh" for the note under a dictation.
function describeRemoved(removed) {
  const counts = new Map();
  for (const word of removed) counts.set(word, (counts.get(word) || 0) + 1);
  return [...counts].map(([word, n]) => (n > 1 ? `${word} ×${n}` : word)).join(', ');
}

module.exports = { fixQuestionMarks, acceptCleanup, tidyDictation, describeRemoved, formatSymbols };
