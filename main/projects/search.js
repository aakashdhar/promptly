'use strict';

const fs = require('fs');
const path = require('path');

// The project's local search index: node:sqlite (built into Electron's Node 24) with one FTS5
// table, ranked by BM25. It is a cache of the text already extracted into the project's data
// folder, so it can always be rebuilt; when node:sqlite can't load, callers get an index that
// finds nothing and fall back to the summary alone.

const CHUNK_SIZE = 2000;
const MAX_TERMS = 24;
const NEAR_TIE = 0.1;

// rel, kind and date are UNINDEXED (weight 0); a hit in the sender or title counts for more
// than one in the body.
const RANK = 'bm25(chunks, 0, 0, 0, 4, 4, 1)';

const SCHEMA = `
  CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(
    rel UNINDEXED, kind UNINDEXED, date UNINDEXED, sender, title, body,
    tokenize = 'porter unicode61 remove_diacritics 2'
  );
  CREATE TABLE IF NOT EXISTS chunk_files (id INTEGER PRIMARY KEY, rel TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS chunk_files_rel ON chunk_files (rel);
`;

const STOP_WORDS = new Set(`
  a about above after again against all also am an and any are aren as at be because been before
  being below between both but by can could couldn did didn do does doesn doing don down during each
  else ever few for from further get got had hadn has hasn have haven having he her here hers herself
  him himself his how if in into is isn it its itself just let ll me more most much must my myself
  no nor not now of off on once only or other our ours ourselves out over own re really same shall
  she should shouldn so some such than that the their theirs them themselves then there these they
  this those through to too under until up us ve very was wasn we were weren what when where which
  while who whom why will with won would wouldn you your yours yourself yourselves
  um uh hmm ok okay yeah yes please
`.split(/\s+/).filter(Boolean));

function loadSqlite() {
  try {
    return require('node:sqlite');
  } catch {
    return null;
  }
}

// Where to cut a piece that is too long: the last line break, sentence end or space in the
// second half of the window, else a hard cut at the limit (moved back one so an emoji's two
// UTF-16 halves stay together).
function cutPoint(text, size) {
  const head = text.slice(0, size + 1);
  for (const sep of ['\n', '. ', ' ']) {
    const at = head.lastIndexOf(sep);
    if (at >= size / 2) return at + 1;
  }
  const high = text.charCodeAt(size - 1);
  return size > 1 && high >= 0xd800 && high <= 0xdbff ? size - 1 : size;
}

function splitLong(paragraph, size) {
  const pieces = [];
  let rest = paragraph;
  while (rest.length > size) {
    const cut = cutPoint(rest, size);
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

// Chunks of at most `size` characters, packed from whole paragraphs where they fit.
function chunkText(text, size = CHUNK_SIZE) {
  size = Number.isFinite(size) && size >= 1 ? Math.floor(size) : CHUNK_SIZE;
  const clean = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!clean) return [];
  const chunks = [];
  let current = '';
  for (const paragraph of clean.split(/\n\s*\n/)) {
    for (const piece of splitLong(paragraph.trim(), size)) {
      if (current && current.length + 2 + piece.length > size) {
        chunks.push(current);
        current = piece;
      } else {
        current = current ? `${current}\n\n${piece}` : piece;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// Words worth searching for, split the way FTS5's unicode61 tokenizer splits them (so "Aparna's"
// gives "aparna"). Single digits stay: "phase 2" is a real detail.
function queryTerms(text) {
  const terms = [];
  for (const word of String(text || '').toLowerCase().match(/[\p{L}\p{N}\p{M}]+/gu) || []) {
    if (STOP_WORDS.has(word) || (word.length < 2 && !/^\p{N}$/u.test(word))) continue;
    if (!terms.includes(word)) terms.push(word);
    if (terms.length === MAX_TERMS) break;
  }
  return terms;
}

function byNewest(a, b) {
  if (a.date === b.date) return 0;
  return a.date < b.date ? 1 : -1;
}

// Walks hits best first; each run of hits within 10% of the run's best score is reordered
// newest first, so a newer email beats an older one that says nearly the same thing.
function preferNewerOnNearTies(hits) {
  const out = [];
  let i = 0;
  while (i < hits.length) {
    const floor = hits[i].score * (1 - NEAR_TIE);
    let j = i + 1;
    while (j < hits.length && hits[j].score >= floor) j++;
    out.push(...hits.slice(i, j).sort(byNewest));
    i = j;
  }
  return out;
}

// "title · date · sender" above each excerpt: a chunk alone doesn't say who wrote it or when (an
// email's text is its body without headers). Added on the way out, not stored, so title and
// sender aren't indexed twice and keep the weights RANK gives them.
function withHeader({ title, date, sender, body }) {
  const header = [title, date, sender].map((part) => String(part || '').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' · ');
  return header ? `${header}\n${body}` : body;
}

function unavailableIndex() {
  return { available: false, upsert() {}, remove() {}, search: () => [], close() {} };
}

function openIndex(dbPath) {
  const sqlite = loadSqlite();
  if (!sqlite) return unavailableIndex();

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new sqlite.DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  // A rebuildable cache: losing the last few writes on power loss is fine, an fsync per file isn't.
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec(SCHEMA);

  // chunk_files maps rel → chunk rowids: deleting from FTS5 by an UNINDEXED column scans the
  // whole table, which made building a 5,000-file index take ~30 s instead of ~1 s.
  const insertChunk = db.prepare('INSERT INTO chunks (rel, kind, date, sender, title, body) VALUES (?, ?, ?, ?, ?, ?)');
  const insertLink = db.prepare('INSERT INTO chunk_files (id, rel) VALUES (?, ?)');
  const deleteChunks = db.prepare('DELETE FROM chunks WHERE rowid IN (SELECT id FROM chunk_files WHERE rel = ?)');
  const deleteLinks = db.prepare('DELETE FROM chunk_files WHERE rel = ?');
  const readChunk = db.prepare('SELECT rel, kind, date, sender, title, body FROM chunks WHERE rowid = ?');
  let open = true;

  function inTransaction(fn) {
    db.exec('BEGIN');
    try {
      fn();
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  function removeRows(rel) {
    deleteChunks.run(rel);
    deleteLinks.run(rel);
  }

  function upsert(doc) {
    if (!open) return;
    const rel = String(doc.rel);
    inTransaction(() => {
      removeRows(rel);
      for (const body of chunkText(doc.text)) {
        const { lastInsertRowid } = insertChunk.run(rel, doc.kind || '', doc.date || '', doc.sender || '', doc.title || '', body);
        insertLink.run(lastInsertRowid, rel);
      }
    });
  }

  function remove(rel) {
    if (!open) return;
    inTransaction(() => removeRows(String(rel)));
  }

  function search(text, opts) {
    const { kinds, limit = 20 } = opts || {};
    const terms = queryTerms(text);
    if (!open || !terms.length) return [];
    const match = terms.map((t) => `"${t.replace(/"/g, '""')}"`).join(' OR ');
    const kindList = Array.isArray(kinds) && kinds.length ? kinds.map(String) : null;
    const max = Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : 20;
    // Every matching file's best chunk, as an id and a date: a newer file within 10% of the best
    // can sit anywhere in raw score order, so the near-tie rule has to see them all. Bodies are
    // read for the winners alone. MATERIALIZED stops SQLite folding bm25() into the GROUP BY,
    // which FTS5 refuses; with MIN(), the bare id comes from each file's best chunk.
    const sql = `
      WITH hits AS MATERIALIZED (
        SELECT rowid AS id, rel, date, ${RANK} AS bm FROM chunks
        WHERE chunks MATCH ?${kindList ? ` AND kind IN (${kindList.map(() => '?').join(', ')})` : ''}
      )
      SELECT id, date, MIN(bm) AS bm FROM hits GROUP BY rel ORDER BY bm`;
    try {
      const best = db.prepare(sql).all(match, ...(kindList || [])).map((r) => ({ id: r.id, date: r.date, score: -r.bm }));
      return preferNewerOnNearTies(best).slice(0, max).map(({ id, score }) => {
        const c = readChunk.get(id);
        return { rel: c.rel, date: c.date, kind: c.kind, title: c.title, excerpt: withHeader(c), score };
      });
    } catch {
      return [];
    }
  }

  function close() {
    if (!open) return;
    open = false;
    db.close();
  }

  return { available: true, upsert, remove, search, close };
}

module.exports = { openIndex, chunkText, queryTerms };
