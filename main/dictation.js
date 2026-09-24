'use strict';

// Dictation: what you said, as you said it. Unlike other voice apps, nothing is rewritten. The
// only changes are hesitation sounds (um, uh…) and the spoken line-break commands, and every
// removed word is reported back so the UI can show exactly what was taken out.

// Pure hesitation sounds only. Words like "like", "so" or "you know" can carry meaning, so they
// always stay.
const FILLER = /(^|[\s,.;:!?(]|--)(u+m+|u+h+m*|e+r+m+|e+r+|a+h+|h+m+|m+h*m+)(?=$|[\s,.;:!?)])/gi;

// "new line" / "new paragraph", said on their own, possibly with the punctuation Whisper adds.
const LINE_COMMAND = /[,;:]?\s*\b(new paragraph|next paragraph|new line|next line)\b[.,!?]?\s*/gi;

// Marks where a capitalised filler ("Um, so…") started a sentence, so only the word that now
// starts it gets a capital. Nothing else about the user's casing changes.
const SENTENCE_START = '\u0001';

function tidyDictation(transcript, { removeFillers = true } = {}) {
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

  text = text.replace(LINE_COMMAND, (_m, command) => (/paragraph/i.test(command) ? '\n\n' : '\n'));

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

module.exports = { tidyDictation, describeRemoved };
