'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Connected project folders: the records live in config.json `projects[]`, and everything
// Promptly derives from a folder (summary, pins, manifest, extracted text, search index) lives
// in dataDir/<id>/, never inside the user's folder.

// Dots for the mode menu and history tags. Each sits apart from every mode tone in
// shared/modes.json and reads on both the dark and light window. The first two are the
// owner's mockup colours.
const PROJECT_COLORS = ['#E3B341', '#5AC8A8', '#EF6461', '#4FB8E0', '#D66BD9', '#9CC03F', '#C08A5B', '#E86A92'];

const ROLES = ['manager', 'developer', 'designer', 'sales', 'other'];
const WRITES = ['client-emails', 'team-prompts', 'status-updates', 'other'];
const OUTPUTS = ['email', 'prompt', 'polish'];
const KINDS = ['overview', 'conversations', 'agreements', 'build', 'reference', 'exclude', 'unsure'];
const ID_RE = /^[0-9a-f]{8}$/;

// Spec §17: the first of these the person picked wins; "Something else" alone, or nothing, → Prompt.
function defaultOutputFor(writes) {
  const list = Array.isArray(writes) ? writes : [];
  if (list.includes('client-emails')) return 'email';
  if (list.includes('team-prompts')) return 'prompt';
  if (list.includes('status-updates')) return 'polish';
  return 'prompt';
}

function cleanWrites(value) {
  if (!Array.isArray(value)) return null;
  return WRITES.filter(w => value.includes(w));
}

// Folder keys are paths relative to the project ('' = its top-level files); anything that could
// point outside it is dropped. Without an explicit switch, only `exclude` starts off (spec A4).
function cleanFolders(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  for (const [rel, entry] of Object.entries(value)) {
    if (rel.includes('\\') || /^[a-z]:/i.test(rel) || path.posix.isAbsolute(rel) || rel.split('/').includes('..')) continue;
    if (!entry || !KINDS.includes(entry.kind)) continue;
    out[rel] = { kind: entry.kind, on: typeof entry.on === 'boolean' ? entry.on : entry.kind !== 'exclude' };
  }
  return out;
}

const isTime = v => v === null || (Number.isFinite(v) && v >= 0);

// One validator per field a patch may set; a value it rejects (undefined) is ignored.
// id and dir are not here, so no patch can move a project to another id or folder.
const FIELDS = {
  name: v => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
  color: v => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : undefined),
  role: v => (ROLES.includes(v) ? v : undefined),
  writes: v => cleanWrites(v) ?? undefined,
  defaultOutput: v => (OUTPUTS.includes(v) ? v : undefined),
  folders: v => cleanFolders(v) ?? undefined,
  lookDeeper: v => (typeof v === 'boolean' ? v : undefined),
  keepInFolder: v => (typeof v === 'boolean' ? v : undefined),
  wrotePromptlyMd: v => (typeof v === 'boolean' ? v : undefined),
  summaryUpdatedAt: v => (isTime(v) ? v : undefined),
  summaryFileCount: v => (Number.isInteger(v) && v >= 0 ? v : undefined),
  lastUsedAt: v => (isTime(v) ? v : undefined),
};

function cleanPatch(patch, keys) {
  const out = {};
  if (!patch || typeof patch !== 'object') return out;
  for (const key of keys) {
    if (!(key in patch)) continue;
    const value = FIELDS[key](patch[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function createProjectStore({ config, dataDir, fsImpl = fs, randomId = () => crypto.randomBytes(4).toString('hex') }) {
  const root = path.resolve(dataDir);
  // The native realpath also settles letter case (macOS, Windows), so "~/Work/Acme" and
  // "~/work/acme" are recognised as one folder.
  const realpath = p => (fsImpl.realpathSync.native || fsImpl.realpathSync)(p);
  const sameDir = p => { try { return realpath(p); } catch { return path.resolve(p); } };

  function list() {
    const projects = config.read().projects;
    return Array.isArray(projects) ? projects.filter(p => p && typeof p === 'object' && typeof p.id === 'string') : [];
  }

  function save(projects) {
    config.update({ projects });
  }

  function get(id) {
    return list().find(p => p.id === id) || null;
  }

  function findByDir(dir) {
    if (typeof dir !== 'string' || !dir) return null;
    const target = sameDir(dir);
    return list().find(p => typeof p.dir === 'string' && sameDir(p.dir) === target) || null;
  }

  function newId(taken) {
    for (let i = 0; i < 20; i++) {
      const id = String(randomId()).toLowerCase();
      if (ID_RE.test(id) && !taken.has(id)) return id;
    }
    throw new Error('Could not make a project id');
  }

  // The first colour no project uses; once all are taken, the least used, so neighbours still differ.
  function nextColor(projects) {
    const counts = PROJECT_COLORS.map(c => projects.filter(p => String(p.color).toUpperCase() === c).length);
    return PROJECT_COLORS[counts.indexOf(Math.min(...counts))];
  }

  function create(fields = {}) {
    if (typeof fields.dir !== 'string' || !fields.dir) throw new Error('Choose a folder');
    let dir;
    try { dir = realpath(fields.dir); } catch { throw new Error('Folder not found'); }
    if (!fsImpl.statSync(dir).isDirectory()) throw new Error('Folder not found');
    const projects = list();
    const existing = findByDir(dir);
    if (existing) throw new Error(`Already connected as ${existing.name}`);

    const picked = cleanPatch(fields, ['name', 'role', 'writes', 'folders', 'lookDeeper', 'keepInFolder']);
    const writes = picked.writes || [];
    const project = {
      id: newId(new Set(projects.map(p => p.id))),
      name: picked.name || path.basename(dir),
      dir,
      color: nextColor(projects),
      role: picked.role || 'other',
      writes,
      defaultOutput: defaultOutputFor(writes),
      folders: picked.folders || {},
      lookDeeper: picked.lookDeeper ?? true,
      keepInFolder: picked.keepInFolder ?? false,
      wrotePromptlyMd: false,
      summaryUpdatedAt: null,
      summaryFileCount: 0,
      lastUsedAt: null,
    };
    save([...projects, project]);
    return project;
  }

  function update(id, patch) {
    const projects = list();
    const index = projects.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Project not found');
    const changes = cleanPatch(patch, Object.keys(FIELDS));
    // Changing what they write moves the default with it, unless the patch sets one itself.
    if (changes.writes && !changes.defaultOutput) changes.defaultOutput = defaultOutputFor(changes.writes);
    const next = { ...projects[index], ...changes };
    projects[index] = next;
    save(projects);
    return next;
  }

  function projectRoot(id) {
    if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error('Invalid project id');
    const dirPath = path.join(root, id);
    const rel = path.relative(root, dirPath);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Invalid project id');
    return dirPath;
  }

  // Deletes Promptly's own copy only. The data goes first, so a failure (a file still open)
  // leaves the project listed and Remove can be tried again.
  function remove(id) {
    const dirPath = projectRoot(id);
    fsImpl.rmSync(dirPath, { recursive: true, force: true });
    const projects = list();
    if (projects.some(p => p.id === id)) save(projects.filter(p => p.id !== id));
  }

  function paths(id) {
    const dirPath = projectRoot(id);
    return {
      root: dirPath,
      summary: path.join(dirPath, 'summary.md'),
      pins: path.join(dirPath, 'pins.json'),
      manifest: path.join(dirPath, 'manifest.json'),
      text: path.join(dirPath, 'text'),
      db: path.join(dirPath, 'search.db'),
    };
  }

  return { list, get, findByDir, create, update, remove, paths };
}

module.exports = { createProjectStore, PROJECT_COLORS, defaultOutputFor, ROLES, WRITES, KINDS };
