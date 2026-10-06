'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Walks a connected project folder and decides, without any AI, which files Promptly may read.
// Read-only: nothing is written to the folder and no symlink is followed. The only contents read
// are ignore files and the first 8 KB of each candidate (the NUL-byte binary check), so a
// 5,000-file folder scans in well under a second.

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const PROBE_BYTES = 8192;
const CONCURRENCY = 32;
const PROBE_BATCH = 64;

const BASE_READABLE = ['.md', '.markdown', '.txt', '.eml', '.mbox', '.html', '.htm'];
const DARWIN_READABLE = ['.docx', '.rtf', '.doc']; // converted with textutil
// Zip (.docx) and OLE (.doc) containers always contain NUL bytes; textutil reads them.
const NO_PROBE = new Set(['.docx', '.doc']);

// Lowercase only: these are tool output names. A person's "Build" or "Vendor" folder is kept.
const BUILTIN_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'vendor', 'venv', '.venv', '__pycache__', '.next', '.cache', 'target', 'coverage']);
const CODE_ROOT_MARKERS = new Set(['package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml', 'requirements.txt', 'pom.xml', 'build.gradle', 'Gemfile', 'composer.json']);

const MEDIA = new Set([
  // images
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tif', '.tiff', '.webp', '.heic', '.heif', '.ico', '.icns', '.svg', '.psd', '.ai', '.eps', '.raw', '.cr2', '.nef', '.dng',
  // audio
  '.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus', '.aif', '.aiff', '.wma', '.mid', '.midi', '.caf',
  // video
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv', '.flv', '.mpg', '.mpeg', '.3gp',
  // archives
  '.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.rar', '.zst', '.lz', '.lzma', '.cab', '.iso', '.jar',
  // installers
  '.dmg', '.pkg', '.mpkg', '.msi', '.msix', '.exe', '.deb', '.rpm', '.apk', '.ipa', '.appimage',
  // fonts
  '.ttf', '.otf', '.woff', '.woff2',
]);

const CODE = new Set([
  '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.astro',
  '.py', '.ipynb', '.rb', '.go', '.rs', '.java', '.kt', '.kts', '.scala', '.groovy', '.gradle', '.swift', '.m', '.mm',
  '.c', '.h', '.cc', '.cpp', '.cxx', '.hpp', '.hh', '.cs', '.fs', '.vb', '.php', '.pl', '.pm', '.lua', '.r', '.dart',
  '.ex', '.exs', '.erl', '.hs', '.clj', '.elm',
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.psm1', '.bat', '.cmd',
  '.json', '.jsonc', '.json5', '.yaml', '.yml', '.toml', '.xml', '.ini', '.cfg', '.conf', '.properties', '.env', '.plist',
  '.css', '.scss', '.sass', '.less', '.styl',
  '.lock', '.sql', '.tf', '.hcl', '.proto', '.graphql', '.gql', '.cmake', '.mk', '.map',
  '.pbxproj', '.xcconfig', '.storyboard', '.xib', '.csproj', '.sln', '.vcxproj',
]);
// Includes the code-root markers without a code extension, for when one sits in the connected
// folder itself (never a code root, see walk).
const CODE_NAMES = new Set(['makefile', 'dockerfile', 'rakefile', 'procfile', 'podfile', 'vagrantfile', 'jenkinsfile', 'cmakelists.txt', 'requirements.txt', 'gemfile', 'go.mod', 'go.sum']);

// Directories that are really one thing to the person (an app, a library, a project file):
// walking into them would surface their internal help pages and plists as "documents".
const MEDIA_PACKAGES = new Set(['.app', '.framework', '.bundle', '.photoslibrary', '.musiclibrary', '.imovielibrary', '.fcpbundle', '.logicx', '.band']);
const CODE_PACKAGES = new Set(['.xcodeproj', '.xcworkspace', '.playground']);
const DOC_PACKAGES = new Set(['.pages', '.numbers', '.key', '.rtfd', '.sketch']);

function readableExtensions(platform = process.platform) {
  return new Set(platform === 'darwin' ? [...BASE_READABLE, ...DARWIN_READABLE] : BASE_READABLE);
}

// "~$" files are Office lock files (hidden on Windows, visible on a Mac).
function isHidden(name) {
  return name.startsWith('.') || name.startsWith('~$');
}

// Index of the "]" closing a character class that opens at i, or -1 (then "[" is literal).
function classEnd(glob, i) {
  let j = i + 1;
  if (glob[j] === '!' || glob[j] === '^') j++;
  if (glob[j] === ']') j++;
  for (; j < glob.length; j++) {
    if (glob[j] === '\\') j++;
    else if (glob[j] === ']') return j;
  }
  return -1;
}

// Like git, a backwards range such as [z-a] matches only its first character; it never spoils
// the other rules (a RegExp would throw on it and lose the whole file).
function classToken(body) {
  let i = 0;
  const neg = body[0] === '!' || body[0] === '^';
  if (neg) i = 1;
  const take = () => {
    if (body[i] === '\\' && i + 1 < body.length) i++;
    return body[i++];
  };
  const ranges = [];
  while (i < body.length) {
    const lo = take();
    let hi = lo;
    if (body[i] === '-' && i + 1 < body.length) {
      i++;
      hi = take();
    }
    ranges.push([lo, hi]);
  }
  return { t: 'set', neg, ranges };
}

// gitignore glob → tokens: "ch" one literal character, "any" (?), "set" ([...]), "star" (*, never
// crosses "/"), "dirs" (a whole "**/" segment: nothing, or anything ending in "/"), "rest" (a
// trailing "**": anything).
function globTokens(glob) {
  const tokens = [];
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      let j = i;
      while (glob[j] === '*') j++;
      const segmentStart = i === 0 || glob[i - 1] === '/';
      if (j - i >= 2 && segmentStart && j === glob.length) tokens.push({ t: 'rest' });
      else if (j - i >= 2 && segmentStart && glob[j] === '/') {
        tokens.push({ t: 'dirs' });
        j++;
      } else tokens.push({ t: 'star' });
      i = j - 1;
    } else if (c === '?') {
      tokens.push({ t: 'any' });
    } else if (c === '[' && classEnd(glob, i) !== -1) {
      const end = classEnd(glob, i);
      tokens.push(classToken(glob.slice(i + 1, end)));
      i = end;
    } else if (c === '\\') {
      if (i + 1 < glob.length) tokens.push({ t: 'ch', c: glob[++i] });
    } else {
      tokens.push({ t: 'ch', c });
    }
  }
  return tokens;
}

function matchesOne(tok, c) {
  if (tok.t === 'ch') return tok.c === c;
  if (c === '/') return false;
  if (tok.t === 'any') return true;
  return tok.ranges.some(([lo, hi]) => c === lo || (c >= lo && c <= hi)) !== tok.neg;
}

// Walks the path once, tracking every pattern position still alive, so a pattern like
// "*a*a*a*a*a*a*b" costs path length × pattern length. A RegExp backtracks exponentially on it
// and would freeze the main process at every launch for a folder carrying such a .gitignore.
// Positions 0..n mean "next token to match"; n + 1 + i means "inside the dirs token at i", which
// has consumed something and may only move on right after a "/".
function globMatch(tokens, s) {
  const n = tokens.length;
  const seen = new Uint32Array(2 * n + 2);
  let stamp = 1;
  const add = (list, i) => {
    while (seen[i] !== stamp) {
      seen[i] = stamp;
      list.push(i);
      const t = i < n ? tokens[i].t : null;
      if (t !== 'star' && t !== 'dirs' && t !== 'rest') return;
      i++;
    }
  };
  let live = [];
  add(live, 0);
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    const next = [];
    stamp++;
    for (const i of live) {
      if (i > n) {
        add(next, i);
        if (c === '/') add(next, i - n);
        continue;
      }
      if (i === n) continue;
      const tok = tokens[i];
      if (tok.t === 'rest') return true;
      if (tok.t === 'dirs') {
        add(next, n + 1 + i);
        if (c === '/') add(next, i + 1);
      } else if (tok.t === 'star') {
        if (c !== '/') add(next, i);
      } else if (matchesOne(tok, c)) {
        add(next, i + 1);
      }
    }
    if (!next.length) return false;
    live = next;
  }
  return live.includes(n);
}

function compileIgnore(text, ignoreCase) {
  const rules = [];
  for (const raw of String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    // gitignore(5) drops unescaped trailing spaces only; a trailing tab is part of the pattern.
    let line = raw.replace(/(?<!\\) +$/, '');
    if (!line || line.startsWith('#')) continue;
    const negate = line.startsWith('!');
    if (negate) line = line.slice(1);
    const dirOnly = line.endsWith('/');
    line = line.replace(/\/+$/, '');
    if (!line) continue;
    // A slash at the start or in the middle ties the pattern to the ignore file's folder.
    const anchored = line.includes('/');
    line = line.replace(/^\//, '');
    const tokens = globTokens(ignoreCase ? line.toLowerCase() : line);
    if (!anchored) tokens.unshift({ t: 'dirs' });
    // Most rules start or end in plain text ("/archive", "*.log"): checking that first rules out
    // most paths without walking them.
    let h = 0;
    while (h < tokens.length && tokens[h].t === 'ch') h++;
    let k = tokens.length;
    while (k > h && tokens[k - 1].t === 'ch') k--;
    const literal = (from, to) => tokens.slice(from, to).map((tok) => tok.c).join('');
    rules.push({ tokens, head: literal(0, h), tail: literal(k, tokens.length), negate, dirOnly });
  }
  return rules;
}

// Git semantics: every rule that matches is applied in order, so the last match wins and a
// deeper ignore file overrides a shallower one.
function applyRules(ignored, set, rel, isDir, ignoreCase) {
  if (!set) return ignored;
  let sub = set.base ? rel.slice(set.base.length + 1) : rel;
  if (ignoreCase) sub = sub.toLowerCase();
  for (const rule of set.rules) {
    if ((!rule.dirOnly || isDir) && sub.startsWith(rule.head) && sub.endsWith(rule.tail) && globMatch(rule.tokens, sub)) ignored = !rule.negate;
  }
  return ignored;
}

// Windows PowerShell 5.1 writes "x" > .promptlyignore as UTF-16LE, and its UTF-8 adds a BOM.
function decodeIgnoreFile(buf) {
  return buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8');
}

function isCodeRoot(entries) {
  return entries.some((e) => CODE_ROOT_MARKERS.has(e.name) || (e.name.endsWith('.xcodeproj') && e.isDirectory()));
}

function direntType(e) {
  if (e.isSymbolicLink()) return 'link';
  if (e.isDirectory()) return 'dir';
  if (e.isFile()) return 'file';
  return null;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function scanFolder(dir, { maxFiles, platform = process.platform, fsImpl = fs } = {}) {
  // An empty path would resolve to the app's working directory and scan that instead.
  if (typeof dir !== 'string' || !dir) throw new TypeError('scanFolder needs a folder path');
  const cap = Number.isFinite(maxFiles) ? Math.max(0, Math.floor(maxFiles)) : 5000;
  const fsp = fsImpl.promises;
  const root = path.resolve(dir);
  const readable = readableExtensions(platform);
  // Git matches ignore patterns case-insensitively on the case-insensitive Mac and Windows disks.
  const ignoreCase = platform === 'darwin' || platform === 'win32';
  const skipped = {};
  const buckets = new Map();
  const pending = [];

  const bucket = (top) => {
    if (!buckets.has(top)) buckets.set(top, { rel: top, count: 0, newestMs: null, codeRoot: false, skippedCount: 0, codeRootFiles: 0, candidates: 0 });
    return buckets.get(top);
  };
  // top: the top-level folder the thing sits in ('' = the folder's own files), or null for a
  // top-level folder skipped as a whole (node_modules, .git…), which gets no folders[] row.
  const skip = (reason, top) => {
    skipped[reason] = (skipped[reason] || 0) + 1;
    if (top !== null) bucket(top).skippedCount++;
  };

  const readRules = async (abs, base) => {
    try {
      return { base, rules: compileIgnore(decodeIgnoreFile(await fsp.readFile(abs)), ignoreCase) };
    } catch {
      return null;
    }
  };
  // .promptlyignore (root only) is applied after every .gitignore, so it can also bring back a
  // git-ignored path. Set when the walk lists the root.
  let promptlyRules = null;
  const isIgnored = (sets, rel, isDir) => {
    const byGit = sets.reduce((acc, set) => applyRules(acc, set, rel, isDir, ignoreCase), false);
    return applyRules(byGit, promptlyRules, rel, isDir, ignoreCase);
  };

  // Inside a code root every file counts as code-root, so packages there are walked like any folder.
  const dirSkipReason = (name, rel, sets, inCode) => {
    if (BUILTIN_DIRS.has(name)) return 'builtin';
    if (isHidden(name)) return 'hidden';
    const ext = path.extname(name).toLowerCase();
    if (!inCode && MEDIA_PACKAGES.has(ext)) return 'media';
    if (!inCode && CODE_PACKAGES.has(ext)) return 'code';
    if (!inCode && DOC_PACKAGES.has(ext)) return 'unsupported';
    if (isIgnored(sets, rel, true)) return 'ignored';
    return null;
  };

  const fileSkipReason = (name, ext) => {
    if (MEDIA.has(ext)) return 'media';
    if (CODE.has(ext) || CODE_NAMES.has(name.toLowerCase())) return 'code';
    if (!readable.has(ext)) return 'unsupported';
    return null;
  };

  async function walk(abs, rel, top, sets, inCode) {
    let entries;
    try {
      entries = await fsp.readdir(abs, { withFileTypes: true });
    } catch {
      skip('unreadable', top);
      return;
    }
    // isFile() is false for a symlink, so an ignore file is never read from outside the folder.
    if (entries.some((e) => e.name === '.gitignore' && e.isFile())) {
      const set = await readRules(path.join(abs, '.gitignore'), rel);
      if (set) sets = [...sets, set];
    }
    if (!rel && entries.some((e) => e.name === '.promptlyignore' && e.isFile())) {
      promptlyRules = await readRules(path.join(abs, '.promptlyignore'), '');
    }
    // The connected folder itself is never a code root: the person chose it, and a repo's
    // README and docs are what a project mode is for. Its code files are still skipped by type.
    if (!inCode && rel && isCodeRoot(entries)) {
      inCode = true;
      if (rel === top) bucket(top).codeRoot = true;
    }

    const dirs = [];
    for (const e of entries) {
      const name = e.name;
      const childAbs = path.join(abs, name);
      const childRel = rel ? `${rel}/${name}` : name;
      let type = direntType(e);
      if (!type) {
        try {
          const st = await fsp.lstat(childAbs);
          type = st.isSymbolicLink() ? 'link' : st.isDirectory() ? 'dir' : st.isFile() ? 'file' : 'other';
        } catch {
          type = 'unreadable';
        }
      }
      if (type === 'dir') {
        const reason = dirSkipReason(name, childRel, sets, inCode);
        if (reason) skip(reason, rel ? top : null);
        else dirs.push([childAbs, childRel, rel ? top : name]);
        continue;
      }
      const fileTop = rel ? top : '';
      if (type === 'unreadable') skip('unreadable', fileTop);
      else if (type === 'link') skip('symlink', fileTop);
      else if (type !== 'file') skip('unsupported', fileTop);
      else if (isHidden(name)) skip('hidden', fileTop);
      else if (isIgnored(sets, childRel, false)) skip('ignored', fileTop);
      else if (inCode) {
        skip('code-root', fileTop);
        bucket(fileTop).codeRootFiles++;
      } else {
        const ext = path.extname(name).toLowerCase();
        const reason = fileSkipReason(name, ext);
        if (reason) skip(reason, fileTop);
        else pending.push({ abs: childAbs, rel: childRel, ext, top: fileTop });
      }
    }

    for (const [childAbs, childRel, childTop] of dirs) {
      if (!rel) bucket(childTop);
      await walk(childAbs, childRel, childTop, sets, inCode);
    }
  }

  await walk(root, '', null, [], false);

  const stats = await mapLimit(pending, CONCURRENCY, (p) => fsp.lstat(p.abs).catch(() => null));
  const candidates = [];
  pending.forEach((p, i) => {
    const st = stats[i];
    if (!st) skip('unreadable', p.top);
    else if (st.isSymbolicLink()) skip('symlink', p.top);
    else if (!st.isFile()) skip('unsupported', p.top);
    else if (st.size === 0) skip('empty', p.top);
    else if (st.size > MAX_FILE_BYTES) skip('too-big', p.top);
    else {
      candidates.push({ ...p, size: st.size, mtimeMs: st.mtimeMs });
      bucket(p.top).candidates++;
    }
  });
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs || (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  const probe = async (c) => {
    if (NO_PROBE.has(c.ext)) return null;
    let handle;
    try {
      handle = await fsp.open(c.abs, 'r');
      const buf = Buffer.alloc(Math.min(PROBE_BYTES, c.size));
      const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
      return buf.subarray(0, bytesRead).includes(0) ? 'binary' : null;
    } catch {
      return 'unreadable';
    } finally {
      if (handle) await handle.close().catch(() => {});
    }
  };

  // Probe newest first and stop once the cap is reached, so a huge folder isn't read in full.
  const files = [];
  let tooMany = 0;
  let next = 0;
  while (next < candidates.length && files.length < cap) {
    const batch = candidates.slice(next, next + PROBE_BATCH);
    next += batch.length;
    const verdicts = await mapLimit(batch, CONCURRENCY, probe);
    batch.forEach((c, i) => {
      if (verdicts[i]) {
        skip(verdicts[i], c.top);
        bucket(c.top).candidates--;
      } else if (files.length < cap) files.push({ rel: c.rel, size: c.size, mtimeMs: c.mtimeMs, ext: c.ext, top: c.top });
      else tooMany++;
    });
  }
  tooMany += candidates.length - next;

  for (const f of files) {
    const b = bucket(f.top);
    b.count++;
    if (b.newestMs === null || f.mtimeMs > b.newestMs) b.newestMs = f.mtimeMs;
  }
  const folders = [...buckets.values()]
    .filter((b) => b.rel !== '' || b.count > 0)
    .map((b) => ({
      rel: b.rel,
      count: b.count,
      newestMs: b.newestMs,
      // Also a code folder when it holds nothing readable besides code-root subtrees. Judged
      // before the maxFiles cap, so older documents dropped by the cap still count as documents.
      codeRoot: b.codeRoot || (b.candidates === 0 && b.codeRootFiles > 0),
      skippedCount: b.skippedCount,
    }))
    .sort((a, b) => (a.rel === '' ? -1 : b.rel === '' ? 1 : a.rel.localeCompare(b.rel, undefined, { numeric: true, sensitivity: 'base' })));

  return { files, folders, skipped, tooMany };
}

function hashFile(abs) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    fs.createReadStream(abs)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

// dir is the scanned folder: each file is hashed as hashFile(path.join(dir, rel), entry). A file
// that can't be hashed (gone or locked mid-scan) keeps its previous entry, or waits for the next
// scan if it is new; either way it is listed in failed, so a wrong dir can't pass for "no changes".
async function diffManifest(prev, files, { dir, hashFile: hash = hashFile } = {}) {
  if (typeof dir !== 'string' || !dir) throw new TypeError('diffManifest needs the scanned folder as dir');
  if (typeof hash !== 'function') throw new TypeError('diffManifest needs hashFile to be a function');
  const root = path.resolve(dir);
  const before = prev && typeof prev === 'object' ? prev : {};
  const results = await mapLimit(files, 8, async (f) => {
    const old = Object.hasOwn(before, f.rel) && before[f.rel] && typeof before[f.rel] === 'object' ? before[f.rel] : null;
    if (old && old.size === f.size && old.mtimeMs === f.mtimeMs) return { state: 'same', entry: { ...old } };
    let sha1;
    try {
      sha1 = await hash(path.join(root, f.rel), f);
    } catch {
      return { state: 'failed', entry: old ? { ...old } : null };
    }
    if (!old) return { state: 'added', entry: { size: f.size, mtimeMs: f.mtimeMs, sha1, kind: null, extractedAt: null, inSummary: false } };
    return { state: old.sha1 === sha1 ? 'same' : 'changed', entry: { ...old, size: f.size, mtimeMs: f.mtimeMs, sha1 } };
  });

  const added = [];
  const changed = [];
  const failed = [];
  const next = {};
  const seen = new Set();
  files.forEach((f, i) => {
    seen.add(f.rel);
    const r = results[i];
    if (r.entry) next[f.rel] = r.entry;
    if (r.state === 'added') added.push(f.rel);
    else if (r.state === 'changed') changed.push(f.rel);
    else if (r.state === 'failed') failed.push(f.rel);
  });
  const removed = Object.keys(before).filter((rel) => !seen.has(rel));
  return { added, changed, removed, next, failed };
}

module.exports = { scanFolder, readableExtensions, hashFile, diffManifest };
