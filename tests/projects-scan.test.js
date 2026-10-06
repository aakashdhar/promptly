import { describe, it, expect, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { scanFolder, readableExtensions, hashFile, diffManifest } = require('../main/projects/scan.js')

const roots = []
const MB = 1024 * 1024

// Builds a throwaway folder: keys ending in "/" are empty folders, values are file contents.
function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-scan-'))
  roots.push(root)
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, rel)
    if (rel.endsWith('/')) {
      fs.mkdirSync(abs, { recursive: true })
      continue
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, body)
  }
  return root
}

function touch(root, rel, seconds) {
  fs.utimesSync(path.join(root, rel), seconds, seconds)
}

const relsOf = (scan) => scan.files.map((f) => f.rel).sort()
const folderOf = (scan, rel) => scan.folders.find((f) => f.rel === rel)
const nfc = (rels) => rels.map((rel) => rel.normalize('NFC'))
const fail = (code, p) => Object.assign(new Error(`${code}: ${p}`), { code })

// A folder that exists only in readdir: a .gitignore plus the given file names, nothing on disk.
function fakeFolder(names, ignoreText = '') {
  const dirent = (name) => ({ name, isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false })
  return {
    promises: {
      ...fs.promises,
      readdir: async () => [dirent('.gitignore'), ...names.map(dirent)],
      readFile: async () => Buffer.from(ignoreText),
      realpath: async (p) => p,
    },
  }
}

// A folder that exists only in memory: an ignore file (named ignoreName) plus files that each hold
// "x", so which names a pattern leaves listed can be checked side by side, "Ax.md" beside "ax.md".
const FAKE_DIR = path.join(os.tmpdir(), 'promptly-memory')
function memoryFolder(names, ignoreText = '', ignoreName = '.gitignore') {
  const dirent = (name) => ({ name, isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false })
  const stat = { isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false, size: 1, mtimeMs: 1 }
  const handle = {
    read: async (buf) => {
      buf[0] = 0x78
      return { bytesRead: 1 }
    },
    close: async () => {},
  }
  return {
    promises: {
      readdir: async () => [dirent(ignoreName), ...names.map(dirent)],
      realpath: async (p) => p,
      lstat: async () => stat,
      readFile: async () => Buffer.from(ignoreText),
      open: async () => handle,
    },
  }
}
const keptBy = async (ignoreText, names, platform, ignoreName) => nfc(relsOf(await scanFolder(FAKE_DIR, { platform, fsImpl: memoryFolder(names, ignoreText, ignoreName) })))

// readdir as some network and FUSE disks answer it: no entry says what type it is.
const unknownTypes = {
  promises: {
    ...fs.promises,
    readdir: async (p, o) => (await fs.promises.readdir(p, o)).map((e) => ({ name: e.name, isFile: () => false, isDirectory: () => false, isSymbolicLink: () => false })),
  },
}

afterAll(() => {
  for (const root of roots) {
    try {
      fs.rmSync(root, { recursive: true, force: true })
    } catch {
      // best effort
    }
  }
})

describe('readable file types', () => {
  it('reads md, markdown, txt, eml, mbox, html and htm everywhere; docx, rtf and doc only on macOS', () => {
    const common = ['.md', '.markdown', '.txt', '.eml', '.mbox', '.html', '.htm']
    for (const platform of ['win32', 'linux']) {
      expect([...readableExtensions(platform)].sort()).toEqual([...common].sort())
    }
    expect([...readableExtensions('darwin')].sort()).toEqual([...common, '.docx', '.rtf', '.doc'].sort())
  })

  it('returns a fresh set each time, so a caller cannot change what the scanner reads', () => {
    readableExtensions('darwin').add('.pdf')
    expect(readableExtensions('darwin').has('.pdf')).toBe(false)
  })
})

describe('scanning a project folder (A2)', () => {
  function mixedProject() {
    const root = tree({
      'README.md': '# Acme',
      'brief.txt': 'Brief',
      'rootonly.md': 'anchored /rootonly.md ignores this one',
      '.DS_Store': 'x',
      '.gitignore': '# project rules\n\ndrafts/\n*.bak.md\n!important.bak.md\n/rootonly.md\n',
      '.promptlyignore': 'comms/archive/**\n',
      '.hidden-dir/a.md': 'x',
      'comms/2026-10-01 kickoff.eml': 'From: a@acme.com\n\nHi',
      'comms/export.mbox': 'From a@acme.com Mon Oct  6 10:00:00 2026\n\nHi',
      'comms/page.html': '<p>hi</p>',
      'comms/private/note.md': 'kept: notes/.gitignore does not reach comms/',
      'comms/archive/2019.eml': 'left out by .promptlyignore',
      'contracts/SOW.docx': Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x08, 0x00]),
      'contracts/terms.rtf': '{\\rtf1 hi}',
      'contracts/scope.pdf': '%PDF-1.4',
      'contracts/budget.xlsx': 'x',
      'notes/standup.md': 'Tenant ID by Friday',
      'notes/latin1.txt': Buffer.from([0x63, 0x61, 0x66, 0xe9]),
      'notes/important.bak.md': 'brought back by !important.bak.md',
      'notes/rootonly.md': 'kept: /rootonly.md only matches at the root',
      'notes/old.bak.md': 'ignored',
      'notes/empty.md': '',
      'notes/blob.txt': Buffer.from([0x68, 0x00, 0x69]),
      'notes/script.py': 'print(1)',
      'notes/config.json': '{}',
      'notes/.secret.md': 'hidden',
      'notes/.gitignore': 'private/\n',
      'notes/private/diary.md': 'ignored by the nested .gitignore',
      'drafts/wip.md': 'ignored folder',
      'big/huge.md': Buffer.alloc(3 * MB, 0x61),
      'assets/logo.png': 'png',
      'assets/diagram.svg': '<svg/>',
      'assets/bundle.zip': 'zip',
      'assets/clip.mp4': 'mp4',
      'node_modules/lib/index.js': '',
      'node_modules/lib/README.md': 'never listed',
      '.git/HEAD': 'ref: refs/heads/main',
      '_legacy/package.json': '{}',
      '_legacy/src/app.js': '',
      '_legacy/docs/README.md': 'legacy docs are code-root',
      '_legacy/node_modules/x/index.js': '',
    })
    fs.symlinkSync('../README.md', path.join(root, 'notes/link.md'))
    fs.symlinkSync(os.tmpdir(), path.join(root, 'elsewhere'))
    return root
  }

  it('lists only readable documents and counts every skip by reason', async () => {
    const root = mixedProject()
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(relsOf(scan)).toEqual([
      'README.md',
      'brief.txt',
      'comms/2026-10-01 kickoff.eml',
      'comms/export.mbox',
      'comms/page.html',
      'comms/private/note.md',
      'contracts/SOW.docx',
      'contracts/terms.rtf',
      'notes/important.bak.md',
      'notes/latin1.txt',
      'notes/rootonly.md',
      'notes/standup.md',
    ])
    expect(scan.skipped).toEqual({
      hidden: 6, // .DS_Store, .gitignore, .promptlyignore, .hidden-dir, notes/.secret.md, notes/.gitignore
      builtin: 2, // node_modules, .git
      ignored: 5, // drafts/, rootonly.md, notes/old.bak.md, notes/private/, comms/archive/2019.eml
      'too-big': 1,
      binary: 1,
      empty: 1,
      media: 4,
      code: 2,
      unsupported: 2,
      'code-root': 1, // _legacy, left out whole
      symlink: 2, // notes/link.md, elsewhere
    })
    expect(scan.tooMany).toBe(0)
  })

  it('describes each file by path, size, date, type and top-level folder', async () => {
    const root = mixedProject()
    touch(root, 'comms/export.mbox', 1_700_000_000)
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(scan.files.find((f) => f.rel === 'comms/export.mbox')).toEqual({
      rel: 'comms/export.mbox',
      size: fs.statSync(path.join(root, 'comms/export.mbox')).size,
      mtimeMs: 1_700_000_000_000,
      ext: '.mbox',
      top: 'comms',
    })
    expect(scan.files.find((f) => f.rel === 'README.md').top).toBe('')
    expect(scan.files.find((f) => f.rel === 'contracts/SOW.docx').ext).toBe('.docx')
  })

  it('reports one row per top-level folder plus the top-level files, with counts and newest date', async () => {
    const root = mixedProject()
    touch(root, 'comms/2026-10-01 kickoff.eml', 2_000_000_000)
    touch(root, 'comms/page.html', 1_700_000_000)
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(scan.folders[0].rel).toBe('')
    expect(scan.folders.map((f) => f.rel).sort()).toEqual(['', '_legacy', 'assets', 'big', 'comms', 'contracts', 'notes'])
    expect(folderOf(scan, '')).toMatchObject({ count: 2, codeRoot: false, skippedCount: 5 })
    expect(folderOf(scan, 'comms')).toMatchObject({ count: 4, newestMs: 2_000_000_000_000, codeRoot: false, skippedCount: 1 })
    expect(folderOf(scan, 'contracts')).toMatchObject({ count: 2, skippedCount: 2 })
    expect(folderOf(scan, 'notes')).toMatchObject({ count: 4, skippedCount: 9 })
    expect(folderOf(scan, 'assets')).toEqual({ rel: 'assets', count: 0, newestMs: null, codeRoot: false, skippedCount: 4 })
    expect(folderOf(scan, 'big')).toMatchObject({ count: 0, skippedCount: 1 })
    expect(folderOf(scan, '_legacy')).toEqual({ rel: '_legacy', count: 0, newestMs: null, codeRoot: true, skippedCount: 1 })
    // Skipped as a whole: no row of their own.
    for (const rel of ['node_modules', '.git', 'drafts', '.hidden-dir', 'elsewhere']) expect(folderOf(scan, rel)).toBeUndefined()
  })

  it('leaves the top-level files row out when no top-level file is readable', async () => {
    const root = tree({ '.DS_Store': 'x', 'scope.pdf': '%PDF', 'comms/a.eml': 'From: x\n\nhi' })
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(scan.folders.map((f) => f.rel)).toEqual(['comms'])
  })

  it('lists readable files newest first and keeps at most maxFiles, counting the rest as tooMany', async () => {
    const files = {}
    for (let i = 0; i < 10; i++) files[`notes/n${i}.md`] = `note ${i}`
    const root = tree(files)
    for (let i = 0; i < 10; i++) touch(root, `notes/n${i}.md`, 1_700_000_000 + i * 60)
    const scan = await scanFolder(root, { maxFiles: 4, platform: 'linux' })
    expect(scan.files.map((f) => f.rel)).toEqual(['notes/n9.md', 'notes/n8.md', 'notes/n7.md', 'notes/n6.md'])
    expect(scan.tooMany).toBe(6)
    expect(folderOf(scan, 'notes')).toMatchObject({ count: 4, newestMs: (1_700_000_000 + 9 * 60) * 1000 })
  })

  it('does not count binary files towards the cap', async () => {
    const root = tree({ 'a.txt': Buffer.from([0x61, 0x00]), 'b.md': 'b', 'c.md': 'c' })
    touch(root, 'a.txt', 1_900_000_000)
    const scan = await scanFolder(root, { maxFiles: 2, platform: 'linux' })
    expect(relsOf(scan)).toEqual(['b.md', 'c.md'])
    expect(scan.skipped.binary).toBe(1)
    expect(scan.tooMany).toBe(0)
  })

  it('reads an empty folder as nothing, without errors', async () => {
    const scan = await scanFolder(tree({ 'empty/': '' }), { platform: 'darwin' })
    expect(scan.files).toEqual([])
    expect(scan.tooMany).toBe(0)
    expect(scan.folders).toEqual([{ rel: 'empty', count: 0, newestMs: null, codeRoot: false, skippedCount: 0 }])
  })

  it('uses the 5,000 cap when maxFiles is missing, negative or not a number, and no cap for Infinity', async () => {
    const root = tree({ 'a.md': 'a', 'b.md': 'b' })
    for (const maxFiles of [undefined, null, NaN, 'ten', -3, -Infinity]) {
      const scan = await scanFolder(root, { maxFiles, platform: 'linux' })
      expect(relsOf(scan)).toEqual(['a.md', 'b.md'])
      expect(scan.tooMany).toBe(0)
    }
    expect((await scanFolder(root, { maxFiles: 0, platform: 'linux' })).tooMany).toBe(2)
    expect((await scanFolder(root, { maxFiles: 1.9, platform: 'linux' })).tooMany).toBe(1)
  })

  it('keeps every readable file when maxFiles is Infinity, as maxEntries does', async () => {
    const names = Array.from({ length: 5_003 }, (_, i) => `n${i}.md`)
    const scan = await scanFolder(path.join(os.tmpdir(), 'promptly-fake'), { maxFiles: Infinity, platform: 'linux', fsImpl: memoryFolder(names) })
    expect(scan.files).toHaveLength(5_003)
    expect(scan.tooMany).toBe(0)
  })

  it('refuses an empty or missing folder path instead of scanning the working directory', async () => {
    for (const dir of ['', undefined, null, 42]) {
      await expect(scanFolder(dir, { platform: 'linux' })).rejects.toThrow(TypeError)
    }
  })
})

describe('file types and sizes', () => {
  it('skips files over 2 MB but keeps one of exactly 2 MB', async () => {
    const root = tree({ 'exact.txt': Buffer.alloc(2 * MB, 0x61), 'over.txt': Buffer.alloc(2 * MB + 1, 0x61) })
    const scan = await scanFolder(root, { platform: 'linux' })
    expect(relsOf(scan)).toEqual(['exact.txt'])
    expect(scan.skipped).toEqual({ 'too-big': 1 })
  })

  it('finds a NUL byte only within the first 8 KB', async () => {
    const late = Buffer.alloc(9000, 0x61)
    late[8500] = 0
    const early = Buffer.alloc(9000, 0x61)
    early[8000] = 0
    const scan = await scanFolder(tree({ 'late.txt': late, 'early.txt': early }), { platform: 'linux' })
    expect(relsOf(scan)).toEqual(['late.txt'])
    expect(scan.skipped).toEqual({ binary: 1 })
  })

  it('reads UTF-16 text (Notepad "Unicode", PowerShell >) by its byte-order mark instead of calling it binary', async () => {
    const le = Buffer.from('\ufeffMeeting notes: tenant ID by Friday\r\n', 'utf16le')
    const be = Buffer.from(le).swap16()
    const root = tree({ 'notepad-unicode.txt': le, 'ps-out.md': le, 'page.html': le, 'old.htm': be, 'big-endian.txt': be, 'blob.txt': Buffer.from([0x68, 0x00, 0x69]) })
    const scan = await scanFolder(root, { platform: 'win32' })
    expect(relsOf(scan)).toEqual(['big-endian.txt', 'notepad-unicode.txt', 'old.htm', 'page.html', 'ps-out.md'])
    expect(scan.skipped).toEqual({ binary: 1 })
  })

  it('lets a byte-order mark vouch only for types that are decoded from UTF-16 (not mail, not rtf, not UTF-32 or binary)', async () => {
    const le = Buffer.from('\ufeffFrom: Ann <ann@acme.com>\r\nSubject: Kickoff\r\n\r\nHi\r\n', 'utf16le')
    const root = tree({
      // The mail parsers read raw bytes and textutil refuses UTF-16 RTF: listing these would index garbage.
      'mail.eml': le, 'export.mbox': le, 'terms.rtf': Buffer.from('\ufeff{\\rtf1 hi}', 'utf16le'),
      'utf32.txt': Buffer.from([0xff, 0xfe, 0x00, 0x00, 0x68, 0x00, 0x00, 0x00, 0x69, 0x00, 0x00, 0x00]),
      'looks-like-bom.md': Buffer.from([0xfe, 0xff, 0x00, 0x41, 0x00, 0x00, 0x13, 0x37]),
      'real.txt': Buffer.from('\ufeffhi', 'utf16le'),
    })
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(relsOf(scan)).toEqual(['real.txt'])
    expect(scan.skipped).toEqual({ binary: 5 })
  })

  it('never probes .docx and .doc for NUL bytes (they are binary containers textutil reads)', async () => {
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00])
    const scan = await scanFolder(tree({ 'a.docx': zip, 'b.doc': zip, 'c.rtf': Buffer.from([0x7b, 0x00]) }), { platform: 'darwin' })
    expect(relsOf(scan)).toEqual(['a.docx', 'b.doc'])
    expect(scan.skipped).toEqual({ binary: 1 })
  })

  it('treats docx, rtf and doc as unsupported off macOS, and still reads html there', async () => {
    const root = tree({ 'a.docx': 'x', 'b.rtf': 'x', 'c.doc': 'x', 'd.html': '<p>x</p>', 'e.htm': '<p>x</p>' })
    for (const platform of ['win32', 'linux']) {
      const scan = await scanFolder(root, { platform })
      expect(relsOf(scan)).toEqual(['d.html', 'e.htm'])
      expect(scan.skipped).toEqual({ unsupported: 3 })
    }
  })

  it('sorts media, code and other documents into their own reasons, by extension in any case', async () => {
    const root = tree({
      'photo.JPG': 'x', 'voice.m4a': 'x', 'demo.mov': 'x', 'logo.svg': 'x', 'backup.tar.gz': 'x', 'setup.exe': 'x', 'App.dmg': 'x',
      'app.ts': 'x', 'view.tsx': 'x', 'main.go': 'x', 'lib.rs': 'x', 'conf.yaml': 'x', 'data.json': 'x', 'yarn.lock': 'x', 'run.sh': 'x', 'q.sql': 'x', 'Makefile': 'x', 'Dockerfile': 'x',
      'scope.pdf': 'x', 'budget.xlsx': 'x', 'deck.pptx': 'x', 'talk.key': 'x', 'sheet.numbers': 'x', 'doc.pages': 'x', 'mail.msg': 'x', 'LICENSE': 'x',
      'NOTES.MD': 'x',
    })
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(scan.files.map((f) => [f.rel, f.ext])).toEqual([['NOTES.MD', '.md']])
    expect(scan.skipped).toEqual({ media: 7, code: 11, unsupported: 8 })
  })

  it('skips Office lock files and app, library and document packages as one item each', async () => {
    const root = tree({
      '~$Report.docx': 'lock',
      'Report.docx': 'real',
      'Tool.app/Contents/Resources/help.html': '<p>help</p>',
      'Photos Library.photoslibrary/database/notes.txt': 'x',
      'Old.pages/index.html': '<p>x</p>',
      'Thing.xcworkspace/contents.xcworkspacedata': 'x',
    })
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(relsOf(scan)).toEqual(['Report.docx'])
    expect(scan.skipped).toEqual({ hidden: 1, media: 2, unsupported: 1, code: 1 })
  })
})

describe('built-in skips, hidden files and symlinks', () => {
  it('skips every built-in tool folder, at any depth, without walking it', async () => {
    const names = ['.git', 'node_modules', 'dist', 'build', 'vendor', 'venv', '.venv', '__pycache__', '.next', '.cache', 'target', 'coverage']
    const files = { 'docs/kept.md': 'kept' }
    for (const name of names) {
      files[`${name}/a.md`] = 'x'
      files[`${name}/deep/b.md`] = 'x'
      files[`docs/${name}/c.md`] = 'x'
    }
    const scan = await scanFolder(tree(files), { platform: 'linux' })
    expect(relsOf(scan)).toEqual(['docs/kept.md'])
    expect(scan.skipped).toEqual({ builtin: names.length * 2 })
    expect(scan.folders.map((f) => f.rel)).toEqual(['docs'])
  })

  it('matches built-in names by their lowercase spelling: a person’s "Build" or "Vendor" folder is kept', async () => {
    const scan = await scanFolder(tree({ 'Build/how-it-is-built.md': 'x', 'Vendor/contract.md': 'x' }), { platform: 'darwin' })
    expect(relsOf(scan)).toEqual(['Build/how-it-is-built.md', 'Vendor/contract.md'])
  })

  it('skips hidden files and folders at any depth', async () => {
    const root = tree({ '.env.md': 'x', 'a/.notes.md': 'x', 'a/.drafts/b.md': 'x', 'a/c.md': 'kept' })
    const scan = await scanFolder(root, { platform: 'linux' })
    expect(relsOf(scan)).toEqual(['a/c.md'])
    expect(scan.skipped).toEqual({ hidden: 3 })
  })

  it('never follows a symlink, inside or outside the folder', async () => {
    const outside = tree({ 'secret.md': 'outside the project' })
    const root = tree({ 'docs/real.md': 'inside' })
    fs.symlinkSync(path.join(outside, 'secret.md'), path.join(root, 'docs/secret.md'))
    fs.symlinkSync(outside, path.join(root, 'docs/outside'))
    fs.symlinkSync(path.join(root, 'docs'), path.join(root, 'loop'))
    fs.symlinkSync('real.md', path.join(root, 'docs/alias.md'))
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(relsOf(scan)).toEqual(['docs/real.md'])
    expect(scan.skipped).toEqual({ symlink: 4 })
  })

  it('on Windows, reads what a listing calls a link when lstat says it is not one (OneDrive online-only files)', async () => {
    const root = tree({ 'cloud.md': 'kept', 'docs/plan.md': 'kept', 'real.md': 'kept', '.gitignore': 'secret.md\n', 'secret.md': 'x' })
    fs.symlinkSync('real.md', path.join(root, 'link.md'))
    // libuv lists every reparse point as a link; its lstat reports a placeholder as what it is.
    const reparse = new Set(['cloud.md', 'docs', '.gitignore'])
    const asListed = (e) => (reparse.has(e.name) ? { name: e.name, isFile: () => false, isDirectory: () => false, isSymbolicLink: () => true } : e)
    const fsImpl = { promises: { ...fs.promises, readdir: async (p, o) => (await fs.promises.readdir(p, o)).map(asListed) } }
    const win = await scanFolder(root, { platform: 'win32', fsImpl })
    expect(relsOf(win)).toEqual(['cloud.md', 'docs/plan.md', 'real.md'])
    expect(win.skipped).toEqual({ symlink: 1, hidden: 1, ignored: 1 })
    // Elsewhere a listing's link is taken at its word (the .gitignore is still read: it stays inside).
    const mac = await scanFolder(root, { platform: 'darwin', fsImpl })
    expect(relsOf(mac)).toEqual(['real.md'])
    expect(mac.skipped).toEqual({ symlink: 4, ignored: 1 })
  })

  it.skipIf(process.platform === 'win32')('never reads a file swapped for a symlink after it was listed', async () => {
    const outside = tree({ 'secret.md': 'outside the project' })
    const root = tree({ 'real.md': 'inside' })
    fs.symlinkSync(path.join(outside, 'secret.md'), path.join(root, 'swapped.md'))
    // readdir and lstat saw a plain file; by the time it is opened it is a symlink.
    const fsImpl = {
      promises: {
        ...fs.promises,
        readdir: async (p, o) => (await fs.promises.readdir(p, o)).map((e) => (e.name === 'swapped.md' ? { name: e.name, isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false } : e)),
        lstat: async (p) => (p.endsWith('swapped.md') ? fs.promises.stat(p) : fs.promises.lstat(p)),
      },
    }
    const scan = await scanFolder(root, { platform: 'darwin', fsImpl })
    expect(relsOf(scan)).toEqual(['real.md'])
    expect(scan.skipped).toEqual({ unreadable: 1 })
    expect(scan.unchecked).toEqual(['swapped.md'])
  })

  it.skipIf(process.platform === 'win32')('never lists a folder swapped for a symlink after its parent was listed', async () => {
    const outside = tree({ 'secret.md': 'outside the project', 'deeper/pay.md': 'outside too' })
    const root = tree({ 'ok.md': 'kept', 'sub/a.md': 'inside' })
    const sub = path.join(root, 'sub')
    const fsImpl = {
      promises: {
        ...fs.promises,
        // The parent listing saw a real folder; by the time it is read it is a link to elsewhere.
        readdir: async (p, o) => {
          if (p === sub && !fs.lstatSync(sub).isSymbolicLink()) {
            fs.renameSync(sub, `${sub}-moved`)
            fs.symlinkSync(outside, sub)
          }
          return fs.promises.readdir(p, o)
        },
      },
    }
    const scan = await scanFolder(root, { platform: 'darwin', fsImpl })
    expect(relsOf(scan)).toEqual(['ok.md'])
    expect(scan.skipped).toEqual({ unreadable: 1 })
    expect(scan.unchecked).toEqual(['sub'])
  })

  it('never reads an ignore file through a symlink leading outside the folder, and says its rules were not applied', async () => {
    const outside = tree({ rules: '*.md\n' })
    const root = tree({ 'a.md': 'kept', 'sub/b.md': 'kept' })
    fs.symlinkSync(path.join(outside, 'rules'), path.join(root, '.promptlyignore'))
    fs.symlinkSync(path.join(outside, 'rules'), path.join(root, 'sub/.gitignore'))
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(relsOf(scan)).toEqual(['a.md', 'sub/b.md'])
    expect(scan.warnings).toEqual([
      { rel: '.promptlyignore', reason: 'ignore file links outside the folder' },
      { rel: 'sub/.gitignore', reason: 'ignore file links outside the folder' },
    ])
    expect(scan.unchecked).toEqual([])
  })

  it('applies an ignore file linked to a rules file inside the folder (a shared rules file)', async () => {
    const root = tree({
      'config/promptly-rules.txt': 'HR/\nsalaries.md\n',
      'config/sub-rules': 'draft.md\n',
      'ok.md': 'kept', 'salaries.md': 'x', 'HR/review.md': 'x', 'sub/draft.md': 'x', 'sub/kept.md': 'kept',
    })
    fs.symlinkSync('config/promptly-rules.txt', path.join(root, '.promptlyignore'))
    fs.symlinkSync('../config/sub-rules', path.join(root, 'sub/.gitignore'))
    for (const platform of ['darwin', 'linux', 'win32']) {
      const scan = await scanFolder(root, { platform })
      expect(relsOf(scan)).toEqual(['config/promptly-rules.txt', 'ok.md', 'sub/kept.md'])
      expect(scan.warnings).toEqual([])
      expect(scan.skipped).toMatchObject({ ignored: 3, symlink: 2 })
    }
  })

  it('follows an ignore file link through other links only while it stays inside the folder', async () => {
    const outside = tree({ rules: '*.md\n' })
    const root = tree({ 'rules/real': 'secret.md\n', 'ok.md': 'kept', 'secret.md': 'x' })
    fs.symlinkSync('rules', path.join(root, 'alias'))
    fs.symlinkSync('alias/real', path.join(root, '.promptlyignore'))
    const inside = await scanFolder(root, { platform: 'darwin' })
    expect(relsOf(inside)).toEqual(['ok.md'])
    expect(inside.skipped).toMatchObject({ ignored: 1 })
    expect(inside.warnings).toEqual([])
    const away = tree({ 'ok.md': 'kept' })
    fs.symlinkSync(outside, path.join(away, 'alias'))
    fs.symlinkSync('alias/rules', path.join(away, '.gitignore'))
    const scan = await scanFolder(away, { platform: 'darwin' })
    expect(relsOf(scan)).toEqual(['ok.md'])
    expect(scan.warnings).toEqual([{ rel: '.gitignore', reason: 'ignore file links outside the folder' }])
  })

  it('warns about an ignore file link that leads nowhere or to a folder, and fails closed on a link loop', async () => {
    const root = tree({ 'ok.md': 'kept', 'config/': '', 'sub/a.md': 'x', 'other/b.md': 'kept' })
    fs.symlinkSync('missing-rules.txt', path.join(root, '.promptlyignore'))
    fs.symlinkSync('config', path.join(root, '.gitignore'))
    fs.symlinkSync('.gitignore', path.join(root, 'sub/.gitignore'))
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(relsOf(scan)).toEqual(['ok.md', 'other/b.md'])
    expect(scan.unchecked).toEqual(['sub'])
    expect(scan.warnings).toEqual([
      { rel: '.gitignore', reason: 'ignore file link is broken' },
      { rel: '.promptlyignore', reason: 'ignore file link is broken' },
      { rel: 'sub/.gitignore', reason: "ignore file can't be read" },
    ])
  })
})

describe('.gitignore and .promptlyignore', () => {
  const scanWith = async (files, platform = 'linux') => relsOf(await scanFolder(tree(files), { platform }))

  it('ignores comments and blank lines, and trims trailing spaces', async () => {
    expect(await scanWith({ '.gitignore': '# *.md\n\n   \nspaced.md   \n', 'a.md': 'x', 'spaced.md': 'x' })).toEqual(['a.md'])
  })

  it('supports *, ?, character classes, ranges, negated classes and escapes', async () => {
    const files = {
      '.gitignore': 'draft-?.md\nnote[0-9].md\nfile[!a].md\nv[ab].md\n\\#hash.md\n\\!bang.md\nwip*\n',
      'draft-1.md': 'x', 'draft-10.md': 'kept', 'note5.md': 'x', 'notex.md': 'kept', 'fileb.md': 'x', 'filea.md': 'kept',
      'va.md': 'x', 'vc.md': 'kept', '#hash.md': 'x', '!bang.md': 'x', 'wip-plan.md': 'x', 'sub/wip.txt': 'x', 'plain.md': 'kept',
    }
    expect(await scanWith(files)).toEqual(['draft-10.md', 'filea.md', 'notex.md', 'plain.md', 'vc.md'])
  })

  it('a * never crosses a folder boundary', async () => {
    expect(await scanWith({ '.gitignore': 'docs/*.md\n', 'docs/a.md': 'x', 'docs/deep/b.md': 'kept' })).toEqual(['docs/deep/b.md'])
  })

  it('supports ** at the start, in the middle and at the end', async () => {
    const files = {
      '.gitignore': '**/tmp/\nlogs/**\ndocs/**/old.md\n',
      'tmp/a.md': 'x', 'a/b/tmp/c.md': 'x', 'keep/tmp.md': 'kept (tmp/ is a folder rule)',
      'logs/l.md': 'x', 'logs/deep/m.md': 'x',
      'docs/old.md': 'x', 'docs/a/b/old.md': 'x', 'docs/new.md': 'kept',
    }
    expect(await scanWith(files)).toEqual(['docs/new.md', 'keep/tmp.md'])
  })

  it('a trailing / matches folders only', async () => {
    expect(await scanWith({ '.gitignore': 'old.md/\n', 'a/old.md/inside.md': 'x', 'b/old.md': 'kept' })).toEqual(['b/old.md'])
  })

  it('a leading or middle / anchors the pattern to the ignore file’s folder', async () => {
    const files = { '.gitignore': '/top.md\nsub/deep.md\n', 'top.md': 'x', 'x/top.md': 'kept', 'sub/deep.md': 'x', 'x/sub/deep.md': 'kept' }
    expect(await scanWith(files)).toEqual(['x/sub/deep.md', 'x/top.md'])
  })

  it('a pattern without / matches at any depth', async () => {
    expect(await scanWith({ '.gitignore': 'scratch.md\n', 'scratch.md': 'x', 'a/b/scratch.md': 'x', 'a/kept.md': 'kept' })).toEqual(['a/kept.md'])
  })

  it('! brings a file back, the last matching rule wins, and nothing comes back from an ignored folder', async () => {
    const files = {
      '.gitignore': '*.md\n!keep.md\nsecret/\n!secret/ok.md\nlater.txt\n!later.txt\nlater.txt\n',
      'a.md': 'x', 'keep.md': 'kept', 'x/keep.md': 'kept', 'secret/ok.md': 'x', 'later.txt': 'x', 'note.txt': 'kept',
    }
    expect(await scanWith(files)).toEqual(['keep.md', 'note.txt', 'x/keep.md'])
  })

  it('a nested .gitignore applies to its own subtree only and overrides the root one', async () => {
    const files = {
      '.gitignore': '*.txt\n',
      'sub/.gitignore': '!keep.txt\nlocal.md\n',
      'sub/keep.txt': 'kept', 'other/keep.txt': 'x',
      'sub/local.md': 'x', 'sub/x/local.md': 'x', 'local.md': 'kept', 'other/local.md': 'kept',
    }
    expect(await scanWith(files)).toEqual(['local.md', 'other/local.md', 'sub/keep.txt'])
  })

  it('.promptlyignore at the root applies after .gitignore and can bring back a git-ignored folder', async () => {
    const files = {
      '.gitignore': 'exports/\n',
      '.promptlyignore': 'clients/*/private/\n!exports/\n',
      'exports/mail.eml': 'From: a\n\nhi',
      'clients/acme/private/pay.md': 'x', 'clients/acme/brief.md': 'kept',
      'sub/.promptlyignore': '*.md\n', 'sub/a.md': 'kept: only the root .promptlyignore counts',
    }
    expect(await scanWith(files)).toEqual(['clients/acme/brief.md', 'exports/mail.eml', 'sub/a.md'])
  })

  it('counts an ignored folder once and ignored files one by one', async () => {
    const scan = await scanFolder(tree({ '.gitignore': 'drafts/\n*.log.md\n', 'drafts/a.md': 'x', 'drafts/b.md': 'x', 'a.log.md': 'x', 'b/c.log.md': 'x' }), { platform: 'linux' })
    expect(scan.skipped).toEqual({ hidden: 1, ignored: 3 })
  })

  it('matches without case on macOS and Windows, with case elsewhere', async () => {
    const files = { '.gitignore': 'Drafts/\n', 'drafts/a.md': 'x', 'notes.md': 'kept' }
    expect(await scanWith(files, 'darwin')).toEqual(['notes.md'])
    expect(await scanWith(files, 'win32')).toEqual(['notes.md'])
    expect(await scanWith(files, 'linux')).toEqual(['drafts/a.md', 'notes.md'])
  })

  // Every verdict below was checked against git 2.50 (core.ignorecase=true, git check-ignore).
  it('folds case inside ranges the way git does, so a range never ignores less than in git', async () => {
    for (const platform of ['darwin', 'win32']) {
      expect(await keptBy('[A-z]*.md\n', ['_notes.md', 'Bx.md', 'bx.md', '1x.md'], platform)).toEqual(['1x.md'])
      expect(await keptBy('[Z-a]x.md\n', ['_x.md', 'ax.md', 'Ax.md', 'zx.md', 'Zx.md', 'bx.md'], platform)).toEqual(['bx.md'])
      expect(await keptBy('[a-c]y.md\n[X-Z]w.md\n', ['By.md', 'by.md', 'dy.md', 'xw.md', 'Xw.md', 'aw.md'], platform)).toEqual(['aw.md', 'dy.md'])
    }
    expect(await keptBy('[A-z]*.md\n', ['_notes.md', 'Bx.md', 'bx.md', '1x.md'], 'linux')).toEqual(['1x.md'])
    expect(await keptBy('[a-c]y.md\n', ['By.md', 'by.md'], 'linux')).toEqual(['By.md'])
  })

  it('never folds a name in a way that changes its bytes or depends on its neighbours', async () => {
    for (const platform of ['darwin', 'win32']) {
      // A final Σ lowercases to ς inside a word, but the pattern and the name are the same bytes.
      expect(await keptBy('ΟΔΟΣ*\n', ['ΟΔΟΣ.md', 'οδοσ.md', 'οδος.md'], platform)).toEqual(['οδος.md'])
      // İ is two UTF-8 bytes and its lowercase i̇ three: ?? still takes it, as in git.
      expect(await keptBy('??.md\n', ['İ.md', 'i.md', 'ab.md'], platform)).toEqual(['i.md'])
    }
  })

  it('also ignores a name the way the person meant it on a case-insensitive disk, but brings one back only as git would', async () => {
    for (const platform of ['darwin', 'win32']) {
      // git matches nothing with "[A]" or "\B" when folding, and never folds É: these ignore more than git.
      expect(await keptBy('[A]x.md\n\\Bq.md\nÉté.md\n', ['Ax.md', 'ax.md', 'Bq.md', 'bq.md', 'été.md', 'ÉTÉ.md', 'other.md'], platform)).toEqual(['other.md'])
      // A "!" rule brings back only what it brings back in git.
      expect(await keptBy('*.md\n![A]x.md\n!\\Bq.md\n!Été.md\n', ['Ax.md', 'Bq.md', 'été.md', 'Été.md'], platform)).toEqual(['Été.md'])
    }
  })

  it('finds .GitIgnore and .PromptlyIgnore in any letter case where git ignores case', async () => {
    for (const platform of ['darwin', 'win32']) {
      expect(await keptBy('secret.md\n', ['secret.md', 'ok.md'], platform, '.GitIgnore')).toEqual(['ok.md'])
      expect(await keptBy('secret.md\n', ['secret.md', 'ok.md'], platform, '.PromptlyIgnore')).toEqual(['ok.md'])
    }
    expect(await keptBy('secret.md\n', ['secret.md', 'ok.md'], 'linux', '.GitIgnore')).toEqual(['ok.md', 'secret.md'])
  })

  it('prefers the exactly named ignore file when another spelling sits beside it', async () => {
    const dirent = (name) => ({ name, isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false })
    const base = memoryFolder(['a.md', 'b.md'])
    const fsImpl = {
      promises: {
        ...base.promises,
        readdir: async () => ['.GITIGNORE', '.gitignore', 'a.md', 'b.md'].map(dirent),
        readFile: async (p) => Buffer.from(path.basename(p) === '.gitignore' ? 'a.md\n' : 'b.md\n'),
      },
    }
    expect(relsOf(await scanFolder(FAKE_DIR, { platform: 'darwin', fsImpl }))).toEqual(['b.md'])
  })

  it('reads ignore files with Windows line endings', async () => {
    expect(await scanWith({ '.gitignore': 'a.md\r\nb.md\r\n', 'a.md': 'x', 'b.md': 'x', 'c.md': 'kept' })).toEqual(['c.md'])
  })

  it('a backwards range like [z-a] spoils neither its file nor the other rules', async () => {
    const files = {
      '.gitignore': 'private/\nsecret.md\n[z-a].md\nx[a-Z]y.md\n',
      '.promptlyignore': '[9-0].md\nhidden-plan.md\n',
      'private/pay.md': 'x', 'secret.md': 'x', 'hidden-plan.md': 'x', 'notes.md': 'kept',
      // Like git, a backwards range still matches its first character.
      'z.md': 'x', 'b.md': 'kept', '9.md': 'x', '5.md': 'kept', 'xay.md': 'x', 'xby.md': 'kept',
    }
    expect(await scanWith(files)).toEqual(['5.md', 'b.md', 'notes.md', 'xby.md'])
  })

  it('reads ignore files saved with a UTF-8 byte-order mark', async () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf])
    const files = {
      '.promptlyignore': Buffer.concat([bom, Buffer.from('private/\r\nsecret.md\r\n')]),
      'sub/.gitignore': Buffer.concat([bom, Buffer.from('draft.md\n')]),
      'private/pay.md': 'x', 'secret.md': 'x', 'sub/draft.md': 'x', 'sub/kept.md': 'kept',
    }
    expect(await scanWith(files, 'win32')).toEqual(['sub/kept.md'])
  })

  it('reads a UTF-16 ignore file, as Windows PowerShell writes with "x" > .promptlyignore', async () => {
    const files = {
      '.promptlyignore': Buffer.from('\ufeffprivate/\r\nsecret.md\r\n', 'utf16le'),
      'private/pay.md': 'x', 'secret.md': 'x', 'kept.md': 'kept',
    }
    expect(await scanWith(files, 'win32')).toEqual(['kept.md'])
  })

  it('keeps a trailing tab as part of the pattern, like git (only trailing spaces are dropped)', async () => {
    const files = { '.gitignore': 'tabbed.md\t\nspaced.md  \n', 'tabbed.md': 'kept', 'spaced.md': 'x' }
    expect(await scanWith(files)).toEqual(['tabbed.md'])
  })

  it('reads a UTF-16 big-endian ignore file', async () => {
    const files = {
      '.promptlyignore': Buffer.from('\ufeffprivate/\r\nsecret.md\r\n', 'utf16le').swap16(),
      'private/pay.md': 'x', 'secret.md': 'x', 'kept.md': 'kept',
    }
    expect(await scanWith(files, 'win32')).toEqual(['kept.md'])
  })

  it('matches a composed pattern against a decomposed name, as Finder and Save dialogs store them, and the reverse', async () => {
    const composed = 'R\u00e9sum\u00e9 private'
    const decomposed = 'Re\u0301sume\u0301 private'
    for (const platform of ['darwin', 'linux']) {
      expect(nfc(await scanWith({ '.gitignore': `${composed}/\n`, [`${decomposed}/salary.md`]: 'x', 'other.md': 'kept' }, platform))).toEqual(['other.md'])
      expect(nfc(await scanWith({ '.gitignore': `${decomposed}/\n`, [`${composed}/salary.md`]: 'x', 'other.md': 'kept' }, platform))).toEqual(['other.md'])
    }
  })

  it('applies anchored and nested rules through a decomposed folder name', async () => {
    const files = {
      '.gitignore': 'Caf\u00e9/drafts/\n',
      'Cafe\u0301/drafts/a.md': 'x', 'Cafe\u0301/notes/.gitignore': '/private/\n',
      'Cafe\u0301/notes/private/b.md': 'x', 'Cafe\u0301/notes/kept.md': 'kept',
    }
    expect(nfc(await scanWith(files, 'darwin'))).toEqual(['Caf\u00e9/notes/kept.md'])
  })

  it('supports POSIX classes such as [[:digit:]], as git does', async () => {
    const files = {
      '.gitignore': '[[:digit:]].md\n[[:alpha:]]x.md\n[[:upper:]]1.md\n[[:punct:]]p.md\n[[:digit:]a]z.md\n[![:alnum:]]n.md\n[[:xdigit:]]h.md\n',
      '7.md': 'x', 'a.md': 'kept', 'bx.md': 'x', '1x.md': 'kept', 'A1.md': 'x', 'b1.md': 'kept', '_p.md': 'x', 'qp.md': 'kept',
      '3z.md': 'x', 'az.md': 'x', 'bz.md': 'kept', '-n.md': 'x', 'cn.md': 'kept', 'fh.md': 'x', 'gh.md': 'kept',
    }
    expect(await scanWith(files)).toEqual(['1x.md', 'a.md', 'b1.md', 'bz.md', 'cn.md', 'gh.md', 'qp.md'])
  })

  it('[[:upper:]] also takes lowercase letters where matching ignores case', async () => {
    const files = { '.gitignore': '[[:upper:]]1.md\n', 'b1.md': 'x', '11.md': 'kept' }
    expect(await scanWith(files, 'darwin')).toEqual(['11.md'])
    expect(await scanWith(files, 'linux')).toEqual(['11.md', 'b1.md'])
  })

  it('drops a rule with an unknown class like [[:nope:]] without spoiling the others', async () => {
    // "[:]" is no class: "[[:]x].md" is the set of "[" and ":", then "x].md".
    const files = { '.gitignore': '[[:nope:]].md\nsecret.md\n[[:]x].md\n', 'n.md': 'kept', 'secret.md': 'x', '[x].md': 'x', 'x.md': 'kept' }
    expect(await scanWith(files)).toEqual(['n.md', 'x.md'])
  })

  it('drops only one trailing /, as git does: "secret//" keeps a / and matches nothing', async () => {
    const files = { '.gitignore': 'secret/\n!secret//\nnotes//\n', 'secret/pay.md': 'x', 'notes/a.md': 'kept', 'other.md': 'kept' }
    for (const platform of ['linux', 'darwin']) expect(await scanWith(files, platform)).toEqual(['notes/a.md', 'other.md'])
  })

  it('matches ? and [...] on UTF-8 bytes, as git does', async () => {
    const files = {
      '.gitignore': '??.md\n[éè]*\n',
      // é is two bytes, so ?? takes it; à shares its first byte with é and è.
      'é.md': 'x', 'à-notes.md': 'x', 'ab.md': 'x', 'a.md': 'kept', 'notes.md': 'kept',
    }
    for (const platform of ['linux', 'darwin']) expect(nfc(await scanWith(files, platform))).toEqual(['a.md', 'notes.md'])
    // One ? is one byte: it can't take a two-byte é.
    expect(nfc(await scanWith({ '.gitignore': '?.md\n', 'é.md': 'kept', 'b.md': 'x' }))).toEqual(['é.md'])
  })

  it('drops a rule ending in an unpaired backslash, as git does', async () => {
    const files = { '.gitignore': 'foo\\\nbar\\/\n\\\n', 'foo/a.md': 'kept', 'foo.md': 'kept', 'bar/b.md': 'kept', 'other.md': 'kept' }
    expect(await scanWith(files)).toEqual(['bar/b.md', 'foo.md', 'foo/a.md', 'other.md'])
  })

  it.skipIf(process.platform === 'win32')('trims the spaces after an escaped backslash, as git does', async () => {
    const scan = await scanFolder(tree({ '.gitignore': 'notes\\\\  \n', 'notes\\': 'x', 'keep.md': 'kept' }), { platform: 'linux' })
    expect(relsOf(scan)).toEqual(['keep.md'])
    expect(scan.skipped).toEqual({ hidden: 1, ignored: 1 })
  })

  it('never holds the main process for long on a big folder with hundreds of glob rules', { timeout: 60_000 }, async () => {
    const names = Array.from({ length: 20_000 }, (_, i) => `report-${i}.pdf`)
    const rules = Array.from({ length: 400 }, (_, i) => (i % 2 ? `*tmp${i}*` : `**/cache-${i}/**`)).join('\n')
    let longest = 0
    let last = Date.now()
    const ticker = setInterval(() => {
      longest = Math.max(longest, Date.now() - last)
      last = Date.now()
    }, 5)
    try {
      const scan = await scanFolder(path.join(os.tmpdir(), 'promptly-fake'), { platform: 'darwin', fsImpl: fakeFolder(names, rules) })
      expect(scan.skipped).toEqual({ hidden: 1, unsupported: 20_000 })
    } finally {
      clearInterval(ticker)
    }
    longest = Math.max(longest, Date.now() - last)
    expect(longest).toBeLessThan(300)
  })

  it('matches patterns with many stars in linear time (no RegExp backtracking on the main process)', async () => {
    const files = {
      '.gitignore': '*a*a*a*a*a*a*a*a*a*a*b*\n**/a/**/a/**/a/**/a/**/a/**/a/**/a/**/a/**/b*\n',
      [`${'a'.repeat(100)}.md`]: 'kept',
      [`${'a/'.repeat(14)}c.md`]: 'kept',
      [`${'a'.repeat(30)}b.md`]: 'x',
      [`${'a/'.repeat(9)}b.md`]: 'x',
    }
    const started = Date.now()
    const rels = await scanWith(files)
    expect(Date.now() - started).toBeLessThan(1000)
    expect(rels).toEqual([`${'a/'.repeat(14)}c.md`, `${'a'.repeat(100)}.md`])
  })
})

describe('code roots', () => {
  const markers = ['package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml', 'setup.py', 'Pipfile', 'pom.xml', 'build.gradle', 'Gemfile', 'composer.json']

  it.each(markers)('leaves out a folder holding %s as one item, without walking it', async (marker) => {
    const root = tree({ [`tool/${marker}`]: 'x', 'tool/README.md': 'x', 'tool/docs/guide.md': 'x', 'tool/src/main.txt': 'x', 'notes/a.md': 'kept' })
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(relsOf(scan)).toEqual(['notes/a.md'])
    expect(scan.skipped).toEqual({ 'code-root': 1 })
    expect(folderOf(scan, 'tool')).toEqual({ rel: 'tool', count: 0, newestMs: null, codeRoot: true, skippedCount: 1 })
  })

  it('treats a folder holding an .xcodeproj as a code root', async () => {
    const root = tree({ 'ios/App.xcodeproj/project.pbxproj': 'x', 'ios/notes.md': 'x', 'ios/Sources/a.swift': 'x' })
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(scan.files).toEqual([])
    expect(scan.skipped).toEqual({ 'code-root': 1 })
    expect(folderOf(scan, 'ios').codeRoot).toBe(true)
  })

  it('a nested code root leaves out only its own subtree', async () => {
    const root = tree({ '_legacy/README.md': 'kept', '_legacy/app/package.json': '{}', '_legacy/app/docs/a.md': 'x' })
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(relsOf(scan)).toEqual(['_legacy/README.md'])
    expect(scan.skipped).toEqual({ 'code-root': 1 })
    expect(folderOf(scan, '_legacy')).toMatchObject({ count: 1, codeRoot: false, skippedCount: 1 })
  })

  it('marks a top-level folder as code when all it holds is code roots', async () => {
    const root = tree({ 'apps/web/package.json': '{}', 'apps/web/README.md': 'x', 'apps/api/go.mod': 'x', 'apps/logo.png': 'x' })
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(folderOf(scan, 'apps')).toEqual({ rel: 'apps', count: 0, newestMs: null, codeRoot: true, skippedCount: 3 })
  })

  it('never looks inside a code root, so its built-in folders are not even counted', async () => {
    const root = tree({ 'tool/package.json': '{}', 'tool/node_modules/a/index.js': 'x', 'tool/node_modules/a/README.md': 'x', 'tool/.git/HEAD': 'x' })
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(scan.skipped).toEqual({ 'code-root': 1 })
  })

  it('leaves a code root out as one entry, so a big cloned repo never uses up the walk budget', async () => {
    const files = { 'aaa-repo/package.json': '{}', 'zzz-docs/brief.md': 'kept' }
    for (let i = 0; i < 30; i++) files[`aaa-repo/src/f${i}.js`] = 'x'
    const scan = await scanFolder(tree(files), { maxEntries: 5, platform: 'darwin' })
    expect(relsOf(scan)).toEqual(['zzz-docs/brief.md'])
    expect(scan.skipped).toEqual({ 'code-root': 1 })
    expect(scan.unchecked).toEqual([])
  })

  it('finds code roots on disks that give no entry types', async () => {
    const root = tree({ 'ios/App.xcodeproj/project.pbxproj': 'x', 'ios/notes.md': 'x', 'tool/package.json': '{}', 'tool/a.md': 'x', 'docs/b.md': 'kept' })
    const scan = await scanFolder(root, { platform: 'darwin', fsImpl: unknownTypes })
    expect(relsOf(scan)).toEqual(['docs/b.md'])
    expect(scan.skipped).toEqual({ 'code-root': 2 })
  })

  it('never treats the connected folder itself as a code root: its documents stay readable', async () => {
    const root = tree({ 'package.json': '{}', 'README.md': 'kept', 'index.js': 'x', 'docs/spec.md': 'kept', 'web/package.json': '{}', 'web/README.md': 'x' })
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(relsOf(scan)).toEqual(['README.md', 'docs/spec.md'])
    expect(scan.skipped).toEqual({ code: 2, 'code-root': 1 })
    expect(folderOf(scan, '').codeRoot).toBe(false)
  })

  it('skips code-root markers in the connected folder as code, not documents (Gemfile, Pipfile, go.mod)', async () => {
    const root = tree({ 'Pipfile': '[packages]', 'Gemfile': 'gem', 'go.mod': 'module x', 'go.sum': 'x', 'README.md': 'kept' })
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(relsOf(scan)).toEqual(['README.md'])
    expect(scan.skipped).toEqual({ code: 4 })
  })

  it('reads a requirements.txt as a document and never takes it for a code root', async () => {
    const root = tree({ 'requirements.txt': 'Login by email', 'Specs/requirements.txt': 'Must export to PDF', 'Specs/brief.md': 'kept' })
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(relsOf(scan)).toEqual(['Specs/brief.md', 'Specs/requirements.txt', 'requirements.txt'])
    expect(scan.skipped).toEqual({})
    expect(folderOf(scan, 'Specs').codeRoot).toBe(false)
  })

  it('judges a code folder before the maxFiles cap, so documents dropped by the cap still count', async () => {
    const root = tree({ 'x/old.md': 'older document', 'x/app/package.json': '{}', 'x/app/index.js': 'x', 'y/new.md': 'newer' })
    touch(root, 'x/old.md', 1_700_000_000)
    touch(root, 'y/new.md', 1_900_000_000)
    const scan = await scanFolder(root, { maxFiles: 1, platform: 'darwin' })
    expect(relsOf(scan)).toEqual(['y/new.md'])
    expect(scan.tooMany).toBe(1)
    expect(folderOf(scan, 'x')).toMatchObject({ count: 0, codeRoot: false })
  })

  it('a folder whose only readable-looking files are binary is still judged a code folder', async () => {
    const root = tree({ 'x/blob.txt': Buffer.from([0x61, 0x00]), 'x/app/package.json': '{}' })
    const scan = await scanFolder(root, { platform: 'darwin' })
    expect(folderOf(scan, 'x')).toMatchObject({ count: 0, codeRoot: true })
  })
})

describe('unreadable paths never throw', () => {
  const eacces = (p) => Object.assign(new Error(`EACCES: permission denied, open '${p}'`), { code: 'EACCES' })

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('counts a folder without read permission as unreadable', async () => {
    const root = tree({ 'locked/a.md': 'x', 'open/b.md': 'kept' })
    fs.chmodSync(path.join(root, 'locked'), 0o000)
    try {
      const scan = await scanFolder(root, { platform: 'darwin' })
      expect(relsOf(scan)).toEqual(['open/b.md'])
      expect(scan.skipped).toEqual({ unreadable: 1 })
      expect(folderOf(scan, 'locked')).toMatchObject({ count: 0, skippedCount: 1 })
    } finally {
      fs.chmodSync(path.join(root, 'locked'), 0o755)
    }
  })

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('counts a file without read permission as unreadable', async () => {
    const root = tree({ 'a.md': 'x', 'b.md': 'kept' })
    fs.chmodSync(path.join(root, 'a.md'), 0o000)
    try {
      const scan = await scanFolder(root, { platform: 'darwin' })
      expect(relsOf(scan)).toEqual(['b.md'])
      expect(scan.skipped).toEqual({ unreadable: 1 })
    } finally {
      fs.chmodSync(path.join(root, 'a.md'), 0o644)
    }
  })

  it('counts permission errors from listing, stat and open as unreadable', async () => {
    const root = tree({ 'deny/a.md': 'x', 'nostat.md': 'x', 'noopen.md': 'x', 'ok.md': 'kept', '.gitignore': 'x.md\n' })
    const fsImpl = {
      promises: {
        ...fs.promises,
        readdir: async (p, o) => (p.endsWith('deny') ? Promise.reject(eacces(p)) : fs.promises.readdir(p, o)),
        lstat: async (p) => (p.endsWith('nostat.md') ? Promise.reject(eacces(p)) : fs.promises.lstat(p)),
        open: async (p, f) => (p.endsWith('noopen.md') ? Promise.reject(eacces(p)) : fs.promises.open(p, f)),
      },
    }
    const scan = await scanFolder(root, { platform: 'darwin', fsImpl })
    expect(relsOf(scan)).toEqual(['ok.md'])
    expect(scan.skipped).toEqual({ hidden: 1, unreadable: 3 })
  })

  it('lists what it could not read in unchecked, so a manifest diff keeps it instead of calling it removed', async () => {
    const root = tree({ 'a.md': 'a', 'locked.md': 'synced', 'opened.md': 'open elsewhere', 'busy/b.md': 'b', 'gone.md': 'g' })
    const first = await diffManifest({}, (await scanFolder(root, { platform: 'win32' })).files, { dir: root })
    fs.rmSync(path.join(root, 'gone.md'))
    const fsImpl = {
      promises: {
        ...fs.promises,
        readdir: async (p, o) => (p.endsWith('busy') ? Promise.reject(fail('EMFILE', p)) : fs.promises.readdir(p, o)),
        lstat: async (p) => (p.endsWith('locked.md') ? Promise.reject(fail('EBUSY', p)) : fs.promises.lstat(p)),
        open: async (p, f) => (p.endsWith('opened.md') ? Promise.reject(fail('EPERM', p)) : fs.promises.open(p, f)),
      },
    }
    const scan = await scanFolder(root, { platform: 'win32', fsImpl })
    expect(relsOf(scan)).toEqual(['a.md'])
    expect(scan.unchecked.sort()).toEqual(['busy', 'locked.md', 'opened.md'])
    const second = await diffManifest(first.next, scan.files, { dir: root, keep: scan.unchecked })
    expect(second.removed).toEqual(['gone.md'])
    expect(second.failed.sort()).toEqual(['busy/b.md', 'locked.md', 'opened.md'])
    for (const rel of ['busy/b.md', 'locked.md', 'opened.md', 'a.md']) expect(second.next[rel]).toEqual(first.next[rel])
    expect(second.next['gone.md']).toBeUndefined()
  })

  describe('an ignore file that can’t be read fails closed', () => {
    const files = { '.promptlyignore': 'HR/\nsalaries.md\n', '.gitignore': 'secret.md\n', 'ok.md': 'kept', 'secret.md': 'x', 'salaries.md': 'x', 'HR/reviews.md': 'x' }
    const nothing = (rel) => ({ files: [], folders: [], skipped: { unreadable: 1 }, tooMany: 0, unchecked: [''], warnings: [{ rel, reason: "ignore file can't be read" }] })
    // A sync client holding the file (EBUSY), a dropped SMB link (EIO), too many open files.
    const failing = (name, code, base = fs.promises) => ({
      promises: { ...base, readFile: async (p, o) => (path.basename(p) === name ? Promise.reject(fail(code, p)) : fs.promises.readFile(p, o)) },
    })

    it.each([['.promptlyignore', 'EBUSY'], ['.gitignore', 'EIO'], ['.gitignore', 'EMFILE']])('a root %s failing with %s lists nothing and keeps the whole folder', async (name, code) => {
      const root = tree(files)
      const scan = await scanFolder(root, { platform: 'darwin', fsImpl: failing(name, code) })
      expect(scan).toEqual(nothing(name))
      const prev = { 'ok.md': { size: 4, mtimeMs: 1, sha1: 'k' } }
      const out = await diffManifest(prev, scan.files, { dir: root, keep: scan.unchecked })
      expect(out.removed).toEqual([])
      expect(out.next).toEqual(prev)
    })

    it('a nested .gitignore that fails leaves out only its folder, listed in unchecked', async () => {
      const root = tree({ 'ok.md': 'kept', 'sub/.gitignore': 'pay.md\n', 'sub/pay.md': 'x', 'sub/a.md': 'x', 'other/b.md': 'kept' })
      const scan = await scanFolder(root, { platform: 'darwin', fsImpl: failing('.gitignore', 'EPERM') })
      expect(relsOf(scan)).toEqual(['ok.md', 'other/b.md'])
      expect(scan.skipped).toEqual({ unreadable: 1 })
      expect(scan.unchecked).toEqual(['sub'])
      expect(scan.warnings).toEqual([{ rel: 'sub/.gitignore', reason: "ignore file can't be read" }])
      expect(folderOf(scan, 'sub')).toMatchObject({ count: 0, skippedCount: 1 })
    })

    it('an ignore file deleted between listing and reading is simply not there', async () => {
      const scan = await scanFolder(tree(files), { platform: 'darwin', fsImpl: failing('.gitignore', 'ENOENT') })
      expect(relsOf(scan)).toEqual(['ok.md', 'secret.md'])
      expect(scan.unchecked).toEqual([])
    })

    it('finds and applies ignore files on disks that give no entry types', async () => {
      const scan = await scanFolder(tree(files), { platform: 'darwin', fsImpl: unknownTypes })
      expect(relsOf(scan)).toEqual(['ok.md'])
      expect(scan.skipped).toEqual({ hidden: 2, ignored: 3 })
      expect(await scanFolder(tree(files), { platform: 'darwin', fsImpl: failing('.promptlyignore', 'EBUSY', unknownTypes.promises) })).toEqual(nothing('.promptlyignore'))
    })

    it.skipIf(process.platform === 'win32')('an ignore file swapped for a symlink after the listing fails closed too', async () => {
      const outside = tree({ rules: '' })
      const root = tree({ 'ok.md': 'kept', 'secret.md': 'x' })
      fs.symlinkSync(path.join(outside, 'rules'), path.join(root, '.gitignore'))
      const fsImpl = {
        promises: {
          ...fs.promises,
          readdir: async (p, o) => (await fs.promises.readdir(p, o)).map((e) => (e.name === '.gitignore' ? { name: e.name, isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false } : e)),
        },
      }
      expect(await scanFolder(root, { platform: 'darwin', fsImpl })).toEqual(nothing('.gitignore'))
    })
  })

  it('returns an empty result for a folder that is gone', async () => {
    const scan = await scanFolder(path.join(os.tmpdir(), `promptly-missing-${process.pid}-${Date.now()}`), { platform: 'darwin' })
    expect(scan).toEqual({ files: [], folders: [], skipped: { unreadable: 1 }, tooMany: 0, unchecked: [''], warnings: [] })
  })

  describe('when the native realpath fails (a Windows volume without a drive letter)', () => {
    const eisdir = (p) => Promise.reject(fail('EISDIR', p))

    it('checks folders with Node’s own realpath instead of calling the whole project unreadable', async () => {
      const root = tree({ 'ok.md': 'kept', 'sub/a.md': 'kept', '.promptlyignore': 'sub/private/\n', 'sub/private/pay.md': 'x' })
      const scan = await scanFolder(root, { platform: 'win32', fsImpl: { promises: { ...fs.promises, realpath: eisdir } } })
      expect(relsOf(scan)).toEqual(['ok.md', 'sub/a.md'])
      expect(scan.unchecked).toEqual([])
      expect(scan.skipped).toEqual({ hidden: 1, ignored: 1 })
    })

    it.skipIf(process.platform === 'win32')('still never lists a folder swapped for a symlink to elsewhere', async () => {
      const outside = tree({ 'secret.md': 'outside the project' })
      const root = tree({ 'ok.md': 'kept', 'sub/a.md': 'inside' })
      const sub = path.join(root, 'sub')
      const fsImpl = {
        promises: {
          ...fs.promises,
          realpath: eisdir,
          readdir: async (p, o) => {
            if (p === sub && !fs.lstatSync(sub).isSymbolicLink()) {
              fs.renameSync(sub, `${sub}-moved`)
              fs.symlinkSync(outside, sub)
            }
            return fs.promises.readdir(p, o)
          },
        },
      }
      const scan = await scanFolder(root, { platform: 'darwin', fsImpl })
      expect(relsOf(scan)).toEqual(['ok.md'])
      expect(scan.unchecked).toEqual(['sub'])
    })

    it('still follows an ignore file link only inside the folder', async () => {
      const outside = tree({ rules: '*.md\n' })
      const root = tree({ 'config/rules': 'secret.md\n', 'ok.md': 'kept', 'secret.md': 'x', 'sub/b.md': 'kept' })
      fs.symlinkSync('config/rules', path.join(root, '.promptlyignore'))
      fs.symlinkSync(path.join(outside, 'rules'), path.join(root, 'sub/.gitignore'))
      const scan = await scanFolder(root, { platform: 'darwin', fsImpl: { promises: { ...fs.promises, realpath: eisdir } } })
      expect(relsOf(scan)).toEqual(['ok.md', 'sub/b.md'])
      expect(scan.warnings).toEqual([{ rel: 'sub/.gitignore', reason: 'ignore file links outside the folder' }])
    })

    it('calls the folder unreadable only when neither realpath can resolve it', async () => {
      const root = tree({ 'ok.md': 'kept' })
      const fsImpl = { realpath: (p, cb) => cb(fail('EIO', p)), promises: { ...fs.promises, realpath: eisdir } }
      const scan = await scanFolder(root, { platform: 'win32', fsImpl })
      expect(scan).toEqual({ files: [], folders: [], skipped: { unreadable: 1 }, tooMany: 0, unchecked: [''], warnings: [] })
    })
  })

  it('refuses an fsImpl missing a method it needs, instead of reporting the folder unreadable', async () => {
    const root = tree({ 'ok.md': 'kept' })
    for (const name of ['readdir', 'realpath', 'lstat', 'readFile', 'open']) {
      const promises = { ...fs.promises }
      delete promises[name]
      await expect(scanFolder(root, { platform: 'darwin', fsImpl: { promises } })).rejects.toThrow(new TypeError(`scanFolder needs fsImpl.promises.${name}`))
    }
    for (const fsImpl of [null, {}, { promises: null }]) {
      await expect(scanFolder(root, { platform: 'darwin', fsImpl })).rejects.toThrow(TypeError)
    }
  })
})

describe('stopping early', () => {
  it('stops after maxEntries entries, counting and listing what it never reached, and never throws', async () => {
    const root = tree({ 'a.md': 'a', 'b.md': 'b', 'c.md': 'c', 'd.md': 'd', 'e.md': 'e' })
    const scan = await scanFolder(root, { maxEntries: 2, platform: 'linux' })
    expect(scan.files).toHaveLength(2)
    expect(scan.skipped).toEqual({ truncated: 3 })
    expect(scan.unchecked).toHaveLength(3)
    expect([...relsOf(scan), ...scan.unchecked].sort()).toEqual(['a.md', 'b.md', 'c.md', 'd.md', 'e.md'])
  })

  it('counts a folder it never opened once, whatever it holds', async () => {
    const root = tree({ 'sub/a.md': 'a', 'sub/b.md': 'b', 'sub/c.md': 'c' })
    const one = await scanFolder(root, { maxEntries: 1, platform: 'linux' })
    expect(one.files).toEqual([])
    expect(one.skipped).toEqual({ truncated: 1 })
    expect(one.unchecked).toEqual(['sub'])
    const two = await scanFolder(root, { maxEntries: 2, platform: 'linux' })
    expect(two.files).toHaveLength(1)
    expect(two.skipped).toEqual({ truncated: 2 })
    expect([...relsOf(two), ...two.unchecked].sort()).toEqual(['sub/a.md', 'sub/b.md', 'sub/c.md'])
  })

  it('takes the whole folder as unchecked when maxEntries is 0', async () => {
    const scan = await scanFolder(tree({ 'a.md': 'a' }), { maxEntries: 0, platform: 'linux' })
    expect(scan).toEqual({ files: [], folders: [], skipped: { truncated: 1 }, tooMany: 0, unchecked: [''], warnings: [] })
  })

  it('walks up to 200,000 entries when maxEntries is missing or not a number', async () => {
    const names = Array.from({ length: 200_005 }, (_, i) => `x${i}.pdf`)
    for (const maxEntries of [undefined, 'lots']) {
      const scan = await scanFolder(path.join(os.tmpdir(), 'promptly-fake'), { maxEntries, platform: 'linux', fsImpl: fakeFolder(names) })
      expect(scan.skipped).toEqual({ hidden: 1, unsupported: 199_999, truncated: 6 })
      expect(scan.unchecked).toEqual(names.slice(199_999))
    }
    const small = await scanFolder(tree({ 'a.md': 'a' }), { maxEntries: NaN, platform: 'linux' })
    expect(small.skipped).toEqual({})
    expect(small.unchecked).toEqual([])
  })

  it('walks everything when maxEntries is Infinity', { timeout: 30_000 }, async () => {
    const names = Array.from({ length: 200_005 }, (_, i) => `x${i}.pdf`)
    const scan = await scanFolder(path.join(os.tmpdir(), 'promptly-fake'), { maxEntries: Infinity, platform: 'linux', fsImpl: fakeFolder(names) })
    expect(scan.skipped).toEqual({ hidden: 1, unsupported: 200_005 })
    expect(scan.unchecked).toEqual([])
  })

  it('takes a negative maxEntries as missing rather than scanning nothing', async () => {
    const scan = await scanFolder(tree({ 'a.md': 'a', 'b.md': 'b' }), { maxEntries: -1, platform: 'linux' })
    expect(relsOf(scan)).toEqual(['a.md', 'b.md'])
    expect(scan.unchecked).toEqual([])
  })

  it('returns what it has when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const scan = await scanFolder(tree({ 'a.md': 'a' }), { signal: controller.signal, platform: 'linux' })
    expect(scan).toEqual({ files: [], folders: [], skipped: { truncated: 1 }, tooMany: 0, unchecked: [''], warnings: [] })
  })

  it('stops between folders when the signal aborts mid-walk', async () => {
    const root = tree({ 'a.md': 'a', 'b.md': 'b', 'sub/c.md': 'c', 'sub/d.md': 'd' })
    const controller = new AbortController()
    const fsImpl = {
      promises: {
        ...fs.promises,
        readdir: async (p, o) => {
          if (p.endsWith('sub')) controller.abort()
          return fs.promises.readdir(p, o)
        },
      },
    }
    const scan = await scanFolder(root, { signal: controller.signal, platform: 'linux', fsImpl })
    expect(scan.files).toEqual([])
    // sub's two entries were never looked at, and the two top-level files were never opened.
    expect(scan.skipped).toEqual({ truncated: 4 })
    expect(scan.unchecked).toEqual([''])
  })

  it('a diff after an unfinished scan keeps every entry it did not see', async () => {
    const root = tree({ 'a.md': 'a', 'b.md': 'b', 'sub/c.md': 'c' })
    const first = await diffManifest({}, (await scanFolder(root, { platform: 'linux' })).files, { dir: root })
    const partial = await scanFolder(root, { maxEntries: 1, platform: 'linux' })
    const out = await diffManifest(first.next, partial.files, { dir: root, keep: partial.unchecked })
    expect(out.removed).toEqual([])
    expect(out.next).toEqual(first.next)
  })

  // readdir in name order, so which part of the tree the budget reaches is fixed.
  const sorted = { promises: { ...fs.promises, readdir: async (p, o) => (await fs.promises.readdir(p, o)).sort((a, b) => (a.name < b.name ? -1 : 1)) } }

  it('a folder always over the budget still reports files deleted from the part it walked', async () => {
    const root = tree({ 'a/1.md': '1', 'a/2.md': '2', 'b/3.md': '3', 'b/4.md': '4', 'b/5.md': '5', 'c/6.md': '6', 'd/7.md': '7' })
    const first = await diffManifest({}, (await scanFolder(root, { platform: 'linux', fsImpl: sorted })).files, { dir: root })
    fs.rmSync(path.join(root, 'a/1.md'))
    fs.rmSync(path.join(root, 'b/4.md'))
    fs.rmSync(path.join(root, 'd/7.md'))
    // Root: a b c d (4), a: 2.md (5), b: 3.md (6); then b/5.md, c and d are never reached.
    const partial = await scanFolder(root, { maxEntries: 6, platform: 'linux', fsImpl: sorted })
    expect(relsOf(partial)).toEqual(['a/2.md', 'b/3.md'])
    expect(partial.unchecked).toEqual(['b/5.md', 'c', 'd'])
    expect(partial.skipped).toEqual({ truncated: 3 })
    const out = await diffManifest(first.next, partial.files, { dir: root, keep: partial.unchecked })
    // a/1.md and b/4.md were gone from listings the scan finished reading; d/7.md was never looked for.
    expect(out.removed.sort()).toEqual(['a/1.md', 'b/4.md'])
    expect(out.failed.sort()).toEqual(['b/5.md', 'c/6.md', 'd/7.md'])
    expect(Object.keys(out.next).sort()).toEqual(['a/2.md', 'b/3.md', 'b/5.md', 'c/6.md', 'd/7.md'])
  })

  it('takes a whole folder as unchecked when more than 1,000 of its entries were never reached', async () => {
    const names = Array.from({ length: 1_010 }, (_, i) => `n${i}.md`)
    const root = await scanFolder(FAKE_DIR, { maxEntries: 9, platform: 'linux', fsImpl: memoryFolder(names) })
    expect(root.unchecked).toEqual([''])
    expect(root.skipped).toMatchObject({ truncated: 1_002 })
    const atLimit = await scanFolder(FAKE_DIR, { maxEntries: 11, platform: 'linux', fsImpl: memoryFolder(names) })
    expect(atLimit.unchecked).toEqual(names.slice(10))
  })

  it('takes everything as unchecked when the signal stops the walk', async () => {
    const root = tree({ 'a/1.md': '1', 'b/2.md': '2', 'c/3.md': '3' })
    const controller = new AbortController()
    const fsImpl = {
      promises: {
        ...sorted.promises,
        readdir: async (p, o) => {
          if (p.endsWith(`${path.sep}b`)) controller.abort()
          return sorted.promises.readdir(p, o)
        },
      },
    }
    const scan = await scanFolder(root, { signal: controller.signal, platform: 'linux', fsImpl })
    expect(scan.unchecked).toEqual([''])
  })
})

describe('speed', () => {
  it('scans a 5,000-file tree (plus skipped files) quickly, reading at most 8 KB of each', { timeout: 60_000 }, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-scan-big-'))
    roots.push(root)
    for (let d = 0; d < 60; d++) {
      const dir = path.join(root, `folder-${d}`)
      fs.mkdirSync(dir)
      for (let i = 0; i < 90; i++) fs.writeFileSync(path.join(dir, `note-${i}.md`), `note ${d}-${i}\n`.repeat(20))
      for (let i = 0; i < 10; i++) fs.writeFileSync(path.join(dir, `img-${i}.png`), 'x')
      for (let i = 0; i < 10; i++) fs.writeFileSync(path.join(dir, `code-${i}.js`), 'x')
    }
    const started = Date.now()
    const scan = await scanFolder(root, { platform: 'darwin' })
    const ms = Date.now() - started
    expect(scan.files).toHaveLength(5000)
    expect(scan.tooMany).toBe(400)
    expect(scan.skipped).toEqual({ media: 600, code: 600 })
    expect(ms).toBeLessThan(5000)
  })
})

describe('hashFile', () => {
  it('returns the sha1 of the file contents', async () => {
    const root = tree({ 'a.md': 'hello project' })
    expect(await hashFile(path.join(root, 'a.md'))).toBe(crypto.createHash('sha1').update('hello project').digest('hex'))
  })

  it('rejects for a missing file', async () => {
    await expect(hashFile(path.join(os.tmpdir(), `promptly-none-${Date.now()}.md`))).rejects.toThrow()
  })

  it.skipIf(process.platform === 'win32')('refuses to read through a symlink', async () => {
    const outside = tree({ 'secret.md': 'outside the project' })
    const root = tree({ 'real.md': 'x' })
    fs.symlinkSync(path.join(outside, 'secret.md'), path.join(root, 'link.md'))
    await expect(hashFile(path.join(root, 'link.md'))).rejects.toThrow()
  })
})

describe('diffManifest', () => {
  const DIR = path.join(os.tmpdir(), 'promptly-project')
  const sha = (s) => crypto.createHash('sha1').update(s).digest('hex')
  const entry = (rel, size, mtimeMs) => ({ rel, size, mtimeMs, ext: path.extname(rel), top: rel.includes('/') ? rel.split('/')[0] : '' })

  it('adds every file on the first scan with no kind, extraction or summary yet, hashing each by its full path', async () => {
    const calls = []
    const hash = async (abs, f) => {
      calls.push([abs, f.rel])
      return sha(f.rel)
    }
    const out = await diffManifest(null, [entry('a.md', 1, 10), entry('b/c.md', 2, 20)], { dir: DIR, hashFile: hash })
    expect(out.added).toEqual(['a.md', 'b/c.md'])
    expect(out.changed).toEqual([])
    expect(out.removed).toEqual([])
    expect(out.failed).toEqual([])
    expect(calls).toEqual([[path.join(DIR, 'a.md'), 'a.md'], [path.join(DIR, 'b', 'c.md'), 'b/c.md']])
    expect(out.next).toEqual({
      'a.md': { size: 1, mtimeMs: 10, sha1: sha('a.md'), kind: null, extractedAt: null, inSummary: false },
      'b/c.md': { size: 2, mtimeMs: 20, sha1: sha('b/c.md'), kind: null, extractedAt: null, inSummary: false },
    })
  })

  it('does not hash a file whose size and date are unchanged, and carries its entry', async () => {
    const prev = { 'a.md': { size: 1, mtimeMs: 10, sha1: 'aaa', kind: 'conversations', extractedAt: 99, inSummary: true } }
    const hash = async () => {
      throw new Error('should not hash')
    }
    const out = await diffManifest(prev, [entry('a.md', 1, 10)], { dir: DIR, hashFile: hash })
    expect(out).toEqual({ added: [], changed: [], removed: [], next: prev, failed: [] })
    expect(out.next['a.md']).not.toBe(prev['a.md'])
  })

  it('a touched file with the same contents is unchanged but gets the new size and date', async () => {
    const prev = { 'a.md': { size: 1, mtimeMs: 10, sha1: 'aaa', kind: 'agreements', extractedAt: 99, inSummary: true } }
    const out = await diffManifest(prev, [entry('a.md', 1, 50)], { dir: DIR, hashFile: async () => 'aaa' })
    expect(out.added).toEqual([])
    expect(out.changed).toEqual([])
    expect(out.next['a.md']).toEqual({ size: 1, mtimeMs: 50, sha1: 'aaa', kind: 'agreements', extractedAt: 99, inSummary: true })
  })

  it('new contents mark the file changed and keep its kind, extraction time and summary flag', async () => {
    const prev = { 'a.md': { size: 1, mtimeMs: 10, sha1: 'aaa', kind: 'overview', extractedAt: 99, inSummary: true } }
    const out = await diffManifest(prev, [entry('a.md', 3, 50)], { dir: DIR, hashFile: async () => 'bbb' })
    expect(out.changed).toEqual(['a.md'])
    expect(out.next['a.md']).toEqual({ size: 3, mtimeMs: 50, sha1: 'bbb', kind: 'overview', extractedAt: 99, inSummary: true })
  })

  it('lists files that are gone as removed and drops them from the manifest', async () => {
    const prev = { 'a.md': { size: 1, mtimeMs: 10, sha1: 'aaa' }, 'gone.md': { size: 1, mtimeMs: 10, sha1: 'ggg' } }
    const out = await diffManifest(prev, [entry('a.md', 1, 10)], { dir: DIR, hashFile: async () => 'x' })
    expect(out.removed).toEqual(['gone.md'])
    expect(Object.keys(out.next)).toEqual(['a.md'])
  })

  it('a file that can’t be hashed keeps its old entry, or waits for the next scan if it is new, and is listed in failed', async () => {
    const prev = { 'a.md': { size: 1, mtimeMs: 10, sha1: 'aaa', kind: 'overview', extractedAt: 5, inSummary: true } }
    const hash = async (abs) => {
      if (abs.endsWith('ok.md')) return 'okk'
      throw new Error('EBUSY')
    }
    const out = await diffManifest(prev, [entry('a.md', 2, 20), entry('new.md', 1, 30), entry('ok.md', 1, 40)], { dir: DIR, hashFile: hash })
    expect(out.added).toEqual(['ok.md'])
    expect(out.changed).toEqual([])
    expect(out.failed).toEqual(['a.md', 'new.md'])
    expect(out.next).toEqual({ 'a.md': prev['a.md'], 'ok.md': { size: 1, mtimeMs: 40, sha1: 'okk', kind: null, extractedAt: null, inSummary: false } })
  })

  it('refuses to run without the scanned folder or with a hasher that is not a function', async () => {
    const files = [entry('a.md', 1, 10)]
    for (const opts of [undefined, {}, { hashFile }, { dir: '' }, { dir: 42 }]) {
      await expect(diffManifest({}, files, opts)).rejects.toThrow(TypeError)
    }
    for (const bad of [null, 'sha1', {}]) {
      await expect(diffManifest({}, files, { dir: DIR, hashFile: bad })).rejects.toThrow(TypeError)
    }
  })

  it('hashes with the module’s own hashFile by default', async () => {
    const root = tree({ 'notes/a.md': 'hello' })
    const scan = await scanFolder(root, { platform: 'darwin' })
    for (const opts of [{ dir: root }, { dir: root, hashFile }]) {
      const out = await diffManifest({}, scan.files, opts)
      expect(out.added).toEqual(['notes/a.md'])
      expect(out.failed).toEqual([])
      expect(out.next['notes/a.md'].sha1).toBe(sha('hello'))
    }
  })

  it('detects add, change, remove and rename (as remove + add) on a real folder', async () => {
    const root = tree({ 'comms/a.eml': 'From: a\n\none', 'notes/b.md': 'two', 'notes/c.md': 'three', 'notes/d.md': 'four' })
    const first = await diffManifest({}, (await scanFolder(root, { platform: 'darwin' })).files, { dir: root, hashFile })
    expect(first.added.sort()).toEqual(['comms/a.eml', 'notes/b.md', 'notes/c.md', 'notes/d.md'])
    const prev = first.next
    prev['notes/b.md'].kind = 'overview'
    prev['notes/b.md'].inSummary = true

    fs.writeFileSync(path.join(root, 'notes/b.md'), 'two, edited')
    fs.renameSync(path.join(root, 'notes/c.md'), path.join(root, 'notes/c-renamed.md'))
    fs.rmSync(path.join(root, 'notes/d.md'))
    fs.writeFileSync(path.join(root, 'comms/new.eml'), 'From: b\n\nnew')
    touch(root, 'comms/a.eml', 1_900_000_000) // touched, same contents

    const second = await diffManifest(prev, (await scanFolder(root, { platform: 'darwin' })).files, { dir: root, hashFile })
    expect(second.added.sort()).toEqual(['comms/new.eml', 'notes/c-renamed.md'])
    expect(second.changed).toEqual(['notes/b.md'])
    expect(second.removed.sort()).toEqual(['notes/c.md', 'notes/d.md'])
    expect(second.failed).toEqual([])
    expect(second.next['notes/b.md']).toMatchObject({ kind: 'overview', inSummary: true, sha1: sha('two, edited') })
    expect(second.next['comms/a.eml']).toMatchObject({ mtimeMs: 1_900_000_000_000, sha1: prev['comms/a.eml'].sha1 })
    expect(second.next['notes/c-renamed.md']).toMatchObject({ sha1: sha('three'), kind: null, inSummary: false })
  })

  it('never hashes or keeps a path that would leave the scanned folder', async () => {
    const root = tree({ 'ok.md': 'fine' })
    const outside = ['../'.repeat(30) + 'etc/hosts', '/etc/hosts', 'notes/../../x.md', '..', '', 'a/..\\..\\b']
    const calls = []
    const hash = async (abs, f) => {
      calls.push(abs)
      return hashFile(abs, f)
    }
    const prev = { [outside[0]]: { size: 1, mtimeMs: 1, sha1: 'x' } }
    const files = [...outside.map((rel) => entry(rel, 1, 1)), entry('ok.md', 4, 1)]
    for (const opts of [{ dir: root, hashFile: hash }, { dir: root, hashFile: hash, keep: [''] }]) {
      calls.length = 0
      const out = await diffManifest(prev, files, opts)
      expect(calls).toEqual([path.join(root, 'ok.md')])
      expect(out.added).toEqual(['ok.md'])
      expect(out.failed).toEqual(outside)
      expect(Object.keys(out.next)).toEqual(['ok.md'])
      expect(out.removed).toEqual([outside[0]])
    }
  })

  it('never hashes or keeps a path spelled another way than the scan spells it (./a.md, a.md/, a//b.md)', async () => {
    const root = tree({ 'a.md': 'a', 'b/c.md': 'c' })
    const odd = ['./a.md', 'a.md/', 'b//c.md', 'b/./c.md', 'b/c.md/.', '.']
    const calls = []
    const hash = async (abs, f) => {
      calls.push(f.rel)
      return hashFile(abs)
    }
    const prev = Object.fromEntries(odd.map((rel) => [rel, { size: 1, mtimeMs: 1, sha1: 'x' }]))
    const out = await diffManifest(prev, [...odd.map((rel) => entry(rel, 1, 1)), entry('a.md', 1, 1)], { dir: root, hashFile: hash, keep: [''] })
    expect(calls).toEqual(['a.md'])
    expect(out.added).toEqual(['a.md'])
    expect(out.failed).toEqual(odd)
    expect(Object.keys(out.next)).toEqual(['a.md'])
    expect(out.removed).toEqual(odd)
  })

  it('keeps entries at or under the kept paths, listing them in failed, and removes the rest', async () => {
    const prev = {
      'a.md': { size: 1, mtimeMs: 1, sha1: 'a' },
      'busy/b.md': { size: 1, mtimeMs: 1, sha1: 'b' },
      'busy/deep/c.md': { size: 1, mtimeMs: 1, sha1: 'c' },
      'busybox/d.md': { size: 1, mtimeMs: 1, sha1: 'd' },
      'gone.md': { size: 1, mtimeMs: 1, sha1: 'g' },
    }
    const out = await diffManifest(prev, [entry('a.md', 1, 1)], { dir: DIR, keep: ['busy', 'locked.md'] })
    expect(out.removed).toEqual(['busybox/d.md', 'gone.md'])
    expect(out.failed).toEqual(['busy/b.md', 'busy/deep/c.md'])
    expect(out.next).toEqual({ 'a.md': prev['a.md'], 'busy/b.md': prev['busy/b.md'], 'busy/deep/c.md': prev['busy/deep/c.md'] })
  })

  it('refuses a keep that is not a list of paths', async () => {
    for (const keep of ['busy', 42, { busy: true }]) {
      await expect(diffManifest({}, [], { dir: DIR, keep })).rejects.toThrow(TypeError)
    }
    expect((await diffManifest({ 'a.md': { size: 1 } }, [], { dir: DIR, keep: null })).removed).toEqual(['a.md'])
  })
})
