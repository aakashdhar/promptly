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
// The name shows in the mode menu, history tags and prompts ("…for <Project>").
const NAME_MAX = 80;
const OWN_FILES_ERROR = "Choose a project folder, not one that holds Promptly's own files";

// Line breaks, tabs and other control characters become one space. The cap counts characters,
// not UTF-16 units, so an emoji is never cut in half.
function cleanName(value) {
  if (typeof value !== 'string') return undefined;
  const name = Array.from(value.replace(/[\p{Cc}\s]+/gu, ' ').trim()).slice(0, NAME_MAX).join('').trim();
  return name || undefined;
}

// The default name for a folder. A drive root has no folder name (basename('E:\\') is ''),
// so a USB drive connected whole becomes "Drive E".
function nameForFolder(dir, pathImpl = path) {
  const drive = /^([a-z]):[\\/]*$/i.exec(dir);
  return cleanName(pathImpl.basename(dir)) || (drive ? `Drive ${drive[1].toUpperCase()}` : cleanName(dir));
}

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
  name: cleanName,
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

// True when inner is outer or sits inside it. A sibling such as "projects-old" is not inside "projects".
function contains(outer, inner) {
  const rel = path.relative(outer, inner);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

// appDataDir is Promptly's whole app-data folder (userData), which holds dataDir, config.json and
// the speech models; no project folder may hold it or sit inside it, or the scan and the watcher
// would read Promptly's own writes back as project files.
function createProjectStore({ config, dataDir, appDataDir, fsImpl = fs, randomId = () => crypto.randomBytes(4).toString('hex') }) {
  const root = path.resolve(dataDir);
  const ownDirs = [dataDir, appDataDir].filter(d => typeof d === 'string' && d);
  // The native realpath also settles letter case (macOS, Windows), so "~/Work/Acme" and
  // "~/work/acme" are recognised as one folder. It fails on some Windows volumes (RAM disks,
  // some virtual drives) where the JS one works.
  const realpath = p => {
    if (typeof fsImpl.realpathSync.native === 'function') {
      try { return fsImpl.realpathSync.native(p); } catch { /* try the JS one */ }
    }
    return fsImpl.realpathSync(p);
  };
  const sameDir = p => { try { return realpath(p); } catch { return path.resolve(p); } };
  // dataDir doesn't exist before the first project is built; its nearest existing parent is
  // resolved instead, so a linked parent (/var → /private/var) still compares equal.
  function realpathLoose(p) {
    let head = path.resolve(p);
    const tail = [];
    for (;;) {
      try { return path.join(realpath(head), ...tail); } catch { /* go up one */ }
      const parent = path.dirname(head);
      if (parent === head) return path.resolve(p);
      tail.unshift(path.basename(head));
      head = parent;
    }
  }

  // A record is a project only with a well-formed id and a folder. Anything else (a hand edit)
  // could never be built, refreshed or removed, so it isn't listed and drops out on the next save.
  function list() {
    const projects = config.read().projects;
    return Array.isArray(projects)
      ? projects.filter(p => p && typeof p === 'object' && typeof p.id === 'string' && ID_RE.test(p.id) && typeof p.dir === 'string' && p.dir)
      : [];
  }

  function save(projects) {
    config.update({ projects });
  }

  function get(id) {
    return list().find(p => p.id === id) || null;
  }

  function findByDir(dir, exceptId) {
    if (typeof dir !== 'string' || !dir) return null;
    const target = sameDir(dir);
    return list().find(p => p.id !== exceptId && sameDir(p.dir) === target) || null;
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

  // The checks a folder passes before a project may point at it; returns its real path.
  function checkFolder(value, exceptId) {
    if (typeof value !== 'string' || !value) throw new Error('Choose a folder');
    let dir;
    try { dir = realpath(value); } catch { throw new Error('Folder not found'); }
    let isDir = false;
    try { isDir = fsImpl.statSync(dir).isDirectory(); } catch { /* reported below */ }
    if (!isDir) throw new Error('Folder not found');
    for (const own of ownDirs.map(realpathLoose)) {
      if (contains(own, dir) || contains(dir, own)) throw new Error(OWN_FILES_ERROR);
    }
    const existing = findByDir(dir, exceptId);
    if (existing) throw new Error(`Already connected as ${cleanName(existing.name) || nameForFolder(existing.dir)}`);
    return dir;
  }

  function create(fields) {
    const f = fields && typeof fields === 'object' ? fields : {};
    const dir = checkFolder(f.dir);
    const projects = list();
    const picked = cleanPatch(f, ['name', 'role', 'writes', 'folders', 'lookDeeper', 'keepInFolder']);
    const writes = picked.writes || [];
    const project = {
      id: newId(new Set(projects.map(p => p.id))),
      name: picked.name || nameForFolder(dir),
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

  // "Folder not found · Locate…" (spec §30): the same project, summary and index, on the folder's
  // new path. update() can't change dir, so this is the only way a project moves.
  function relocate(id, dir) {
    const projects = list();
    const index = projects.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Project not found');
    const next = { ...projects[index], dir: checkFolder(dir, id) };
    projects[index] = next;
    save(projects);
    return next;
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

  return { list, get, findByDir, create, relocate, update, remove, paths };
}

module.exports = { createProjectStore, PROJECT_COLORS, defaultOutputFor, nameForFolder, ROLES, WRITES, KINDS };
