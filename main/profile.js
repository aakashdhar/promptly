'use strict';

const fs = require('fs');
const path = require('path');

// "It writes like you": two notes the user can read and edit (how they write, and who they
// are / what they work with), plus a local log of the edits they make to results, which
// Claude can turn into suggested notes. Nothing here changes the notes on its own.

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

function formatEdits(edits) {
  return edits.map((e, i) => `<edit n="${i + 1}" mode="${e.mode}">\n<before>\n${e.before}\n</before>\n<after>\n${e.after}\n</after>\n</edit>`).join('\n\n');
}

module.exports = { createEditLog, profileFor, cleanNotes, isMeaningfulEdit, formatEdits, MAX_NOTES, MAX_EDITS };
