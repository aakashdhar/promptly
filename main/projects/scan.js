'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Walks a connected project folder and decides, without any AI, which files Promptly may read.
// Read-only: nothing is written to the folder and no symlink is followed, except an ignore file
// linked to another file inside the folder (only its rules are read). The only contents read are
// ignore files and the first 8 KB of each candidate (the NUL-byte binary check), so a 5,000-file
// folder scans in well under a second.

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const PROBE_BYTES = 8192;
const CONCURRENCY = 32;
const PROBE_BATCH = 64;
const MAX_FILES = 5000;
// Enough for any project folder; connecting something like a home folder stops here instead of
// walking millions of entries.
const MAX_ENTRIES = 200000;
// A walk stopped at maxEntries lists what it never reached in unchecked, so a manifest diff still
// reports files deleted from the part it did walk. Past this many in one folder it lists the folder.
const MAX_UNREACHED_LISTED = 1000;
const FS_METHODS = ['readdir', 'realpath', 'lstat', 'readFile', 'open'];

// warnings[].reason: why an ignore file's rules were not applied, for the connect screen.
const WARN_OUTSIDE = 'ignore file links outside the folder';
const WARN_BROKEN = 'ignore file link is broken';
const WARN_UNREADABLE = "ignore file can't be read";
// Ignore matching is synchronous: the walk gives the main process a turn at least this often.
const YIELD_MS = 15;
// O_NOFOLLOW makes an open fail on a file swapped for a symlink after its lstat. Windows has no
// such flag, so there a file swapped for a link mid-scan is read through it (making a file
// symlink there takes admin rights or Developer Mode). A swapped folder is caught on every
// platform by the realpath check in walk.
const READ_NOFOLLOW = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);

const BASE_READABLE = ['.md', '.markdown', '.txt', '.eml', '.mbox', '.html', '.htm'];
const DARWIN_READABLE = ['.docx', '.rtf', '.doc']; // converted with textutil
// Zip (.docx) and OLE (.doc) containers always contain NUL bytes; textutil reads them.
const NO_PROBE = new Set(['.docx', '.doc']);
// The types extract.js decodes from UTF-16. The mail parsers read raw bytes and textutil refuses
// UTF-16 RTF, so for those a byte-order mark proves nothing.
const UTF16_READABLE = new Set(['.md', '.markdown', '.txt', '.html', '.htm']);

// Lowercase only: these are tool output names. A person's "Build" or "Vendor" folder is kept.
const BUILTIN_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'vendor', 'venv', '.venv', '__pycache__', '.next', '.cache', 'target', 'coverage']);
// No requirements.txt: a manager's specs folder can hold one (DECISIONS 2026-10-06).
const CODE_ROOT_MARKERS = new Set(['package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml', 'setup.py', 'Pipfile', 'pom.xml', 'build.gradle', 'Gemfile', 'composer.json']);

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
const CODE_NAMES = new Set(['makefile', 'dockerfile', 'rakefile', 'procfile', 'podfile', 'vagrantfile', 'jenkinsfile', 'cmakelists.txt', 'gemfile', 'pipfile', 'go.mod', 'go.sum']);

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

// git's wildmatch classes, ASCII only like git. With case folding the path's ASCII letters are
// lowercased, so [:upper:] also takes lowercase letters, as git does.
const CLASS_TESTS = {
  alnum: /[0-9A-Za-z]/,
  alpha: /[A-Za-z]/,
  blank: /[ \t]/,
  cntrl: /[\x00-\x1f\x7f]/,
  digit: /[0-9]/,
  graph: /[!-~]/,
  lower: /[a-z]/,
  print: /[ -~]/,
  punct: /[!-/:-@[-`{-~]/,
  space: /[\t\n\r ]/,
  upper: /[A-Z]/,
  xdigit: /[0-9A-Fa-f]/,
};

// A bracket expression opening at i, read the way git's wildmatch reads it. Returns the index of
// its closing "]" and its token, or null when it never closes (then "[" is literal). Like git, a
// backwards range such as [z-a] matches only its first character, and it never spoils the other
// rules (a RegExp would throw on it and lose the whole file). An unknown [:name:] makes git drop
// the whole pattern: token null. Members are kept as written (git folds none of them); a range
// is marked so a lowercase letter can also try its uppercase form against it when folding.
function parseClass(glob, i, fold) {
  let j = i + 1;
  const neg = glob[j] === '!' || glob[j] === '^';
  if (neg) j++;
  const ranges = [];
  const classes = [];
  let prev = null;
  for (let first = true; ; first = false, j++) {
    if (j >= glob.length) return null;
    let c = glob[j];
    if (c === ']' && !first) break;
    if (c === '\\') {
      if (++j >= glob.length) return null;
      c = glob[j];
    } else if (c === '-' && prev !== null && j + 1 < glob.length && glob[j + 1] !== ']') {
      let hi = glob[++j];
      if (hi === '\\' && ++j >= glob.length) return null;
      hi = glob[j];
      ranges.push([prev, hi, true]);
      prev = null;
      continue;
    } else if (c === '[' && glob[j + 1] === ':') {
      const close = glob.indexOf(']', j + 2);
      if (close === -1) return null;
      if (close > j + 2 && glob[close - 1] === ':') {
        const name = glob.slice(j + 2, close - 1);
        if (!Object.hasOwn(CLASS_TESTS, name)) return { end: close, token: null };
        classes.push(name === 'upper' && fold ? /[A-Za-z]/ : CLASS_TESTS[name]);
        j = close;
        prev = null;
        continue;
      }
    }
    ranges.push([c, c, false]);
    prev = c;
  }
  return { end: j, token: { t: 'set', neg, ranges, classes, fold } };
}

// gitignore glob → tokens: "ch" one literal character, "any" (?), "set" ([...]), "star" (*, never
// crosses "/"), "dirs" (a whole "**/" segment: nothing, or anything ending in "/"), "rest" (a
// trailing "**": anything). null when the pattern can never match (an unknown [:class:]).
// fold is git's case folding: an unescaped ASCII letter is lowercased, an escaped one is not
// (so under folding git's "\A" matches nothing).
function globTokens(glob, fold) {
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
    } else if (c === '[') {
      const cls = parseClass(glob, i, fold);
      if (!cls) tokens.push({ t: 'ch', c });
      else if (!cls.token) return null;
      else {
        tokens.push(cls.token);
        i = cls.end;
      }
    } else if (c === '\\') {
      if (i + 1 < glob.length) tokens.push({ t: 'ch', c: glob[++i] });
    } else {
      tokens.push({ t: 'ch', c: fold && c >= 'A' && c <= 'Z' ? c.toLowerCase() : c });
    }
  }
  return tokens;
}

function matchesOne(tok, c) {
  if (tok.t === 'ch') return tok.c === c;
  if (c === '/') return false;
  if (tok.t === 'any') return true;
  // git: when folding, a lowercase letter outside a range also tries its uppercase form against
  // it ("[A-Z]", "[A-z]" takes "_", "[Z-a]" takes "z"); a single member is compared as written.
  const upper = tok.fold && c >= 'a' && c <= 'z' ? c.toUpperCase() : null;
  const hit = tok.ranges.some(([lo, hi, range]) => (c >= lo && c <= hi) || (range && upper !== null && upper >= lo && upper <= hi)) || tok.classes.some((re) => re.test(c));
  return hit !== tok.neg;
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

// git's trim_trailing_spaces: unescaped trailing spaces go, an escaped one ("\ ") stays, and a
// trailing tab is part of the pattern.
function trimTrailingSpaces(line) {
  let lastSpace = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ' ') {
      if (lastSpace === -1) lastSpace = i;
      continue;
    }
    if (line[i] === '\\' && ++i >= line.length) return line;
    lastSpace = -1;
  }
  return lastSpace === -1 ? line : line.slice(0, lastSpace);
}

// Git compares bytes, so "?" or "[éè]" takes one byte of a UTF-8 character: patterns and paths
// are matched as their UTF-8 bytes, one character per byte.
const ASCII_ONLY = /^[\x00-\x7f]*$/;
const asBytes = (s) => (ASCII_ONLY.test(s) ? s : Buffer.from(s, 'utf8').toString('latin1'));

// Lowercase, one character at a time, only where that gives one character of the same UTF-8
// length: no context rules (the Greek final sigma) and no İ → i̇, so "?" still takes the same bytes.
const foldCache = new Map();
function simpleFold(s) {
  if (ASCII_ONLY.test(s)) return s.toLowerCase();
  let out = '';
  for (const ch of s) {
    let folded = foldCache.get(ch);
    if (folded === undefined) {
      const lower = ch.toLowerCase();
      folded = lower !== ch && [...lower].length === 1 && Buffer.byteLength(lower) === Buffer.byteLength(ch) ? lower : ch;
      foldCache.set(ch, folded);
    }
    out += folded;
  }
  return out;
}

// A path in the two forms it is matched in. exact is what git compares: the name composed on a
// Mac (core.precomposeunicode), as stored elsewhere, with ASCII letters lowercased where git
// ignores case (git folds nothing else). loose is what the person means: composed everywhere (the
// Finder and Save dialogs store names decomposed on APFS while an editor types a pattern
// composed), every letter folded on a case-insensitive disk. Both forms keep each "/" where it is.
function pathKeys(rel, platform, ignoreCase) {
  if (ASCII_ONLY.test(rel)) {
    const key = ignoreCase ? rel.toLowerCase() : rel;
    return { exact: key, loose: key };
  }
  const composed = rel.normalize('NFC');
  const exact = asBytes(platform === 'darwin' ? composed : rel);
  return {
    exact: ignoreCase ? exact.replace(/[A-Z]+/g, (m) => m.toLowerCase()) : exact,
    loose: asBytes(ignoreCase ? simpleFold(composed) : composed),
  };
}

// Each rule gets an exact matcher (the pattern as git reads it, git's folding) and a loose one
// (the pattern composed and folded like a loose path); loose is exact when both read the same.
// Either is null when that reading can never match.
function compileIgnore(text, ignoreCase) {
  const rules = [];
  for (const raw of String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    let line = trimTrailingSpaces(raw);
    if (!line || line.startsWith('#')) continue;
    const negate = line.startsWith('!');
    if (negate) line = line.slice(1);
    // Git drops one trailing "/": "secret//" keeps a "/" and so matches nothing.
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);
    // An unpaired trailing backslash makes the pattern invalid: git ignores nothing with it.
    const backslashes = line.length - line.replace(/\\+$/, '').length;
    if (!line || backslashes % 2) continue;
    // A slash at the start or in the middle ties the pattern to the ignore file's folder. Without
    // one it is matched against the name alone, at any depth, as git does.
    const anchored = line.includes('/');
    line = line.replace(/^\//, '');
    const exactGlob = asBytes(line);
    const composed = line.normalize('NFC');
    const looseGlob = asBytes(ignoreCase ? simpleFold(composed) : composed);
    const exactTokens = globTokens(exactGlob, ignoreCase);
    const exact = exactTokens && matcher(exactTokens);
    const looseTokens = looseGlob === exactGlob ? null : globTokens(looseGlob, ignoreCase);
    const loose = looseGlob === exactGlob ? exact : looseTokens && matcher(looseTokens);
    if (exact || loose) rules.push({ exact, loose, nameOnly: !anchored, negate, dirOnly });
  }
  return rules;
}

// Most rules are plain text, or start, end or contain plain text ("/archive", "*.log", "*tmp*"),
// and a rule without * has one length: checking those first rules out most paths without walking
// them.
function matcher(tokens) {
  const runs = [''];
  for (const tok of tokens) {
    if (tok.t === 'ch') runs[runs.length - 1] += tok.c;
    else runs.push('');
  }
  if (runs.length === 1) return (s) => s === runs[0];
  const head = runs[0];
  const tail = runs[runs.length - 1];
  const inner = runs.slice(1, -1).filter(Boolean);
  const length = tokens.some((tok) => tok.t === 'star' || tok.t === 'dirs' || tok.t === 'rest') ? -1 : tokens.length;
  return (s) => (length === -1 || s.length === length) && s.startsWith(head) && s.endsWith(tail) && inner.every((run) => s.includes(run)) && globMatch(tokens, s);
}

// Git semantics: every rule that matches is applied in order, so the last match wins and a
// deeper ignore file overrides a shallower one. keys are pathKeys; set.skip drops the ignore
// file's own folder from each form. A rule that can't change the verdict is not tried.
// A rule that ignores matches either way, one that brings a path back ("!") only as git would:
// so a path git ignores is always ignored here too, and folding only ever ignores more.
function applyRules(ignored, set, keys, isDir) {
  if (!set) return ignored;
  const exact = set.skip ? keys.exact.slice(set.skip.exact) : keys.exact;
  const loose = set.skip ? keys.loose.slice(set.skip.loose) : keys.loose;
  const exactName = exact.slice(exact.lastIndexOf('/') + 1);
  const looseName = loose.slice(loose.lastIndexOf('/') + 1);
  for (const rule of set.rules) {
    if (ignored !== rule.negate || (rule.dirOnly && !isDir)) continue;
    const e = rule.nameOnly ? exactName : exact;
    const l = rule.nameOnly ? looseName : loose;
    const hit = (rule.exact && rule.exact(e)) || (!rule.negate && rule.loose && (l !== e || rule.loose !== rule.exact) && rule.loose(l));
    if (hit) ignored = !rule.negate;
  }
  return ignored;
}

// Windows PowerShell 5.1 writes "x" > .promptlyignore as UTF-16LE, and its UTF-8 adds a BOM.
function decodeIgnoreFile(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf.subarray(0, buf.length - (buf.length % 2))).swap16().toString('utf16le');
  return buf.toString('utf8');
}

// A UTF-16 text file is full of NUL bytes; its byte-order mark is what says it is text. Text
// never holds a NUL character, which rules out UTF-32 (FF FE 00 00) and binary data that merely
// starts with those two bytes.
function isUtf16Text(buf) {
  if (buf.length < 2 || !((buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff))) return false;
  for (let i = 2; i + 1 < buf.length; i += 2) if (buf[i] === 0 && buf[i + 1] === 0) return false;
  return true;
}

function direntType(e) {
  if (e.isSymbolicLink()) return 'link';
  if (e.isDirectory()) return 'dir';
  if (e.isFile()) return 'file';
  return null;
}

const statType = (st) => (st.isSymbolicLink() ? 'link' : st.isDirectory() ? 'dir' : st.isFile() ? 'file' : 'other');

// An .xcodeproj of unknown type (some network disks don't say) counts: it is almost always a folder.
function isCodeRoot(entries) {
  return entries.some((e) => CODE_ROOT_MARKERS.has(e.name) || (e.name.endsWith('.xcodeproj') && (e.isDirectory() || !direntType(e))));
}

// An ignore file that exists but can't be read: the folder it rules over isn't walked.
const UNREADABLE_RULES = Symbol('unreadable rules');

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

// maxFiles/maxEntries: a whole number ≥ 0, Infinity for no cap, anything else the default.
const capOption = (value, fallback) => (value === Infinity ? Infinity : Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback);

// Returns { files, folders, skipped, tooMany, unchecked, warnings }. unchecked lists what this
// scan could not look at, so a manifest diff keeps it rather than calling it removed: files and
// folders that failed to read (a lock, too many open files, an ignore file that couldn't be read,
// a folder swapped for a link to elsewhere) and, when the walk stopped at maxEntries, the entries
// it never reached (or their folder, past MAX_UNREACHED_LISTED in one folder). '' (the whole
// folder) alone when the signal stopped it or the connected folder itself couldn't be read or
// finished. skipped.truncated counts the entries it never reached; a folder it never opened
// counts once. warnings: [{ rel, reason }] for ignore files whose rules weren't applied.
async function scanFolder(dir, { maxFiles, maxEntries, signal, platform = process.platform, fsImpl = fs } = {}) {
  // An empty path would resolve to the app's working directory and scan that instead.
  if (typeof dir !== 'string' || !dir) throw new TypeError('scanFolder needs a folder path');
  // A missing method would otherwise surface as "the folder is unreadable".
  const fsp = fsImpl && fsImpl.promises;
  for (const name of FS_METHODS) if (!fsp || typeof fsp[name] !== 'function') throw new TypeError(`scanFolder needs fsImpl.promises.${name}`);
  const cap = capOption(maxFiles, MAX_FILES);
  const entryCap = capOption(maxEntries, MAX_ENTRIES);
  const root = path.resolve(dir);
  const readable = readableExtensions(platform);
  // Git matches ignore patterns case-insensitively on the case-insensitive Mac and Windows disks.
  const ignoreCase = platform === 'darwin' || platform === 'win32';
  const skipped = {};
  const buckets = new Map();
  const pending = [];
  const unchecked = [];
  const warnings = [];
  let visited = 0;
  let truncated = 0;
  let lastYield = Date.now();
  const aborted = () => Boolean(signal && signal.aborted);
  const mustStop = () => visited >= entryCap || aborted();

  const bucket = (top) => {
    if (!buckets.has(top)) buckets.set(top, { rel: top, count: 0, newestMs: null, codeRoot: false, skippedCount: 0, codeRoots: 0, candidates: 0 });
    return buckets.get(top);
  };
  // top: the top-level folder the thing sits in ('' = the folder's own files), or null for a
  // top-level folder skipped as a whole (node_modules, .git…), which gets no folders[] row.
  const skip = (reason, top) => {
    skipped[reason] = (skipped[reason] || 0) + 1;
    if (top !== null) bucket(top).skippedCount++;
  };
  const unreadable = (rel, top) => {
    skip('unreadable', top);
    unchecked.push(rel);
  };
  // The walk stopped (maxEntries) before count entries of the folder at rel; relAt(k) is the k-th.
  const notReached = (rel, count, relAt) => {
    truncated += count;
    if (count > MAX_UNREACHED_LISTED) unchecked.push(rel);
    else for (let k = 0; k < count; k++) unchecked.push(relAt(k));
  };

  // A listing's type for an entry, from lstat when the listing doesn't say. libuv's Windows
  // listing calls every reparse point a link, OneDrive's online-only files and folders included,
  // while its lstat calls only real symlinks and junctions links: there a link is confirmed.
  const needsLstat = (type) => !type || (type === 'link' && platform === 'win32');

  // The real path of abs and whether it is inside the connected folder. The native realpath
  // first, then Node's own (lstat + readlink) when that fails, as libuv's does on a Windows volume
  // without a drive letter. A real path is only compared with the root resolved the same way.
  const jsRealpath = typeof fsImpl.realpath === 'function' ? fsImpl.realpath : fs.realpath;
  const resolvers = [(p) => fsp.realpath(p), (p) => new Promise((resolve, reject) => jsRealpath(p, (err, real) => (err ? reject(err) : resolve(real))))];
  const realRoots = new Map();
  const locate = async (abs) => {
    let error;
    for (const resolve of resolvers) {
      try {
        const real = await resolve(abs);
        if (abs === root) {
          realRoots.set(resolve, real);
          return { real, inside: true };
        }
        if (!realRoots.has(resolve)) realRoots.set(resolve, await resolve(root));
        const base = realRoots.get(resolve);
        return { real, inside: real.startsWith(base.endsWith(path.sep) ? base : base + path.sep) };
      } catch (err) {
        error = err;
      }
    }
    throw error;
  };

  const warn = (rel, reason) => warnings.push({ rel, reason });
  // The rules in the folder's ignore file called name (any letter case where git ignores case: it
  // reads .GitIgnore there too), or null when it has none. A link is followed only to a file inside
  // the connected folder; one leading outside it or nowhere is left unread with a warning, so the
  // person can be told its rules weren't applied. Failing to read one that is there fails closed,
  // as UNREADABLE_RULES: walking on without it would read what the person asked to keep out.
  const readRules = async (entries, abs, rel, name) => {
    const e = entries.find((x) => x.name === name) || (ignoreCase ? entries.find((x) => x.name.toLowerCase() === name) : undefined);
    if (!e) return null;
    const file = path.join(abs, e.name);
    const fileRel = rel ? `${rel}/${e.name}` : e.name;
    try {
      let type = direntType(e);
      if (needsLstat(type)) type = statType(await fsp.lstat(file));
      let target = file;
      if (type === 'link') {
        const where = await locate(file).catch((err) => (err && err.code === 'ENOENT' ? null : Promise.reject(err)));
        if (where && !where.inside) {
          warn(fileRel, WARN_OUTSIDE);
          return null;
        }
        if (!where || statType(await fsp.lstat(where.real)) !== 'file') {
          // A link removed since the listing is simply not there.
          const there = where || (await fsp.lstat(file).then(() => true, (err) => !err || err.code !== 'ENOENT'));
          if (there) warn(fileRel, WARN_BROKEN);
          return null;
        }
        target = where.real;
        type = 'file';
      }
      if (type !== 'file') return null;
      const text = decodeIgnoreFile(await fsp.readFile(target, { flag: READ_NOFOLLOW }));
      const base = rel ? pathKeys(rel, platform, ignoreCase) : null;
      return { skip: base && { exact: base.exact.length + 1, loose: base.loose.length + 1 }, rules: compileIgnore(text, ignoreCase) };
    } catch (err) {
      if (err && err.code === 'ENOENT') return null;
      warn(fileRel, WARN_UNREADABLE);
      return UNREADABLE_RULES;
    }
  };
  // .promptlyignore (root only) is applied after every .gitignore, so it can also bring back a
  // git-ignored path. Set when the walk lists the root.
  let promptlyRules = null;
  const isIgnored = (sets, rel, isDir) => {
    if (!sets.length && !promptlyRules) return false;
    const keys = pathKeys(rel, platform, ignoreCase);
    const byGit = sets.reduce((acc, set) => applyRules(acc, set, keys, isDir), false);
    return applyRules(byGit, promptlyRules, keys, isDir);
  };

  const dirSkipReason = (name, rel, sets) => {
    if (BUILTIN_DIRS.has(name)) return 'builtin';
    if (isHidden(name)) return 'hidden';
    const ext = path.extname(name).toLowerCase();
    if (MEDIA_PACKAGES.has(ext)) return 'media';
    if (CODE_PACKAGES.has(ext)) return 'code';
    if (DOC_PACKAGES.has(ext)) return 'unsupported';
    if (isIgnored(sets, rel, true)) return 'ignored';
    return null;
  };

  const fileSkipReason = (name, ext) => {
    if (MEDIA.has(ext)) return 'media';
    if (CODE.has(ext) || CODE_NAMES.has(name.toLowerCase())) return 'code';
    if (!readable.has(ext)) return 'unsupported';
    return null;
  };

  async function walk(abs, rel, top, sets) {
    let entries;
    try {
      entries = await fsp.readdir(abs, { withFileTypes: true });
      // readdir follows a folder swapped for a symlink after its parent was listed (and so does
      // every path through it): what was read must still be inside the connected folder.
      if (!(await locate(abs)).inside) throw new Error('outside the folder');
      // The native realpath failed on the root: it will on every folder below it too.
      if (!rel && !realRoots.has(resolvers[0])) resolvers.shift();
    } catch {
      unreadable(rel, top);
      return;
    }
    // A code root is left out whole, as one item, without walking it: a cloned repo can hold
    // more entries than the walk budget. The connected folder itself is never a code root: the
    // person chose it, and a repo's README and docs are what a project mode is for. Its code
    // files are still skipped by type.
    if (rel && isCodeRoot(entries)) {
      skip('code-root', top);
      if (rel === top) bucket(top).codeRoot = true;
      else bucket(top).codeRoots++;
      return;
    }
    const gitRules = await readRules(entries, abs, rel, '.gitignore');
    const ownRules = rel ? null : await readRules(entries, abs, rel, '.promptlyignore');
    if (gitRules === UNREADABLE_RULES || ownRules === UNREADABLE_RULES) {
      unreadable(rel, top);
      return;
    }
    if (gitRules) sets = [...sets, gitRules];
    if (ownRules) promptlyRules = ownRules;

    const dirs = [];
    for (let i = 0; i < entries.length; i++) {
      if (mustStop()) {
        notReached(rel, entries.length - i, (k) => (rel ? `${rel}/${entries[i + k].name}` : entries[i + k].name));
        break;
      }
      visited++;
      if (Date.now() - lastYield >= YIELD_MS) {
        await new Promise((resolve) => setImmediate(resolve));
        lastYield = Date.now();
      }
      const e = entries[i];
      const name = e.name;
      const childAbs = path.join(abs, name);
      const childRel = rel ? `${rel}/${name}` : name;
      let type = direntType(e);
      if (needsLstat(type)) {
        try {
          type = statType(await fsp.lstat(childAbs));
        } catch {
          type = 'unreadable';
        }
      }
      if (type === 'dir') {
        const reason = dirSkipReason(name, childRel, sets);
        if (reason) skip(reason, rel ? top : null);
        else dirs.push([childAbs, childRel, rel ? top : name]);
        continue;
      }
      const fileTop = rel ? top : '';
      if (type === 'unreadable') unreadable(childRel, fileTop);
      else if (type === 'link') skip('symlink', fileTop);
      else if (type !== 'file') skip('unsupported', fileTop);
      else if (isHidden(name)) skip('hidden', fileTop);
      else if (isIgnored(sets, childRel, false)) skip('ignored', fileTop);
      else {
        const ext = path.extname(name).toLowerCase();
        const reason = fileSkipReason(name, ext);
        if (reason) skip(reason, fileTop);
        else pending.push({ abs: childAbs, rel: childRel, ext, top: fileTop });
      }
    }

    for (let d = 0; d < dirs.length; d++) {
      if (mustStop()) {
        notReached(rel, dirs.length - d, (k) => dirs[d + k][1]);
        break;
      }
      const [childAbs, childRel, childTop] = dirs[d];
      if (!rel) bucket(childTop);
      await walk(childAbs, childRel, childTop, sets);
    }
  }

  if (mustStop()) {
    truncated++;
    unchecked.push('');
  } else await walk(root, '', null, []);

  const stats = await mapLimit(pending, CONCURRENCY, (p) => (aborted() ? undefined : fsp.lstat(p.abs).catch(() => null)));
  const candidates = [];
  pending.forEach((p, i) => {
    const st = stats[i];
    if (st === undefined) truncated++;
    else if (!st) unreadable(p.rel, p.top);
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
      handle = await fsp.open(c.abs, READ_NOFOLLOW);
      const buf = Buffer.alloc(Math.min(PROBE_BYTES, c.size));
      const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
      const head = buf.subarray(0, bytesRead);
      if (UTF16_READABLE.has(c.ext) && isUtf16Text(head)) return null;
      return head.includes(0) ? 'binary' : null;
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
  while (next < candidates.length && files.length < cap && !aborted()) {
    const batch = candidates.slice(next, next + PROBE_BATCH);
    next += batch.length;
    const verdicts = await mapLimit(batch, CONCURRENCY, probe);
    batch.forEach((c, i) => {
      if (verdicts[i]) {
        if (verdicts[i] === 'unreadable') unreadable(c.rel, c.top);
        else skip(verdicts[i], c.top);
        bucket(c.top).candidates--;
      } else if (files.length < cap) files.push({ rel: c.rel, size: c.size, mtimeMs: c.mtimeMs, ext: c.ext, top: c.top });
      else tooMany++;
    });
  }
  if (files.length < cap) truncated += candidates.length - next;
  else tooMany += candidates.length - next;
  if (truncated) skipped.truncated = truncated;
  // Stopped by the signal, nothing this scan says is complete; '' already covers everything else.
  const keep = (truncated && aborted()) || unchecked.includes('') ? [''] : unchecked;

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
      // Also a code folder when it holds nothing readable besides code roots. Judged before the
      // maxFiles cap, so older documents dropped by the cap still count as documents.
      codeRoot: b.codeRoot || (b.candidates === 0 && b.codeRoots > 0),
      skippedCount: b.skippedCount,
    }))
    .sort((a, b) => (a.rel === '' ? -1 : b.rel === '' ? 1 : a.rel.localeCompare(b.rel, undefined, { numeric: true, sensitivity: 'base' })));

  return { files, folders, skipped, tooMany, unchecked: keep, warnings };
}

// Refuses a symlink: the scan never follows one, even a file swapped for one after it was listed.
function hashFile(abs) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    fs.createReadStream(abs, { flags: READ_NOFOLLOW })
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

// The file's absolute path, or null when rel would leave the scanned folder or isn't spelled the
// way a scan spells it ("./a.md", "a.md/" and "a//b.md" would be second names for a.md).
function insideFolder(root, rel) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) return null;
  if (rel.endsWith('/') || path.posix.normalize(rel) !== rel || (path.sep === '\\' && rel.includes('\\'))) return null;
  const abs = path.resolve(root, rel);
  return abs.startsWith(root.endsWith(path.sep) ? root : root + path.sep) ? abs : null;
}

// dir is the scanned folder: each file is hashed as hashFile(path.join(dir, rel), entry). A file
// that can't be hashed (gone or locked mid-scan) keeps its previous entry, or waits for the next
// scan if it is new; either way it is listed in failed, so a wrong dir can't pass for "no changes".
// keep is the scan's unchecked list: a previous entry at or under one of those paths ('' = all)
// is carried over and listed in failed instead of being called removed. A rel that would leave
// the folder is never hashed or kept, only listed in failed.
async function diffManifest(prev, files, { dir, hashFile: hash = hashFile, keep } = {}) {
  if (typeof dir !== 'string' || !dir) throw new TypeError('diffManifest needs the scanned folder as dir');
  if (typeof hash !== 'function') throw new TypeError('diffManifest needs hashFile to be a function');
  if (keep != null && !Array.isArray(keep)) throw new TypeError('diffManifest needs keep to be a list of paths');
  const root = path.resolve(dir);
  const before = prev && typeof prev === 'object' ? prev : {};
  const results = await mapLimit(files, 8, async (f) => {
    const abs = insideFolder(root, f.rel);
    if (!abs) return { state: 'outside', entry: null };
    const old = Object.hasOwn(before, f.rel) && before[f.rel] && typeof before[f.rel] === 'object' ? before[f.rel] : null;
    if (old && old.size === f.size && old.mtimeMs === f.mtimeMs) return { state: 'same', entry: { ...old } };
    let sha1;
    try {
      sha1 = await hash(abs, f);
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
    const r = results[i];
    if (r.state === 'failed' || r.state === 'outside') failed.push(f.rel);
    if (r.state === 'outside') return;
    seen.add(f.rel);
    if (r.entry) next[f.rel] = r.entry;
    if (r.state === 'added') added.push(f.rel);
    else if (r.state === 'changed') changed.push(f.rel);
  });
  const kept = new Set(keep || []);
  const isKept = (rel) => {
    if (kept.has('') || kept.has(rel)) return true;
    for (let i = rel.indexOf('/'); i !== -1; i = rel.indexOf('/', i + 1)) if (kept.has(rel.slice(0, i))) return true;
    return false;
  };
  const removed = [];
  for (const rel of Object.keys(before)) {
    if (seen.has(rel)) continue;
    if (isKept(rel) && insideFolder(root, rel) && before[rel] && typeof before[rel] === 'object') {
      next[rel] = { ...before[rel] };
      failed.push(rel);
    } else removed.push(rel);
  }
  return { added, changed, removed, next, failed };
}

module.exports = { scanFolder, readableExtensions, hashFile, diffManifest };
