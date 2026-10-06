'use strict';

// Project modes (D-PROJECT-MODES): the one place main.js talks to. Ties the store, scan, text cache,
// search index, watcher and summary together per project. No Electron imports: main.js passes the
// AI runner, the paths and an emit function, and owns dialogs and IPC.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createProjectStore, nameForFolder } = require('./store');
const { scanFolder, diffManifest } = require('./scan');
const { extractDoc, writeExtracted } = require('./extract');
const { openIndex } = require('./search');
const { createFolderWatcher } = require('./watch');
const { classifyFolders } = require('./classify');
const summaryLib = require('./summary');
const { pickOutput, assembleContext, KINDS_FOR } = require('./context');
const { suggestProject, termsFromSummary } = require('./suggest');

const RECENT_DAYS = 14;
const FOCUS_RESCAN_MS = 60000;
const TOKEN_TTL_MS = 30 * 60 * 1000;
const THREAD_BYTES = 12000;

const isoDay = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

// Written to a temp file and renamed, so a crash never leaves half a manifest or summary.
function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

function createProjectService({ config, userData, run, stopRuns = () => {}, log = { info() {}, warn() {}, error() {} }, emit = () => {}, now = Date.now, watchImpl, platform = process.platform }) {
  const store = createProjectStore({ config, dataDir: path.join(userData, 'projects'), appDataDir: userData });
  const live = new Map();     // id → { index, watcher, syncing, dirty, lastFocus, building, factsCache, terms }
  const tokens = new Map();   // connect token → { dir, scan, at }

  const state = (id) => {
    if (!live.has(id)) live.set(id, { index: null, watcher: null, syncing: null, dirty: true, lastFocus: 0, building: null, factsCache: new Map(), terms: null });
    return live.get(id);
  };
  const paths = (id) => store.paths(id);
  const manifestOf = (id) => readJson(paths(id).manifest, {});
  const indexOf = (id) => {
    const s = state(id);
    if (!s.index) {
      fs.mkdirSync(paths(id).root, { recursive: true });
      s.index = openIndex(paths(id).db, { onReset: () => { s.dirty = true; s.reindex = true; } });
      if (s.index.fresh) s.reindex = true;
      if (s.index.movedAside) log.warn(`Project search index was damaged; set aside as ${path.basename(s.index.movedAside)}`);
    }
    return s.index;
  };
  const folderMissing = (p) => { try { return !fs.statSync(p.dir).isDirectory(); } catch { return true; } };
  // Files not yet in the summary; ones the summary's 400-file cap left out don't count as new.
  const newFilesOf = (id) => Object.values(manifestOf(id)).filter((e) => e.extractedAt && !e.inSummary && !e.leftOut).length;

  function view(p) {
    const s = live.get(p.id);
    return {
      ...p,
      missing: folderMissing(p),
      newFiles: newFilesOf(p.id),
      building: !!(s && s.building),
    };
  }

  // Which folder a file belongs to, and whether its kind is switched on.
  function kindFor(project, file) {
    const entry = project.folders[file.top];
    if (!entry) return file.top === '' ? 'overview' : null;
    return entry.on && entry.kind !== 'exclude' ? (entry.kind === 'unsure' ? 'reference' : entry.kind) : null;
  }

  // Scan → manifest diff → extract changed files into the text cache → search index. Files in
  // switched-off folders drop out like removed ones. Serialised per project.
  function sync(id) {
    const s = state(id);
    if (s.syncing) { s.dirty = true; return s.syncing; }
    s.dirty = false;
    s.syncing = (async () => {
      const project = store.get(id);
      if (!project || s.removed || folderMissing(project)) return { added: [], changed: [], removed: [] };
      const p = paths(id);
      const index = indexOf(id);
      const scan = await scanFolder(project.dir, { platform });
      // Promptly's own PROMPTLY.md is the summary, not a project file.
      const files = scan.files.filter((f) => f.rel.toLowerCase() !== 'promptly.md' && kindFor(project, f));
      const prev = manifestOf(id);
      const diff = await diffManifest(prev, files, { dir: project.dir, keep: scan.unchecked });
      const byRel = new Map(files.map((f) => [f.rel, f]));
      const todo = new Set([...diff.added, ...diff.changed]);
      // A rebuilt or reset index needs every file again; the text cache is still there.
      if (s.reindex) for (const rel of Object.keys(diff.next)) if (!todo.has(rel) && diff.next[rel].extractedAt) todo.add(rel);
      for (const rel of todo) {
        const entry = diff.next[rel];
        const file = byRel.get(rel);
        if (!entry || !file) continue;
        const kind = kindFor(project, file);
        const fresh = diff.added.includes(rel) || diff.changed.includes(rel) || !entry.extractedAt;
        let doc = null;
        if (fresh) {
          doc = await extractDoc(path.join(project.dir, rel), rel, { kind });
          if (!doc) { entry.extractedAt = null; continue; }
          writeExtracted(p.text, rel, doc.text);
          Object.assign(entry, { kind, extractedAt: now(), inSummary: false, date: doc.date, title: doc.title, sender: doc.sender });
        } else {
          doc = loadDoc(id, rel, entry);
          if (!doc) continue;
        }
        if (index.available) index.upsert({ ...doc, kind });
      }
      // Kind changes (a folder re-sorted) follow without re-reading the file.
      for (const [rel, entry] of Object.entries(diff.next)) {
        const file = byRel.get(rel);
        const kind = file && kindFor(project, file);
        if (kind && entry.kind && entry.kind !== kind) {
          entry.kind = kind;
          const doc = loadDoc(id, rel, entry);
          if (doc && index.available) index.upsert(doc);
        }
      }
      for (const rel of diff.removed) {
        if (index.available) index.remove(rel);
        try { fs.rmSync(path.join(p.text, `${rel}.txt`), { force: true }); } catch { /* already gone */ }
      }
      s.reindex = false;
      if (s.removed || !store.get(id)) return { added: [], changed: [], removed: [] };
      // A build or refresh may have marked files as summarised while this ran; keep those marks
      // for files whose content is unchanged.
      const latest = manifestOf(id);
      for (const [rel, entry] of Object.entries(diff.next)) {
        const was = latest[rel];
        if (was && was.sha1 && was.sha1 === entry.sha1) { entry.inSummary = !!was.inSummary; entry.leftOut = !!was.leftOut; }
      }
      writeAtomic(p.manifest, JSON.stringify(diff.next));
      if (diff.added.length || diff.changed.length || diff.removed.length) emit('projects-changed');
      return diff;
    })().catch((err) => {
      log.warn(`Project sync failed: ${err.message}`);
      return { added: [], changed: [], removed: [], error: err.message };
    }).finally(() => {
      s.syncing = null;
      // Changes that arrived during this run get one more run, started right away so a waiting
      // request can await it.
      if (s.dirty) sync(id);
    });
    return s.syncing;
  }

  function loadDoc(id, rel, entry) {
    try {
      const text = fs.readFileSync(path.join(paths(id).text, `${rel}.txt`), 'utf8');
      return { rel, kind: entry.kind || 'reference', date: entry.date || isoDay(entry.mtimeMs || now()), sender: entry.sender || '', title: entry.title || path.posix.basename(rel), text, sha1: entry.sha1 };
    } catch {
      return null;
    }
  }

  function loadDocs(id, filter = () => true) {
    const docs = [];
    for (const [rel, entry] of Object.entries(manifestOf(id))) {
      if (!entry.extractedAt || !filter(rel, entry)) continue;
      const doc = loadDoc(id, rel, entry);
      if (doc) docs.push(doc);
    }
    return docs;
  }

  // After a summary: the files it read (only where the file hasn't changed since), and the ones
  // its 400-file cap left out. Waits for a sync in progress so their writes can't cross.
  async function markInSummary(id, docs, leftOutFiles = []) {
    const s = state(id);
    if (s.syncing) await s.syncing;
    if (s.removed || !store.get(id)) return 0;
    const manifest = manifestOf(id);
    const left = new Set(leftOutFiles);
    for (const doc of docs) {
      const entry = manifest[doc.rel];
      if (!entry || (doc.sha1 && entry.sha1 !== doc.sha1)) continue;
      if (left.has(doc.rel)) entry.leftOut = true;
      else { entry.inSummary = true; entry.leftOut = false; }
    }
    writeAtomic(paths(id).manifest, JSON.stringify(manifest));
    return Object.values(manifest).filter((e) => e.inSummary).length;
  }

  const readSummary = (id) => { try { return fs.readFileSync(paths(id).summary, 'utf8'); } catch { return ''; } };
  const readPins = (id) => readJson(paths(id).pins, []);

  function saveSummary(id, text, pins) {
    const p = paths(id);
    writeAtomic(p.summary, text);
    if (pins) writeAtomic(p.pins, JSON.stringify(pins));
    state(id).terms = null;
    const project = store.get(id);
    if (project && project.keepInFolder) {
      try {
        if (summaryLib.writePromptlyMd({ project, text }) && !project.wrotePromptlyMd) store.update(id, { wrotePromptlyMd: true });
      } catch (err) { log.warn(`PROMPTLY.md not written: ${err.message}`); }
    }
  }

  function progress(id, payload) { emit('project-progress', { id, ...payload }); }

  // The first summary, Retry after a failure, and Rebuild (a fresh facts cache).
  async function build(id, { rebuild = false } = {}) {
    const s = state(id);
    if (s.building) return { ok: false, error: 'Already writing the summary' };
    if (rebuild) s.factsCache = new Map();
    const controller = new AbortController();
    s.building = controller;
    emit('projects-changed');
    try {
      await sync(id);
      const docs = loadDocs(id);
      const result = await summaryLib.buildSummary({
        run, docs, factsCache: s.factsCache, pins: readPins(id), signal: controller.signal, today: isoDay(now()),
        onProgress: (e) => progress(id, e),
      });
      if (result.cancelled) { progress(id, { cancelled: true, finished: true }); return { ok: false, cancelled: true }; }
      saveSummary(id, result.text);
      const fileCount = await markInSummary(id, docs, result.leftOutFiles);
      store.update(id, { summaryUpdatedAt: now(), summaryFileCount: fileCount });
      progress(id, { finished: true, overCap: result.overCap, leftOut: result.leftOut });
      return { ok: true, overCap: result.overCap };
    } catch (err) {
      log.warn(`Project summary failed: ${err.errorType || 'error'} (${err.message})`);
      progress(id, { finished: true, error: err.message, errorType: err.errorType || 'unknown' });
      return { ok: false, error: err.message, errorType: err.errorType || 'unknown' };
    } finally {
      s.building = null;
      emit('projects-changed');
    }
  }

  async function refresh(id) {
    const project = store.get(id);
    if (!project) return { ok: false, error: 'Project not found' };
    if (!readSummary(id)) return build(id);
    const s = state(id);
    if (s.building) return { ok: false, error: 'Already writing the summary' };
    const controller = new AbortController();
    s.building = controller;
    emit('projects-changed');
    try {
      await sync(id);
      const manifest = manifestOf(id);
      const summary = readSummary(id);
      let pins = readPins(id);
      if (project.keepInFolder) pins = summaryLib.readPromptlyMd({ project, stored: summary, pins, today: isoDay(now()) });
      const docs = loadDocs(id, (rel, e) => !e.inSummary && !e.leftOut);
      const cutoff = isoDay(now() - RECENT_DAYS * 86400000);
      const recent = loadDocs(id, (rel, e) => e.kind === 'conversations' && (e.date || '') >= cutoff);
      const result = await summaryLib.refreshSummary({
        run, summary, pins, docs, removed: [], recent, present: Object.keys(manifest).filter((rel) => manifest[rel].extractedAt),
        today: isoDay(now()), signal: controller.signal, factsCache: s.factsCache, onProgress: (e) => progress(id, e),
      });
      if (result.cancelled) { progress(id, { cancelled: true, finished: true }); return { ok: false, cancelled: true }; }
      saveSummary(id, result.text, pins);
      const fileCount = await markInSummary(id, docs, result.leftOutFiles);
      store.update(id, { summaryUpdatedAt: now(), summaryFileCount: fileCount });
      progress(id, { finished: true, overCap: result.overCap });
      return { ok: true };
    } catch (err) {
      log.warn(`Project refresh failed: ${err.errorType || 'error'} (${err.message})`);
      progress(id, { finished: true, error: err.message, errorType: err.errorType || 'unknown' });
      return { ok: false, error: err.message, errorType: err.errorType || 'unknown' };
    } finally {
      s.building = null;
      emit('projects-changed');
    }
  }

  function getSummary(id) {
    const project = store.get(id);
    if (!project) return null;
    return { text: readSummary(id), pins: readPins(id), updatedAt: project.summaryUpdatedAt, fileCount: project.summaryFileCount, building: !!(live.get(id) || {}).building };
  }

  // Stop now, not after the call in flight: the runs are this service's own, so this can't touch a request.
  function cancelBuild(id) {
    const s = live.get(id);
    if (s && s.building) { s.building.abort(); stopRuns(); }
  }

  function watch(id) {
    const project = store.get(id);
    const s = state(id);
    if (!project || s.watcher || folderMissing(project)) return;
    s.watcher = createFolderWatcher({ dir: project.dir, onChange: () => sync(id), onError: (e) => log.warn(`Watching ${project.name} stopped: ${e.code || ''} ${e.message}`), ...(watchImpl ? { watchImpl } : {}) });
    s.watcher.start();
  }

  function forget(id) {
    const s = live.get(id);
    if (!s) return;
    s.removed = true;
    if (s.building) { s.building.abort(); stopRuns(); }
    if (s.watcher) s.watcher.stop();
    if (s.index) s.index.close();
    live.delete(id);
  }

  return {
    list: () => store.list().map(view),

    // Step 1 of connecting: main has already picked `dir` with the folder dialog.
    async connect(dir) {
      const existing = store.findByDir(dir);
      if (existing) return { error: `Already connected as ${existing.name}` };
      const scan = await scanFolder(dir, { platform });
      const token = crypto.randomBytes(12).toString('hex');
      for (const [t, v] of tokens) if (now() - v.at > TOKEN_TTL_MS) tokens.delete(t);
      tokens.set(token, { dir, scan, at: now() });
      return { token, dir, name: nameForFolder(dir), folders: scan.folders, skipped: scan.skipped, tooMany: scan.tooMany, warnings: scan.warnings || [] };
    },

    async classify(token) {
      const t = tokens.get(token);
      if (!t) return { error: 'Choose the folder again' };
      const readSnippet = async (rel) => {
        const doc = await extractDoc(path.join(t.dir, rel), rel, {});
        return doc ? doc.text.slice(0, 600) : '';
      };
      const result = await classifyFolders({ run, scan: t.scan, readSnippet });
      if (result.cancelled) return { cancelled: true };
      const stats = new Map(t.scan.folders.map((f) => [f.rel, f]));
      return { folders: result.folders.map((f) => ({ ...stats.get(f.rel), ...f })), error: result.error || null };
    },

    // Facts calls (≤ 60 KB and ≤ 15 files each) plus the merge, for "Write the summary (about N Claude calls)".
    estimateCalls(token, folders = {}) {
      const t = tokens.get(token);
      if (!t) return 0;
      const on = t.scan.files.filter((f) => (f.top in folders ? folders[f.top].on && folders[f.top].kind !== 'exclude' : true));
      if (!on.length) return 0;
      const bytes = on.reduce((n, f) => n + Math.min(f.size, 60000), 0);
      return Math.max(Math.ceil(bytes / 60000), Math.ceil(Math.min(on.length, 400) / 15)) + 1;
    },

    async save({ token, name, role, writes, folders, keepInFolder }) {
      const t = tokens.get(token);
      if (!t) return { error: 'Choose the folder again' };
      let project;
      try {
        project = store.create({ dir: t.dir, name, role, writes, folders, keepInFolder: !!keepInFolder });
      } catch (err) {
        return { error: err.message };
      }
      tokens.delete(token);
      watch(project.id);
      build(project.id);
      return { id: project.id };
    },

    build: (id) => build(id),
    rebuild: (id) => build(id, { rebuild: true }),
    refresh,
    cancelBuild,

    getSummary,

    setSummary(id, text) {
      if (!store.get(id)) return null;
      const before = readSummary(id);
      const pins = summaryLib.mergePins(readPins(id), summaryLib.pinsFromEdit(before, String(text || ''), { today: isoDay(now()) }));
      saveSummary(id, String(text || ''), pins);
      return getSummary(id);
    },

    update(id, patch) {
      const project = store.update(id, patch);
      if (patch && patch.folders) sync(id);
      if (patch && patch.keepInFolder) saveSummary(id, readSummary(id));
      emit('projects-changed');
      return view(project);
    },

    // "Change folders": a fresh scan with the current map, new top-level folders as unsure.
    async folders(id) {
      const project = store.get(id);
      if (!project) return { error: 'Project not found' };
      const scan = await scanFolder(project.dir, { platform });
      return {
        folders: scan.folders.map((f) => {
          const known = project.folders[f.rel];
          if (known) return { ...f, ...known };
          if (f.codeRoot) return { ...f, kind: 'exclude', on: false };
          return { ...f, kind: f.rel === '' ? 'overview' : 'unsure', on: true, question: 'New folder: what is it?' };
        }),
      };
    },

    remove(id, { deletePromptlyMd = false } = {}) {
      const project = store.get(id);
      if (!project) return { ok: true };
      const pending = (live.get(id) || {}).syncing;
      forget(id);
      if (deletePromptlyMd && project.wrotePromptlyMd) {
        try { fs.rmSync(path.join(project.dir, 'PROMPTLY.md'), { force: true }); } catch { /* the folder may be gone */ }
      }
      const root = paths(id).root;
      store.remove(id);
      // A sync that was mid-way may still write; delete Promptly's copy again once it's done.
      if (pending) pending.finally(() => fs.rmSync(root, { recursive: true, force: true }));
      emit('projects-changed');
      return { ok: true };
    },

    locate(id, dir) {
      try {
        store.relocate(id, dir);
        forget(id);
        watch(id);
        sync(id);
        emit('projects-changed');
        return { dir };
      } catch (err) {
        return { error: err.message };
      }
    },

    suggest(text) {
      const projects = store.list().filter((p) => !folderMissing(p)).map((p) => {
        const s = state(p.id);
        if (!s.terms) s.terms = termsFromSummary(readSummary(p.id));
        return { id: p.id, name: p.name, people: s.terms.people, words: s.terms.words, lastUsedAt: p.lastUsedAt, defaultOutput: p.defaultOutput };
      });
      return suggestProject(String(text || ''), projects, { pickOutput });
    },

    // Everything a project request needs. Waits for a sync in progress so today's files count.
    async prepare({ id, transcript, output, exclude = [] }) {
      const project = store.get(id);
      if (!project) return { error: 'This project was removed' };
      if (folderMissing(project)) return { error: `Promptly can't find the ${project.name} folder. Locate it in Settings › Projects.` };
      // Always an incremental sync first, so a file saved a moment ago is already searchable
      // (a run already going may have started before it; wait for the follow-up too).
      await sync(id);
      for (let i = 0; i < 2 && state(id).syncing; i++) await state(id).syncing;
      const out = ['email', 'prompt', 'polish'].includes(output) ? output : pickOutput(transcript, project.defaultOutput);
      const index = indexOf(id);
      const search = (text, opts) => (index.available ? index.search(text, opts) : []);
      const manifest = manifestOf(id);
      // The conversation being answered: the best-matching conversation file, preferring one
      // from or about someone the request names.
      const thread = (text) => {
        const hits = search(text, { kinds: ['conversations'], limit: 8 });
        const names = [...new Set((String(text).match(/\b[A-Z][\p{L}'-]{2,}/gu) || []).map((n) => n.toLowerCase()))];
        const mentions = (h) => names.some((n) => `${h.title || ''} ${h.excerpt || ''}`.toLowerCase().includes(n));
        const best = hits.find(mentions) || hits[0];
        if (!best || !manifest[best.rel]) return null;
        const doc = loadDoc(id, best.rel, manifest[best.rel]);
        if (!doc) return null;
        const bytes = Buffer.from(doc.text, 'utf8');
        return { rel: doc.rel, date: doc.date, text: bytes.length > THREAD_BYTES ? bytes.subarray(bytes.length - THREAD_BYTES).toString('utf8') : doc.text };
      };
      const { block, sources } = assembleContext({ name: project.name, summary: readSummary(id), transcript, output: out, search, thread, exclude });
      store.update(id, { lastUsedAt: now() });
      return { project: { id, name: project.name, color: project.color }, output: out, block, sources, lookDeeper: project.lookDeeper, textDir: paths(id).text, kinds: KINDS_FOR[out] };
    },

    // Look deeper reads the text cache; its file paths map back to the project's own paths.
    relFromCache(id, file) {
      const root = path.resolve(paths(id).text) + path.sep;
      const abs = path.resolve(String(file || ''));
      if (!abs.startsWith(root) || !abs.endsWith('.txt')) return null;
      const rel = abs.slice(root.length, -4).split(path.sep).join('/');
      return manifestOf(id)[rel] ? rel : null;
    },

    dateOf(id, rel) { return (manifestOf(id)[rel] || {}).date || ''; },

    // Whether a path Look deeper used is inside the project's text copy (relative = inside its cwd).
    insideCache(id, file) {
      const root = path.resolve(paths(id).text);
      const abs = path.resolve(root, String(file || ''));
      return abs === root || abs.startsWith(root + path.sep);
    },

    start() {
      for (const p of store.list()) {
        watch(p.id);
        sync(p.id);
      }
    },

    // Window focus: rescan, at most once a minute per project (network drives don't send events).
    onFocus() {
      for (const p of store.list()) {
        const s = state(p.id);
        if (now() - s.lastFocus < FOCUS_RESCAN_MS) continue;
        s.lastFocus = now();
        sync(p.id);
      }
    },

    stop() { for (const id of [...live.keys()]) forget(id); },

    // For tests.
    _sync: sync,
    _store: store,
  };
}

module.exports = { createProjectService };
