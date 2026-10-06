'use strict';

// Plain text for one project file: what the summary, the search index and the Look deeper cache
// read (spec §3 F, §8). Every readable type becomes a Doc, or null when there is nothing to read.

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const defaultPlatform = require('../platform');
const email = require('./email');

const TEXT_TYPES = new Set(['.md', '.markdown', '.txt']);
const HTML_TYPES = new Set(['.html', '.htm']);
const CONVERT_TIMEOUT_MS = 20000;
const CONVERT_MAX_BUFFER = 20 * 1024 * 1024;

const pad = (n) => String(n).padStart(2, '0');

// UTF-16 by its BOM; otherwise the declared charset, then UTF-8, then windows-1252, which never
// fails.
function decodeText(buf, charset) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf.subarray(2));
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf.subarray(2));
  const body = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? buf.subarray(3) : buf;
  return email.decodeBytes(body, charset);
}

// Lines are cut to 300 characters first: a title is never longer, and a trailing-# pattern
// over a whole line would rescan a long run of '#' from each position.
function firstHeading(text) {
  for (const line of text.split('\n')) {
    const m = /^#{1,6}[ \t]+(.*)$/.exec(line.slice(0, 300));
    const title = m ? m[1].trim().replace(/(?:^|[ \t]+)#+$/, '').replace(/[*`]/g, '').trim() : '';
    if (title) return title;
  }
  return '';
}

function metaCharset(buf) {
  const m = /<meta[^<>]+charset\s*=\s*["']?([\w:.-]+)/i.exec(buf.subarray(0, 4096).toString('latin1'));
  return m ? m[1] : undefined;
}

// The first <title>, searched for once rather than with a lazy pattern that rescans the file
// from every unclosed '<title'.
function htmlTitle(html) {
  const open = /<title\b[^<>]*>/i.exec(html);
  if (!open) return '';
  const close = /<\/title\s*>/gi;
  close.lastIndex = open.index + open[0].length;
  const end = close.exec(html);
  return end ? email.htmlToText(html.slice(open.index + open[0].length, end.index).slice(0, 1000)).replace(/\s+/g, ' ') : '';
}

// The first real YYYY-MM-DD (or YYYYMMDD) in the file name, such as 2026-10-04-standup.md. An
// id that only looks like one ('12345678-2026-10-04.md') is passed over.
function dateFromName(rel) {
  for (const m of path.posix.basename(String(rel)).matchAll(/(?<!\d)(\d{4})([-_.]?)(\d{2})\2(\d{2})(?!\d)/g)) {
    const date = email.isoDate(`${m[1]}-${m[3]}-${m[4]}`);
    if (date) return date;
  }
  return '';
}

function localDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Spec §3 B 9: quoted replies are removed from conversations only, so an approval in agreements/
// keeps the terms it quotes. A forward keeps what it carries (email.dequote), and a message that
// is nothing but a quote keeps its text rather than going empty.
function emailText(mail, kind) {
  return kind === 'conversations' ? email.dequote(mail) || mail.text : mail.text;
}

function convert(execFileImpl, [cmd, args]) {
  return new Promise((resolve) => {
    try {
      execFileImpl(cmd, args, { timeout: CONVERT_TIMEOUT_MS, maxBuffer: CONVERT_MAX_BUFFER, encoding: 'buffer' },
        (err, stdout) => resolve(err ? null : stdout));
    } catch {
      resolve(null);
    }
  });
}

// { text, email?, title? } for one file, or null for a type Promptly can't read here.
async function readByType(abs, ext, { kind, platform, execFileImpl }) {
  if (TEXT_TYPES.has(ext)) {
    // Windows-written notes end lines in CRLF, and a '\r' left on the heading line hides it.
    const text = decodeText(await fs.promises.readFile(abs)).replace(/\r\n?/g, '\n');
    const mail = email.emailFromText(text);
    return mail ? { text: emailText(mail, kind), email: mail } : { text, title: firstHeading(text) };
  }
  if (ext === '.eml') {
    const mail = email.parseEml(await fs.promises.readFile(abs));
    return { text: emailText(mail, kind), email: mail };
  }
  if (ext === '.mbox') {
    // latin1 keeps every byte, so each message still decodes with its own charset.
    const raw = (await fs.promises.readFile(abs)).toString('latin1');
    const threads = email.threadMessages(email.splitMbox(raw).map((m) => email.parseEml(Buffer.from(m, 'latin1'))));
    if (!threads.length) return null;
    // Older messages lose their quotes only in conversations, as an .eml does (spec §3 B 9).
    const keepQuotes = kind !== 'conversations';
    const text = threads.map((t) => {
      const body = email.renderThread(t, { maxBytes: Infinity, keepQuotes });
      return t.subject ? `Subject: ${t.subject}\n\n${body}` : body;
    }).join('\n\n');
    const newest = threads[0].messages[threads[0].messages.length - 1];
    return { text, email: newest };
  }
  if (HTML_TYPES.has(ext)) {
    const buf = await fs.promises.readFile(abs);
    const html = decodeText(buf, metaCharset(buf));
    return { text: email.htmlToText(html), title: htmlTitle(html) };
  }
  const command = platform.extractTextCommand ? platform.extractTextCommand(ext, abs) : null;
  if (!command) return null;
  const out = await convert(execFileImpl, command);
  if (out == null) return null;
  return { text: decodeText(Buffer.isBuffer(out) ? out : Buffer.from(String(out), 'utf8')) };
}

async function extractDoc(abs, rel, { kind, platform = defaultPlatform, execFileImpl = execFile } = {}) {
  let stat;
  let found;
  try {
    stat = await fs.promises.stat(abs);
    if (!stat.isFile()) return null;
    found = await readByType(abs, path.extname(abs).toLowerCase(), { kind, platform, execFileImpl });
  } catch {
    return null;
  }
  if (!found) return null;
  const text = String(found.text || '').replace(/\r\n?/g, '\n').replace(/\0/g, '').trim();
  if (!text) return null;
  const mail = found.email || {};
  return {
    rel,
    kind: kind || 'reference',
    date: mail.date || dateFromName(rel) || localDate(stat.mtimeMs),
    sender: mail.from || '',
    title: mail.subject || found.title || path.posix.basename(String(rel)).replace(/\.[^.]+$/, ''),
    text,
  };
}

// textDir/<rel>.txt, the cache Look deeper reads. rel comes from a scan, but the check stays so
// a bad path can never write outside Promptly's own folder.
function writeExtracted(textDir, rel, text) {
  const root = path.resolve(textDir);
  const name = String(rel || '');
  const target = path.resolve(root, `${name}.txt`);
  if (!name || path.isAbsolute(name) || name.split(/[\\/]/).includes('..') || !target.startsWith(root + path.sep)) {
    throw new Error(`Refusing to write outside the text folder: ${name}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, String(text ?? ''), 'utf8');
}

module.exports = { extractDoc, writeExtracted };
