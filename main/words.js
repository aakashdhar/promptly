'use strict';

// "Your words": names and terms Whisper should listen for, plus corrections for words it keeps
// getting wrong ("N10 → n8n"). Both live in the one `dictionary` setting, one entry per line, so
// older configs (a comma-separated word list) keep working unchanged.

const ARROW = /\s*(?:→|->)\s*/;
const MAX_ENTRIES = 200;

function parseWords(dictionary) {
  const words = [];
  const corrections = [];
  for (const raw of String(dictionary || '').split(/[\n,]/)) {
    const entry = raw.trim();
    if (!entry) continue;
    const parts = entry.split(ARROW);
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      corrections.push({ from: parts[0].trim(), to: parts[1].trim() });
    } else if (parts.length === 1) {
      words.push(entry);
    }
  }
  return { words: words.slice(0, MAX_ENTRIES), corrections: corrections.slice(0, MAX_ENTRIES) };
}

function serializeWords({ words = [], corrections = [] } = {}) {
  return [...words, ...corrections.map((c) => `${c.from} → ${c.to}`)].join('\n');
}

// What Whisper is told to listen for, and what Claude is told to spell exactly.
function hintWords(parsed) {
  return [...new Set([...parsed.words, ...parsed.corrections.map((c) => c.to)])];
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Whole words only, any case: "N10" and "n10" both become "n8n", but "N100" is left alone.
function applyCorrections(text, corrections) {
  let out = String(text || '');
  for (const { from, to } of corrections) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(from)}(?![\\p{L}\\p{N}])`, 'giu');
    // A function, so a "$&" or "$1" the user typed is inserted as written.
    out = out.replace(pattern, () => to);
  }
  return out;
}

// ── Suggestions from the user's edits ──

const MAX_TOKENS = 600;
const MAX_RUN = 3;

function tokens(text) {
  return String(text || '').split(/\s+/).map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean).slice(0, MAX_TOKENS);
}

// Runs of words that were swapped for other words: the gaps between the longest common
// subsequence of the two token lists.
function replacedRuns(before, after) {
  const a = tokens(before);
  const b = tokens(after);
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const runs = [];
  let i = 0;
  let j = 0;
  let from = [];
  let to = [];
  const flush = () => {
    if (from.length && to.length && from.length <= MAX_RUN && to.length <= MAX_RUN) runs.push({ from: from.join(' '), to: to.join(' ') });
    from = [];
    to = [];
  };
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { flush(); i++; j++; }
    else if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) { to.push(b[j]); j++; }
    else { from.push(a[i]); i++; }
  }
  flush();
  return runs;
}

// Corrections the user made the same way in at least two separate edits, which aren't already
// in their list and weren't dismissed. Most frequent first.
function suggestCorrections(edits, parsed, dismissed = []) {
  const known = new Set([
    ...parsed.corrections.map((c) => c.from.toLowerCase()),
    ...dismissed.map((d) => String(d).toLowerCase()),
  ]);
  const counts = new Map();
  for (const edit of edits || []) {
    const seen = new Set();
    for (const run of replacedRuns(edit.before, edit.after)) {
      if (run.from === run.to || known.has(run.from.toLowerCase())) continue;
      const key = `${run.from.toLowerCase()}\u0000${run.to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key) || { from: run.from, to: run.to, count: 0 };
      entry.count++;
      counts.set(key, entry);
    }
  }
  return [...counts.values()].filter((c) => c.count >= 2).sort((x, y) => y.count - x.count).slice(0, 3);
}

module.exports = { parseWords, serializeWords, hintWords, applyCorrections, replacedRuns, suggestCorrections };
