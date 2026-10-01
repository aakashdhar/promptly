'use strict';

const fs = require('fs');
const path = require('path');

// "It writes like you": two notes the user can read and edit (how they write, and who they
// are / what they work with), plus a local log of the edits they make to results. main.js
// learns from each edit as it happens (new lines added to the notes, each one undoable, unless
// the user turned "Learn from my edits" off); the helpers here only parse and append.

const MAX_NOTES = 2000;
const MAX_EDITS = 20;
const MAX_EDIT_TEXT = 4000;

function cleanNotes(text) {
  return String(text || '').replace(/\r\n/g, '\n').trim().slice(0, MAX_NOTES);
}

// Edits worth learning from: something actually changed, and it isn't a wholesale rewrite
// of an empty result.
function isMeaningfulEdit(before, after) {
  const a = String(before || '').trim();
  const b = String(after || '').trim();
  return !!a && !!b && a !== b && a.replace(/\s+/g, ' ') !== b.replace(/\s+/g, ' ');
}

function createEditLog(file) {
  function read() {
    try {
      const list = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function write(list) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, file);
  }

  function add({ mode, before, after }) {
    if (!isMeaningfulEdit(before, after)) return false;
    const entry = {
      mode: String(mode || ''),
      before: String(before).slice(0, MAX_EDIT_TEXT),
      after: String(after).slice(0, MAX_EDIT_TEXT),
      at: new Date().toISOString(),
    };
    write([...read(), entry].slice(-MAX_EDITS));
    return true;
  }

  function clear() {
    fs.rmSync(file, { force: true });
  }

  return { add, list: read, count: () => read().length, clear };
}

// What goes into a request: writing modes get "how you write", prompt modes get "about you".
function profileFor(mode, { voiceNotes, aboutMe } = {}) {
  if (mode.profile === 'voice') return { voiceNotes: cleanNotes(voiceNotes) };
  if (mode.profile === 'about') return { aboutMe: cleanNotes(aboutMe) };
  return {};
}

const MAX_LEARNED_PER_EDIT = 2;
const normRule = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const ruleText = (line) => line.replace(/^\s*[-*•]\s*/, '');

// The new notes in Claude's answer to the learn-from-edit prompt: "- " lines the current notes
// don't already have. NONE, an empty answer or anything else gives [].
function newRules(answer, current = '') {
  const have = new Set(String(current).split('\n').map((l) => normRule(ruleText(l))).filter(Boolean));
  const out = [];
  for (const line of String(answer || '').split('\n')) {
    const m = /^\s*[-*•]\s+(.+?)\s*$/.exec(line);
    if (!m || m[1].length > 160) continue;
    const key = normRule(m[1]);
    if (!key || have.has(key)) continue;
    have.add(key);
    out.push(m[1]);
    if (out.length === MAX_LEARNED_PER_EDIT) break;
  }
  return out;
}

// The notes with the new rules added as "- " lines at the end, or null when they wouldn't fit.
function appendRules(current, rules) {
  const next = [cleanNotes(current), ...rules.map((r) => `- ${r}`)].filter(Boolean).join('\n');
  return next.length <= MAX_NOTES ? next : null;
}

// The notes without the given learned rules (Undo), leaving everything else as the user has it.
function removeRules(current, rules) {
  const gone = new Set(rules.map(normRule));
  return cleanNotes(String(current || '').split('\n').filter((l) => !gone.has(normRule(ruleText(l)))).join('\n'));
}

function formatEdits(edits) {
  return edits.map((e, i) => `<edit n="${i + 1}" mode="${e.mode}">\n<before>\n${e.before}\n</before>\n<after>\n${e.after}\n</after>\n</edit>`).join('\n\n');
}

module.exports = { createEditLog, profileFor, cleanNotes, isMeaningfulEdit, formatEdits, newRules, appendRules, removeRules, MAX_NOTES, MAX_EDITS };
