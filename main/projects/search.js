'use strict';

const fs = require('fs');
const path = require('path');

// The project's local search index: node:sqlite (built into Electron's Node 24) with an FTS5
// index ranked by BM25. It is a cache of the text already extracted into the project's data
// folder: a damaged or outdated search.db is set aside or emptied and the index comes back
// `fresh`, so the caller indexes every file again (damage found later is reported through
// onReset). When node:sqlite can't load or the file can't be opened even then, callers get an
// index that finds nothing and fall back to the summary alone.

const CHUNK_SIZE = 2000;
const MAX_TERMS = 24;
const NEAR_TIE = 0.1;
const SCHEMA_VERSION = 2;
const LARGE_INDEX = 10000;
const TABLES = ['chunks', 'chunk_files', 'chunk_text'];

// SQLite result codes (the low byte of node:sqlite's errcode).
const SQLITE_ERROR = 1;
const SQLITE_CORRUPT = 11;
const SQLITE_CANTOPEN = 14;
const SQLITE_NOTADB = 26;

// A hit in the sender or title counts for more than one in the body.
const RANK = 'bm25(chunks, 4, 4, 1, 1)';

// The FTS5 table holds only the index (contentless). Ranking reads rel and date for every
// matching chunk, so they sit in the narrow chunk_files table, and the text in chunk_text is read
// for the winners alone. chunk_files also maps rel → chunk ids: deleting by a column scans FTS5.
const SCHEMA = `
  CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(
    sender, title, body, cjk,
    content = '', contentless_delete = 1,
    tokenize = 'porter unicode61 remove_diacritics 2'
  );
  CREATE TABLE IF NOT EXISTS chunk_files (
    id INTEGER PRIMARY KEY, rel TEXT NOT NULL, kind TEXT NOT NULL, date TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS chunk_files_rel ON chunk_files (rel);
  CREATE TABLE IF NOT EXISTS chunk_text (
    id INTEGER PRIMARY KEY, sender TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL
  );
`;
const DROP_ALL = TABLES.map((table) => `DROP TABLE IF EXISTS ${table};`).join(' ');

const STOP_WORDS = new Set(`
  a about above after again against all also am and any are as at be because been before being
  below between both but by could did does doing down during each else ever few for from further
  get got had has have having he her here hers herself him himself his how if in into is it its
  itself just let me more most much must myself no nor not now of off on once only or other our
  ours ourselves out over own re really same shall she should some such than that the their theirs
  them themselves then there these they this those through to too under until up us very was we
  were what when where which while who whom why with would you your yours yourself yourselves
`.split(/\s+/).filter(Boolean));

// Also first names (Will, Can, An…): dropped only in lowercase or at the start of a sentence.
const NAME_LIKE = new Set(['will', 'can', 'an', 'do', 'so', 'my']);
const FILLERS = new Set(['um', 'uh', 'hmm', 'ok', 'okay', 'yeah', 'yes', 'please']);

// A full stop after these doesn't end a sentence ("Mr. Will Smith").
const TITLES = new Set(['mr', 'mrs', 'ms', 'mx', 'dr', 'prof', 'st', 'sr', 'jr', 'vs']);

// What follows an apostrophe in a contraction or possessive ("we're", "Aparna's").
const CONTRACTION_ENDS = new Set(['s', 'm', 're', 've', 'll', 'd']);

const WORD = /[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu;

// Chinese, Japanese and Korean put no spaces between words, so unicode61 would make a whole
// sentence one token. Those runs are indexed in the cjk column instead, as overlapping pairs of
// characters plus each run's last character, so a word of any length inside a sentence is found.
const CJK = '\\p{sc=Han}\\p{sc=Hiragana}\\p{sc=Katakana}\\p{sc=Hangul}\\u30fc\\uff70';
const HAS_CJK = new RegExp(`[${CJK}]`, 'u');
const CJK_SPLIT = new RegExp(`([${CJK}]+)`, 'u');
const CJK_RUNS = new RegExp(`[${CJK}]+`, 'gu');
const HIRAGANA_ONLY = /^\p{sc=Hiragana}+$/u;
const HIRAGANA = /\p{sc=Hiragana}/u;
// Japanese particles: a pair with one at its edge ("トと", "の締", "に田") mostly straddles two words.
const PARTICLES = new Set([...'のとにをはがでてもへ']);

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

function pairs(run) {
  const chars = [...run];
  return chars.slice(0, -1).map((ch, i) => ch + chars[i + 1]);
}

// What FTS5 indexes for a chunk: sender, title and body with their CJK runs taken out (so
// "Promptlyの設定" still gives the word "promptly"), then the cjk column holding those runs as
// pairs plus each run's last character. Composed (NFC) first, as queryTerms composes a request.
function indexedColumns(...parts) {
  const composed = parts.map((part) => part.normalize('NFC'));
  const cjk = [];
  for (const part of composed) {
    for (const run of part.match(CJK_RUNS) || []) cjk.push(...pairs(run), [...run].pop());
  }
  return [...composed.map((part) => part.replace(CJK_RUNS, ' ')), cjk.join(' ')];
}

// A full stop after a title ("Dr.") or a single letter ("e.g.", "J.") is not a sentence end.
function endsSentence(text, dot) {
  let start = dot;
  while (start > 0 && /\p{L}/u.test(text[start - 1])) start--;
  const word = text.slice(start, dot).toLowerCase();
  return word.length !== 1 && !TITLES.has(word);
}

// A colon or semicolon doesn't start a sentence: "cc: Will" names someone.
function startsSentence(text, at) {
  for (let i = at - 1; i >= 0; i--) {
    if (text[i] === '.') return endsSentence(text, i);
    if (/[!?\n]/.test(text[i])) return true;
    if (!/[\s\p{P}\p{S}]/u.test(text[i])) return false;
  }
  return true;
}

// A lone CJK character stands for itself. Hiragana alone is mostly particles and verb endings
// ("の", "まで", "して"), so it counts only when the whole run is hiragana and longer than one.
function cjkQueryTerms(run) {
  const all = pairs(run);
  if (!all.length) return HIRAGANA_ONLY.test(run) ? [] : [run];
  return HIRAGANA_ONLY.test(run) ? all : all.filter((pair) => !HIRAGANA_ONLY.test(pair));
}

// Which terms the cap keeps first: words and CJK without hiragana, then pairs with okurigana
// ("締め"), then pairs across a particle ("の締"). Japanese often puts the key word last.
function termTier(term) {
  if (!HIRAGANA.test(term)) return 0;
  const chars = [...term];
  return PARTICLES.has(chars[0]) || PARTICLES.has(chars[chars.length - 1]) ? 2 : 1;
}

function capTerms(terms) {
  if (terms.length <= MAX_TERMS) return terms;
  const kept = new Set(terms.map((term, i) => ({ term, i, tier: termTier(term) }))
    .sort((a, b) => a.tier - b.tier || a.i - b.i)
    .slice(0, MAX_TERMS)
    .map((t) => t.term));
  return terms.filter((term) => kept.has(term));
}

// Words worth searching for, split the way FTS5's unicode61 tokenizer splits them (so "Aparna's"
// gives "aparna", "O'Brien" gives "brien"). Single digits stay: "phase 2" is a real detail. CJK
// comes back as the pairs of characters the cjk column holds. At most MAX_TERMS, in text order.
function queryTerms(text) {
  const source = String(text || '').normalize('NFC');
  const terms = [];
  const seen = new Set();
  let firstTier = 0;
  const add = (term) => {
    if (seen.has(term)) return;
    seen.add(term);
    terms.push(term);
    if (termTier(term) === 0) firstTier++;
  };
  const addWord = (word, sentenceStart) => {
    const lower = word.toLowerCase();
    if (STOP_WORDS.has(lower) || FILLERS.has(lower)) return;
    if (NAME_LIKE.has(lower) && (sentenceStart || !/^\p{Lu}\p{Ll}+$/u.test(word))) return;
    if (lower.length >= 2 || /^\p{N}$/u.test(lower)) add(lower);
  };
  for (const match of source.matchAll(WORD)) {
    const [head, ...tails] = match[0].split(/['’]/);
    // "don't", "won't", "isn't": a negated helper verb, never a name.
    if (tails.length && tails[0].toLowerCase() === 't') continue;
    const parts = [head, ...tails.filter((tail) => !CONTRACTION_ENDS.has(tail.toLowerCase()))];
    // A possessive ("Will's") names someone even at the start of a sentence.
    const possessive = tails.some((tail) => tail.toLowerCase() === 's');
    parts.forEach((part, p) => {
      part.split(CJK_SPLIT).forEach((piece, i) => {
        if (HAS_CJK.test(piece)) cjkQueryTerms(piece).forEach(add);
        else if (piece) addWord(piece, p === 0 && i === 0 && !possessive && startsSentence(source, match.index));
      });
    });
    // Nothing later can displace a full first tier.
    if (firstTier >= MAX_TERMS) break;
  }
  return capTerms(terms);
}

// A lone CJK character also matches the pairs that start with it.
function matchExpr(term) {
  const quoted = `"${term.replace(/"/g, '""')}"`;
  return HAS_CJK.test(term) && [...term].length === 1 ? `${quoted} *` : quoted;
}

// One kind may come as a plain string. Anything else that isn't a list counts as one kind too, so
// a caller's slip narrows the search to nothing instead of lifting the filter.
function kindFilter(kinds) {
  if (kinds == null) return null;
  const list = typeof kinds === 'string' || typeof kinds[Symbol.iterator] !== 'function' ? [kinds] : [...kinds];
  return list.length ? list.map(String) : null;
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

function unavailableIndex(movedAside = null) {
  return { available: false, fresh: false, movedAside, upsert() {}, remove() {}, search: () => [], close() {} };
}

function sqliteCode(err) {
  return Number(err && err.errcode) & 0xff;
}

function isDirectory(file) {
  try {
    return fs.statSync(file).isDirectory();
  } catch {
    return false;
  }
}

// What says the file itself is bad: CORRUPT, NOTADB, a folder where the file should be, or a
// SQL error while setting up (this file's SQL is fixed, so the layout on disk isn't ours). A full
// disk, I/O error, lack of memory or file handles, or another process's lock leaves it alone.
function isDamagedAtOpen(err, dbPath) {
  const code = sqliteCode(err);
  if (code === SQLITE_ERROR || code === SQLITE_CORRUPT || code === SQLITE_NOTADB) return true;
  return code === SQLITE_CANTOPEN && isDirectory(dbPath);
}

function isCorrupt(err) {
  const code = sqliteCode(err);
  return code === SQLITE_CORRUPT || code === SQLITE_NOTADB;
}

function inTransaction(db, fn) {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // SQLite already rolled back (it does on some errors); the first error is the one to report.
    }
    throw err;
  }
}

function prepareStatements(db) {
  return {
    insertFile: db.prepare('INSERT INTO chunk_files (rel, kind, date) VALUES (?, ?, ?)'),
    insertText: db.prepare('INSERT INTO chunk_text (id, sender, title, body) VALUES (?, ?, ?, ?)'),
    insertChunk: db.prepare('INSERT INTO chunks (rowid, sender, title, body, cjk) VALUES (?, ?, ?, ?, ?)'),
    deleteChunks: db.prepare('DELETE FROM chunks WHERE rowid IN (SELECT id FROM chunk_files WHERE rel = ?)'),
    deleteTexts: db.prepare('DELETE FROM chunk_text WHERE id IN (SELECT id FROM chunk_files WHERE rel = ?)'),
    deleteFiles: db.prepare('DELETE FROM chunk_files WHERE rel = ?'),
    readChunk: db.prepare('SELECT f.rel, f.kind, f.date, t.sender, t.title, t.body FROM chunk_files f JOIN chunk_text t ON t.id = f.id WHERE f.id = ?'),
    countRows: db.prepare('SELECT count(*) AS n FROM chunk_files'),
    countMatches: db.prepare('SELECT count(*) AS n FROM chunks WHERE chunks MATCH ?'),
  };
}

// { db, st, fresh } or { error }. Any other user_version, or a missing table, means the layout is
// made again, empty: dropping and creating in one transaction, so a crash halfway leaves the old
// layout whole for the next open to replace.
function openDb(sqlite, dbPath) {
  let db = null;
  try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new sqlite.DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    // A rebuildable cache: losing the last few writes on power loss is fine, an fsync per file isn't.
    db.exec('PRAGMA synchronous = NORMAL');
    const version = db.prepare('PRAGMA user_version').get().user_version;
    const present = db.prepare(`SELECT count(*) AS n FROM sqlite_master WHERE name IN (${TABLES.map(() => '?').join(', ')})`).get(...TABLES).n;
    const fresh = version !== SCHEMA_VERSION || present < TABLES.length;
    if (fresh) inTransaction(db, () => db.exec(`${DROP_ALL} ${SCHEMA} PRAGMA user_version = ${SCHEMA_VERSION};`));
    const st = prepareStatements(db);
    // Reading every table now finds a damaged file here rather than at the first search.
    for (const table of TABLES) db.prepare(`SELECT rowid FROM ${table} LIMIT 1`).get();
    return { db, st, fresh };
  } catch (error) {
    try {
      if (db) db.close();
    } catch {
      // already unusable
    }
    return { error };
  }
}

// Only the newest damaged copy is kept: each can be as large as the index.
function removeOlderCopies(dbPath, aside) {
  const dir = path.dirname(dbPath);
  const prefix = `${path.basename(dbPath)}.corrupt-`;
  const keep = new Set(['', '-wal', '-shm'].map((suffix) => path.basename(aside) + suffix));
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.startsWith(prefix) || keep.has(name)) continue;
    try {
      if (fs.lstatSync(path.join(dir, name)).isFile()) fs.unlinkSync(path.join(dir, name));
    } catch {
      // gone already, or not ours to remove
    }
  }
}

// Keeps a damaged file (and its -wal and -shm, which would otherwise be replayed into the new
// one) as search.db.corrupt-<time>. Null when it can't be moved.
function moveAside(dbPath) {
  let aside = `${dbPath}.corrupt-${Date.now()}`;
  for (let n = 1; fs.existsSync(aside); n++) aside = `${dbPath}.corrupt-${Date.now()}-${n}`;
  try {
    fs.renameSync(dbPath, aside);
  } catch {
    return null;
  }
  for (const suffix of ['-wal', '-shm']) {
    try {
      fs.renameSync(dbPath + suffix, aside + suffix);
    } catch {
      // not there
    }
  }
  if (fs.existsSync(`${dbPath}-wal`)) return null;
  removeOlderCopies(dbPath, aside);
  return aside;
}

// Damage the open-time check missed shows up later as CORRUPT or NOTADB. Then the file is set
// aside, a fresh index takes its place and onReset({ available, movedAside }) tells the caller to
// index every file again (available is false when no fresh file could be made).
function openIndex(dbPath, { onReset } = {}) {
  const sqlite = loadSqlite();
  if (!sqlite) return unavailableIndex();

  let opened = openDb(sqlite, dbPath);
  let movedAside = null;
  if (opened.error && isDamagedAtOpen(opened.error, dbPath)) {
    movedAside = moveAside(dbPath);
    if (movedAside) opened = openDb(sqlite, dbPath);
  }
  if (opened.error) return unavailableIndex(movedAside);
  let conn = opened;
  let open = true;
  let lost = false;

  function replaceDamaged() {
    try {
      conn.db.close();
    } catch {
      // already unusable
    }
    const aside = moveAside(dbPath);
    const next = aside ? openDb(sqlite, dbPath) : { error: true };
    if (next.error) lost = true;
    else conn = next;
    return { available: !lost, movedAside: aside };
  }

  // Runs op on the live connection; after a reset it runs once more on the fresh index, so the
  // file being written is in it before onReset asks for the rest.
  function run(op, fallback) {
    if (!open || lost) return fallback;
    try {
      return op(conn);
    } catch (err) {
      if (!isCorrupt(err)) throw err;
      const reset = replaceDamaged();
      try {
        return reset.available ? op(conn) : fallback;
      } finally {
        if (typeof onReset === 'function') onReset(reset);
      }
    }
  }

  function removeRows({ st }, rel) {
    st.deleteChunks.run(rel);
    st.deleteTexts.run(rel);
    st.deleteFiles.run(rel);
  }

  function upsert(doc) {
    const rel = String(doc.rel);
    const [kind, date, sender, title] = [doc.kind, doc.date, doc.sender, doc.title].map((v) => String(v || ''));
    const chunks = chunkText(doc.text);
    run((c) => inTransaction(c.db, () => {
      removeRows(c, rel);
      for (const body of chunks) {
        const { lastInsertRowid: id } = c.st.insertFile.run(rel, kind, date);
        c.st.insertText.run(id, sender, title, body);
        c.st.insertChunk.run(id, ...indexedColumns(sender, title, body));
      }
    }));
  }

  function remove(rel) {
    run((c) => inTransaction(c.db, () => removeRows(c, String(rel))));
  }

  // In a large index a term found in more than half the chunks has no weight (FTS5's BM25 floors
  // its IDF at 1e-6): it only adds hits scored ~0 and makes every row slower to rank. A small
  // project keeps them, since there the most common word is likely what the project is about.
  function weightedTerms({ st }, exprs) {
    const rows = st.countRows.get().n;
    if (rows < LARGE_INDEX) return exprs;
    const counted = exprs.map((expr) => ({ expr, n: st.countMatches.get(expr).n })).filter((c) => c.n > 0);
    const kept = counted.filter((c) => c.n <= rows / 2);
    if (kept.length) return kept.map((c) => c.expr);
    return counted.sort((a, b) => a.n - b.n).slice(0, 1).map((c) => c.expr);
  }

  function search(text, opts) {
    const { kinds, limit = 20 } = opts || {};
    const terms = queryTerms(text);
    if (!terms.length) return [];
    const kindList = kindFilter(kinds);
    const max = Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : 20;
    // Every matching file's best chunk, as an id and a date: a newer file within 10% of the best
    // can sit anywhere in raw score order, so the near-tie rule has to see them all. Bodies are
    // read for the winners alone. MATERIALIZED stops SQLite folding bm25() into the GROUP BY,
    // which FTS5 refuses; with MIN(), the bare id comes from each file's best chunk. CROSS JOIN
    // keeps the MATCH as the outer loop.
    const sql = `
      WITH hits AS MATERIALIZED (
        SELECT f.id, f.rel, f.date, ${RANK} AS bm FROM chunks CROSS JOIN chunk_files f ON f.id = chunks.rowid
        WHERE chunks MATCH ?${kindList ? ` AND f.kind IN (${kindList.map(() => '?').join(', ')})` : ''}
      )
      SELECT id, date, MIN(bm) AS bm FROM hits GROUP BY rel ORDER BY bm`;
    try {
      return run((c) => {
        const exprs = weightedTerms(c, terms.map(matchExpr));
        if (!exprs.length) return [];
        const best = c.db.prepare(sql).all(exprs.join(' OR '), ...(kindList || [])).map((r) => ({ id: r.id, date: r.date, score: -r.bm }));
        return preferNewerOnNearTies(best).slice(0, max).map(({ id, score }) => {
          const hit = c.st.readChunk.get(id);
          return { rel: hit.rel, date: hit.date, kind: hit.kind, title: hit.title, excerpt: withHeader(hit), score };
        });
      }, []);
    } catch {
      return [];
    }
  }

  function close() {
    if (!open) return;
    open = false;
    if (!lost) conn.db.close();
  }

  return {
    get available() {
      return !lost;
    },
    fresh: opened.fresh,
    movedAside,
    upsert,
    remove,
    search,
    close,
  };
}

module.exports = { openIndex, chunkText, queryTerms };
