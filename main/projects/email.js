'use strict';

// Email files without dependencies (spec §3 F): .eml headers and MIME bodies, .mbox archives,
// emails saved as .md/.txt, quote stripping and threads. Raw bytes stay in latin1 strings (one
// char per byte) until a part's charset is known, so non-UTF-8 mail decodes with the charset it
// declares.
//
// Files come from the user's folders and can be up to 2 MB of anything, so every regex here is
// written to stay linear: no pattern rescans to the end of the input from each position.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAME = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
const HEADER = /^([!-9;-~]+):[ \t]?(.*)$/;
const ENCODED_WORD = /=\?([^?\s]+)\?([BbQq])\?([^?]*)\?=/g;
const MAX_DEPTH = 12;
const ASCII_LABELS = new Set(['us-ascii', 'ascii', 'ansi_x3.4-1968']);
const FORWARD_LINE = '---------- Forwarded message ----------';

const bytes = (s) => Buffer.from(s, 'latin1');
const pad = (n) => String(n).padStart(2, '0');

// The declared charset, then UTF-8, then windows-1252, which accepts any bytes.
function decodeBytes(buf, charset) {
  const label = String(charset || '').trim().replace(/^["']|["']$/g, '').split('*')[0].toLowerCase();
  // TextDecoder reads us-ascii as windows-1252, which never fails, so UTF-8 mislabelled as ASCII
  // (common) would turn into mojibake unless UTF-8 goes first.
  const order = ASCII_LABELS.has(label) ? ['utf-8', label] : [label, 'utf-8'];
  for (const tryLabel of order) {
    if (!tryLabel) continue;
    try { return new TextDecoder(tryLabel, { fatal: true }).decode(buf); } catch { /* next */ }
  }
  // Unlike latin1, this reads 0x80–0x9F as ’ “ ” € rather than control characters.
  return new TextDecoder('windows-1252').decode(buf);
}

function qpBytes(s, underscoreIsSpace) {
  const text = underscoreIsSpace ? s.replace(/_/g, ' ') : s;
  return text.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// By hand, because /[ \t]+$/ rescans a long run of spaces from every position in it.
function trimLineEnd(line) {
  let end = line.length;
  while (end > 0 && (line[end - 1] === ' ' || line[end - 1] === '\t')) end--;
  return end === line.length ? line : line.slice(0, end);
}

// RFC 2047 words. Adjacent words in one charset are joined before decoding, because a sender
// may split a multi-byte character across two of them.
function decodeHeader(raw) {
  if (!raw) return '';
  const text = decodeBytes(bytes(raw));
  const out = [];
  let pending = null;
  let last = 0;
  const flush = () => {
    if (pending) out.push(decodeBytes(Buffer.concat(pending.chunks), pending.charset));
    pending = null;
  };
  for (const m of text.matchAll(ENCODED_WORD)) {
    const between = text.slice(last, m.index);
    if (!(pending && /^\s*$/.test(between))) { flush(); out.push(between); }
    const charset = m[1].split('*')[0].toLowerCase();
    const data = m[2].toUpperCase() === 'B' ? Buffer.from(m[3], 'base64') : bytes(qpBytes(m[3], true));
    if (pending && pending.charset !== charset) flush();
    if (!pending) pending = { charset, chunks: [] };
    pending.chunks.push(data);
    last = m.index + m[0].length;
  }
  flush();
  out.push(text.slice(last));
  return out.join('').replace(/\s+/g, ' ').trim();
}

function splitHeaders(src) {
  const lines = src.split('\n');
  const headers = new Map();
  let i = /^From /.test(lines[0]) ? 1 : 0; // an mbox From_ line left on a single message
  if (i < lines.length && lines[i].trim() !== '' && !HEADER.test(lines[i])) {
    return { headers, body: lines.slice(i).join('\n') };
  }
  const entries = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') { i++; break; }
    if (/^[ \t]/.test(line)) {
      if (entries.length) entries[entries.length - 1][1] += ' ' + line.trim();
      continue;
    }
    const m = HEADER.exec(line);
    if (m) entries.push([m[1].toLowerCase(), m[2]]);
  }
  for (const [name, value] of entries) {
    if (!headers.has(name)) headers.set(name, []);
    headers.get(name).push(value);
  }
  return { headers, body: lines.slice(i).join('\n') };
}

function contentType(value) {
  const params = {};
  for (const m of value.matchAll(/;\s*([^\s=;]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s;]*))/g)) {
    params[m[1].toLowerCase()] = m[2] !== undefined ? m[2].replace(/\\(.)/g, '$1') : m[3];
  }
  return { type: value.split(';')[0].trim().toLowerCase() || 'text/plain', params };
}

function transferDecode(body, encoding) {
  if (encoding === 'base64') return Buffer.from(body.replace(/[^A-Za-z0-9+/=]/g, ''), 'base64');
  if (encoding === 'quoted-printable') return bytes(qpBytes(body.split('\n').map(trimLineEnd).join('\n').replace(/=\n/g, ''), false));
  return bytes(body);
}

function splitMultipart(body, boundary) {
  const delimiter = '--' + boundary;
  const parts = [];
  let current = null;
  for (const line of body.split('\n')) {
    const trimmed = trimLineEnd(line);
    if (trimmed === delimiter || trimmed === delimiter + '--') {
      if (current) parts.push(current.join('\n'));
      if (trimmed !== delimiter) return parts; // the close delimiter; the rest is epilogue
      current = [];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) parts.push(current.join('\n'));
  return parts;
}

// The boundary a malformed multipart really uses when its header names none, or one the body
// never has: the first "--token" line that a Content- header follows, or that a blank line
// follows (a part without headers is text/plain) once the same "--token" or "--token--" comes
// back. A rule of dashes never counts, so a "-----" in ordinary text is not taken for one.
function guessBoundary(body) {
  const lines = body.split('\n');
  const headerless = new Set();
  for (let i = 0; i < lines.length; i++) {
    const line = trimLineEnd(lines[i]);
    if (line.length < 3 || line.length > 72 || !line.startsWith('--') || /\s/.test(line)) continue;
    const token = line.slice(2);
    const next = lines[i + 1] || '';
    if (/^content-[a-z-]+:/i.test(next)) return token;
    if (headerless.has(token)) return token;
    if (token.endsWith('--') && headerless.has(token.slice(0, -2))) return token.slice(0, -2);
    if (/[^-]/.test(token) && !next.trim()) headerless.add(token);
  }
  return '';
}

// HTML's Latin-1 entities in code-point order from U+00A0, so &eacute;, &szlig; and the rest of
// European mail decode without a table of literal characters.
const LATIN1_ENTITIES = [
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr',
  'deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest',
  'Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml',
  'ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig',
  'agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml',
  'eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml',
].join(' ').split(' ');

const ENTITIES = Object.assign(
  Object.create(null),
  Object.fromEntries(LATIN1_ENTITIES.map((name, i) => [name, String.fromCharCode(0xa0 + i)])),
  {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—', hellip: '…',
    lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', sbquo: '‚', bdquo: '„', lsaquo: '‹', rsaquo: '›',
    bull: '•', trade: '™', euro: '€', permil: '‰', minus: '−', dagger: '†', Dagger: '‡',
    OElig: 'Œ', oelig: 'œ', Scaron: 'Š', scaron: 'š', Yuml: 'Ÿ',
    // Wide and non-breaking spaces read as a plain space; invisible marks as nothing.
    nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ', shy: '', zwnj: '', zwj: '', lrm: '', rlm: '',
  },
);

// Numeric spaces and invisible marks read as their named forms above do. Marketing mail pads its
// preview line with long runs of them (&#847;&zwnj;&nbsp;…).
function numericChar(code) {
  if (code === 0xad || code === 0x34f || (code >= 0x200b && code <= 0x200f) || code === 0x2060 || code === 0xfeff) return '';
  if ((code >= 0x2000 && code <= 0x200a) || code === 0x202f || code === 0x205f || code === 0x3000) return ' ';
  return String.fromCodePoint(code);
}

function decodeEntities(s) {
  return s.replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (all, e) => {
    if (e[0] !== '#') return ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? all;
    const code = /^#[xX]/.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff) ? numericChar(code) : all;
  });
}

const BLOCK_TAGS = 'p|div|br|tr|table|thead|tbody|tfoot|ul|ol|h[1-6]|blockquote|pre|section|article|header|footer|hr|dl|dt|dd|address|center|main|nav|aside|figure|figcaption';
const BLOCK_TAG = new RegExp(`</?(?:${BLOCK_TAGS})\\b[^<>]*>`, 'gi');

// Comments and elements whose content is never text. Each closer is looked for once, from its
// opener, and a missing one hides the rest as it does in a browser, so thousands of unclosed
// '<!--' cost one pass instead of a rescan from each.
function dropHidden(html) {
  const hidden = /<!--|<(script|style|title|noscript|template)\b/gi;
  const out = [];
  let pos = 0;
  for (let m = hidden.exec(html); m; m = hidden.exec(html)) {
    out.push(html.slice(pos, m.index));
    let end = -1;
    if (m[1]) {
      const closer = new RegExp(`</${m[1]}\\s*>`, 'gi');
      closer.lastIndex = m.index + m[0].length;
      const c = closer.exec(html);
      if (c) end = c.index + c[0].length;
    } else {
      const c = html.indexOf('-->', m.index + 4);
      if (c !== -1) end = c + 3;
    }
    if (end === -1) return out.join('');
    pos = end;
    hidden.lastIndex = end;
  }
  out.push(html.slice(pos));
  return out.join('');
}

// Newlines inside <pre> are line breaks (plain-text mail wrapped in HTML), so they become <br>
// before the whitespace collapse. An unclosed <pre> runs to the end, as in a browser, and each
// closer is looked for once, as in dropHidden.
function keepPreLines(html) {
  const open = /<pre\b[^<>]*>/gi;
  const out = [];
  let pos = 0;
  for (let m = open.exec(html); m; m = open.exec(html)) {
    const start = m.index + m[0].length;
    const closer = /<\/pre\s*>/gi;
    closer.lastIndex = start;
    const c = closer.exec(html);
    const end = c ? c.index : html.length;
    // A browser ignores the newline right after <pre>.
    out.push(html.slice(pos, start), html.slice(start, end).replace(/^\r?\n/, '').replace(/\r\n?|\n/g, '<br>'));
    pos = end;
    open.lastIndex = end;
  }
  out.push(html.slice(pos));
  return out.join('');
}

// Source newlines in HTML are only spaces (outside <pre>); lines come from block tags. Tag
// patterns stop at the next '<' so an unclosed one can't make them scan ahead.
function htmlToText(html) {
  return decodeEntities(keepPreLines(dropHidden(String(html || '')))
    .replace(/\s+/g, ' ')
    .replace(/<li\b[^<>]*>/gi, '\n- ')
    .replace(BLOCK_TAG, '\n')
    .replace(/<\/?(?:td|th)\b[^<>]*>/gi, ' ')
    .replace(/<[/!?]?[a-zA-Z][^<>]*>/g, ''))
    .replace(/\u00a0/g, ' ')
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// RFC 3676 format=flowed: a line ending in a space goes on with the next line of the same quote
// depth, so hard-wrapped paragraphs read (and are searched) as one line.
function unflow(text, delsp) {
  const out = [];
  let joining = null; // { depth, text } of a paragraph whose last line ended in a space
  // A paragraph cut off by a change of quote depth, or by the end, drops its dangling space.
  const cutOff = (p) => ({ depth: p.depth, text: trimLineEnd(p.text) });
  for (const raw of text.split('\n')) {
    let depth = 0;
    while (raw[depth] === '>') depth++;
    let line = raw.slice(depth);
    if (line[0] === ' ') line = line.slice(1); // space-stuffing
    if (line === '-- ') {
      // The signature line is neither flowed nor joined onto (RFC 3676 §4.3).
      if (joining) out.push(cutOff(joining));
      joining = null;
      out.push({ depth, text: line });
      continue;
    }
    const soft = line.endsWith(' ');
    if (soft && delsp) line = line.slice(0, -1);
    if (joining && joining.depth === depth) {
      joining.text += line;
    } else {
      if (joining) out.push(cutOff(joining));
      joining = { depth, text: line };
    }
    if (!soft) { out.push(joining); joining = null; }
  }
  if (joining) out.push(cutOff(joining));
  return out.map((p) => (p.depth ? `${'>'.repeat(p.depth)}${p.text ? ` ${p.text}` : ''}` : p.text)).join('\n');
}

const LOOKS_HTML = /<(?:html|head|body|div|p|br|table|span|font)\b[^<>]*>/i;

const sameText = (text) => text.replace(/\s+/g, ' ').trim();

// A multipart body whose parts can't be found is still read, as HTML when it looks like HTML.
function looseText(body, encoding, charset) {
  const text = decodeBytes(transferDecode(body, encoding), charset);
  return LOOKS_HTML.test(text) ? { text: htmlToText(text), html: true } : { text, html: false };
}

// { text, html } for one MIME part; html says the text came from an HTML body.
function partText({ headers, body }, depth) {
  const first = (name) => (headers.get(name) || [])[0] || '';
  const { type, params } = contentType(first('content-type'));
  const encoding = first('content-transfer-encoding').trim().toLowerCase();
  // Before the attachment check: Outlook's and Apple Mail's "Forward as Attachment" send the
  // forwarded message as an attachment, and it is the substance of the forward.
  if (type === 'message/rfc822' || type === 'message/global') return forwardedPart(body, encoding, depth);
  if (/^\s*attachment/i.test(first('content-disposition'))) return null;
  if (type.startsWith('multipart/')) {
    if (depth >= MAX_DEPTH) return null;
    let pieces = params.boundary ? splitMultipart(body, params.boundary) : [];
    if (!pieces.length) {
      const guessed = guessBoundary(body);
      if (guessed && guessed !== params.boundary) pieces = splitMultipart(body, guessed);
    }
    if (!pieces.length) return looseText(body, encoding, params.charset);
    const parts = pieces
      .map((p) => partText(splitHeaders(p), depth + 1))
      .filter((p) => p && p.text.trim());
    if (type === 'multipart/alternative') return parts.find((p) => !p.html) || parts[0] || null;
    // Every other multipart is a sequence: an HTML body next to a plain list footer or a
    // forwarded message is still the body. An HTML part goes only when a plain one already
    // carries its text (a sender that put both versions side by side).
    const plainTexts = new Set(parts.filter((p) => !p.html).map((p) => sameText(p.text)));
    const use = parts.filter((p) => !p.html || !plainTexts.has(sameText(p.text)));
    return use.length ? { text: use.map((p) => p.text.trim()).join('\n\n'), html: use.some((p) => p.html) } : null;
  }
  if (type !== 'text/plain' && type !== 'text/html') return null;
  const decoded = decodeBytes(transferDecode(body, encoding), params.charset);
  if (type === 'text/html') return { text: htmlToText(decoded), html: true };
  if (String(params.format || '').toLowerCase() !== 'flowed') return { text: decoded, html: false };
  return { text: unflow(decoded.replace(/\r\n?/g, '\n'), String(params.delsp || '').toLowerCase() === 'yes'), html: false };
}

// A message carried as a part (forwarded inline or as an attachment), marked as a forward.
function forwardedPart(body, encoding, depth) {
  if (depth >= MAX_DEPTH) return null;
  // Decoded base64 can still hold CRLFs, which would hide every header.
  const inner = splitHeaders(transferDecode(body, encoding).toString('latin1').replace(/\r\n?/g, '\n'));
  const get = (name) => decodeHeader((inner.headers.get(name) || [])[0] || '');
  const head = [['From', addresses(get('from'))], ['Date', get('date')], ['Subject', get('subject')]]
    .filter(([, value]) => value).map(([name, value]) => `${name}: ${value}`);
  const content = partText(inner, depth + 1);
  if (!head.length && !(content && content.text.trim())) return null;
  // Its own text, never the HTML version of the note around it, so it reads as plain.
  return { text: [FORWARD_LINE, ...head, '', content ? content.text.trim() : ''].join('\n').trim(), html: false };
}

function ymd(y, m, d) {
  let year = Number(y);
  if (year < 100) year += year < 50 ? 2000 : 1900;
  const dt = new Date(Date.UTC(year, m - 1, Number(d)));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === Number(d)
    ? `${year}-${pad(m)}-${pad(d)}` : '';
}

// A date is never this long; the cap keeps a stray header line from costing anything.
const dateText = (value) => String(value || '').slice(0, 200).replace(/\([^)]*\)/g, ' ');

// The day as the sender wrote it (no time-zone shift), or '' when there is no date.
function isoDate(value) {
  const s = dateText(value);
  const month = (name) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
  let m = /(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/.exec(s);
  if (m) return ymd(m[1], Number(m[2]), m[3]);
  m = new RegExp(`\\b(\\d{1,2})\\s+${MONTH_NAME},?\\s+(\\d{4}|\\d{2})\\b`, 'i').exec(s);
  if (m) return ymd(m[3], month(m[2]), m[1]);
  m = new RegExp(`\\b${MONTH_NAME}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'i').exec(s);
  if (m) return ymd(m[3], month(m[1]), m[2]);
  // Date.parse invents a year for nearly anything ('12' is 2001-12-01), so it only gets a
  // string that names one.
  if (!/(?<!\d)(?:19|20)\d{2}(?!\d)/.test(s)) return '';
  const t = Date.parse(s);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeOf(value) {
  const t = Date.parse(dateText(value).trim());
  return Number.isNaN(t) ? 0 : t;
}

function addresses(value) {
  return String(value || '').replace(/"([^"]*)"/g, '$1').replace(/\s+/g, ' ').trim();
}

const NOT_IN_ADDRESS = new Set([...'<>"\',;:()[]@']);
const inAddress = (c) => !NOT_IN_ADDRESS.has(c) && !/\s/.test(c);

// "Name <a@b.c>", else the first bare a@b.c, lowercased. The bare form is found by walking out
// from each '@' (never past another), because a regex for it rescans a long token per position.
function emailAddress(value) {
  const s = String(value || '');
  const bracketed = /<([^<>\s@]+@[^<>\s]+)>/.exec(s);
  if (bracketed) return bracketed[1].toLowerCase();
  for (let at = s.indexOf('@'); at !== -1; at = s.indexOf('@', at + 1)) {
    let start = at;
    while (start > 0 && inAddress(s[start - 1])) start--;
    let end = at + 1;
    while (end < s.length && inAddress(s[end])) end++;
    while (end > at + 1 && s[end - 1] === '.') end--;
    const domain = s.slice(at + 1, end);
    if (start < at && domain.includes('.') && domain[0] !== '.') return s.slice(start, end).toLowerCase();
  }
  return '';
}

function ids(value) {
  const s = String(value || '');
  const bracketed = s.match(/<[^<>\s]+>/g);
  const list = bracketed ? bracketed.map((id) => id.slice(1, -1)) : s.split(/\s+/).filter(Boolean);
  return [...new Set(list)];
}

const tidy = (text) => String(text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();

function parseEml(input) {
  let raw = Buffer.isBuffer(input) ? input : Buffer.from(String(input ?? ''), 'utf8');
  if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) raw = raw.subarray(3);
  const top = splitHeaders(raw.toString('latin1').replace(/\r\n?/g, '\n'));
  const get = (name) => decodeHeader((top.headers.get(name) || [])[0] || '');
  const from = addresses(get('from'));
  const date = get('date');
  const body = partText(top, 0);
  return {
    from,
    fromAddress: emailAddress(from),
    to: addresses(get('to')),
    cc: addresses(get('cc')),
    date: isoDate(date),
    time: timeOf(date),
    subject: get('subject'),
    messageId: ids(get('message-id'))[0] || '',
    inReplyTo: ids(get('in-reply-to'))[0] || '',
    references: ids((top.headers.get('references') || []).join(' ')),
    text: tidy(body ? body.text : ''),
  };
}

// A From_ line starts a message only after a blank line and before a header, so an unescaped
// "From what I hear" in a body never splits one.
function splitMbox(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const messages = [];
  let current = null;
  lines.forEach((line, i) => {
    if (/^From /.test(line) && (i === 0 || lines[i - 1].trim() === '') && HEADER.test(lines[i + 1] || '')) {
      if (current) messages.push(current);
      current = [];
      return;
    }
    if (!current) current = [];
    current.push(line.replace(/^>(>*From )/, '$1'));
  });
  if (current) messages.push(current);
  return messages.map((m) => m.join('\n').trim()).filter(Boolean);
}

const TEXT_HEADER = /^\s*(?:[-*]\s+)?(?:\*\*|__)?(from|to|cc|bcc|date|sent|subject|reply-to|message-id|in-reply-to|references)(?:\*\*|__)?\s*:\s*(?:\*\*|__)?(.*)$/i;

// '**Aparna**' (the opening ** is already gone), '"Aparna"', trailing markdown line-break spaces.
function cleanValue(value) {
  let s = String(value || '').trim();
  if (s.endsWith('**') || s.endsWith('__')) s = s.slice(0, -2).trim();
  return s.replace(/^["']|["']$/g, '').trim();
}

// An email exported as .md/.txt: From/Date/Subject lines at the top (plain, **bold** or YAML
// front matter), after an optional # heading.
function emailFromText(text) {
  const lines = String(text || '').replace(/^\ufeff/, '').replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  const skipBlank = () => { while (i < lines.length && !lines[i].trim()) i++; };
  skipBlank();
  let heading = '';
  const frontMatter = /^---\s*$/.test(lines[i] || '');
  if (frontMatter) {
    i++;
  } else if (/^#{1,6}\s/.test(lines[i] || '')) {
    heading = lines[i].slice(0, 500).replace(/^#+\s*/, '').replace(/\s*#+\s*$/, '').trim();
    i++;
    skipBlank();
  }
  const fields = {};
  let last = null; // the field an indented (wrapped) line continues; '' for a repeated header
  while (i < lines.length) {
    if (frontMatter && /^---\s*$/.test(lines[i])) break;
    const m = TEXT_HEADER.exec(lines[i]);
    if (m) {
      const key = m[1].toLowerCase();
      last = key in fields ? '' : key;
      if (last) fields[key] = m[2];
      i++;
      continue;
    }
    if (frontMatter) { i++; continue; } // other front matter keys (tags, title, …)
    if (last !== null && /^[ \t]+\S/.test(lines[i])) {
      if (last) fields[last] += ` ${lines[i].trim()}`;
      i++;
      continue;
    }
    last = null;
    let next = i;
    while (next < lines.length && !lines[next].trim()) next++;
    if (next === i || next >= lines.length || !TEXT_HEADER.test(lines[next])) break;
    i = next; // a blank line between header lines, as markdown needs for line breaks
  }
  if (frontMatter) {
    if (i >= lines.length) return null;
    i++;
  }
  const field = (key) => cleanValue(fields[key]);
  if (!field('from') || !(field('date') || field('sent') || field('subject'))) return null;
  const from = addresses(field('from'));
  const date = field('date') || field('sent');
  const rest = lines.slice(i).join('\n').replace(/^\s*(?:-{3,}|\*{3,}|_{3,})[ \t]*(?:\n|$)/, '');
  return {
    from,
    fromAddress: emailAddress(from),
    to: addresses(field('to')),
    cc: addresses(field('cc')),
    date: isoDate(date),
    time: timeOf(date),
    subject: field('subject') || heading,
    messageId: ids(field('message-id'))[0] || '',
    inReplyTo: ids(field('in-reply-to'))[0] || '',
    references: ids(field('references')),
    text: tidy(rest),
  };
}

const ORIGINAL_MESSAGE = /^\s*-{2,}\s*(?:Original Message|Ursprüngliche Nachricht)\s*-{2,}\s*$/i;
const UNDERSCORE_RULE = /^\s*_{10,}\s*$/;
const BLOCK_FROM = /^\s*(?:\*\*|__)?(?:from|von)(?:\*\*|__)?\s*:/i;
const BLOCK_FIELD = /^\s*(?:\*\*|__)?(?:sent|date|to|cc|subject|gesendet|datum|an|betreff)(?:\*\*|__)?\s*:/i;
const FORWARD_SUBJECT = /^\s*(?:\[[^\]]{1,40}\]\s*)*(?:fwd?|wg|tr)\s*(?:\[\d+\]|\(\d+\))?\s*:/i;
const FORWARD_MARKER = /^\s*(?:-{3,}\s*(?:forwarded message|weitergeleitete nachricht|message transféré)\s*-{3,}|begin forwarded message:)\s*$/i;

const isQuote = (line) => /^\s*>/.test(line);

// "On … wrote:", "Am … schrieb …:", "Le … a écrit :". Checked from the ends, not with .*, so a
// long line costs one pass.
function isAttribution(text) {
  if (!text.endsWith(':')) return false;
  const s = text.slice(0, -1).trimEnd();
  return (/^On\s/.test(s) && /\swrote$/.test(s))
    || (/^Am\s/.test(s) && /\sschrieb(?:\s|$)/.test(s))
    || (/^Le\s/.test(s) && /\sa écrit$/.test(s));
}

// How many lines an "On … wrote:" attribution spans here (mail clients wrap it), or 0. Mail
// clients always put a date in it; requiring a digit keeps a person's own "On Monday, Aparna
// wrote:" (a line someone typed, not a client) as text rather than a cut.
function attributionLines(lines, i) {
  if (lines[i].length > 400 || !/^\s*(?:On|Am|Le)\s/.test(lines[i])) return 0;
  let joined = '';
  for (let n = 1; n <= 3 && i + n <= lines.length; n++) {
    joined = `${joined} ${lines[i + n - 1].trim()}`.trim();
    if (joined.length > 600) return 0;
    if (/\d/.test(joined) && isAttribution(joined)) return n;
  }
  return 0;
}

// Outlook's quoted header: From: followed by at least two of Sent/To/Subject/… lines.
function isHeaderBlock(lines, i) {
  if (!BLOCK_FROM.test(lines[i])) return false;
  const next = lines.slice(i + 1, i + 12).filter((l) => l.trim()).slice(0, 4);
  return next.filter((l) => BLOCK_FIELD.test(l)).length >= 2;
}

// Where an earlier message starts; everything from here on is history.
function historyStarts(lines, i) {
  return ORIGINAL_MESSAGE.test(lines[i]) || UNDERSCORE_RULE.test(lines[i]) || isHeaderBlock(lines, i);
}

// "-- " is the signature line. A bare "--" (the same line once an editor trimmed it) counts only
// when a short block follows, so a "--" divider above real paragraphs keeps them.
function isSignature(lines, i) {
  if (lines[i] === '-- ') return true;
  if (lines[i] !== '--') return false;
  let count = 0;
  for (let j = i + 1; j < lines.length && j <= i + 40; j++) {
    if (!lines[j].trim()) continue;
    if (isQuote(lines[j]) || historyStarts(lines, j) || attributionLines(lines, j)) return true;
    if (++count > 6 || lines[j].length > 100) return false;
  }
  return true;
}

function stripQuoted(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (historyStarts(lines, i) || isSignature(lines, i)) break;
    const span = attributionLines(lines, i);
    if (span) {
      // A '>' quote after the attribution may be followed by a bottom-posted or interleaved
      // reply, so only the quote goes (a footer after it, such as "Sent from my iPhone", stays
      // too); anything else after it is the earlier message, so everything goes.
      let next = i + span;
      while (next < lines.length && !lines[next].trim()) next++;
      if (next >= lines.length || !isQuote(lines[next])) break;
      i += span - 1;
      continue;
    }
    if (!isQuote(line)) kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// A forward's "quoted" part is the message it carries, usually the substance. Signs: Fwd:/Fw:/
// WG:/TR: leading the subject, or a forwarded-message line before any reply history.
function isForward(msg) {
  if (!msg) return false;
  if (FORWARD_SUBJECT.test(String(msg.subject || ''))) return true;
  const lines = String(msg.text || '').replace(/\r\n?/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (FORWARD_MARKER.test(lines[i])) return true;
    if (historyStarts(lines, i) || attributionLines(lines, i)) return false;
  }
  return false;
}

// A message's own words: quotes and signature go, except from a forward, which keeps everything.
function dequote(msg) {
  const text = tidy(msg && msg.text);
  return isForward(msg) ? text : stripQuoted(text);
}

// A sticky pattern applied in a loop: one prefix per step, no backtracking across a subject
// that is nothing but "Re: Re: Re: …".
const SUBJECT_PREFIX = /\s*(?:\[[^\]]{1,40}\]|(?:re|fwd?|aw|wg|sv|antw|tr)\s*(?:\[\d+\]|\(\d+\))?\s*:)/iy;

function normalizeSubject(subject) {
  const s = String(subject || '');
  let pos = 0;
  SUBJECT_PREFIX.lastIndex = 0;
  while (SUBJECT_PREFIX.exec(s)) pos = SUBJECT_PREFIX.lastIndex;
  return s.slice(pos).trim();
}

const subjectKey = (subject) => normalizeSubject(subject).toLowerCase().replace(/\s+/g, ' ');

function byTime(a, b) {
  return (a.time && b.time ? a.time - b.time : 0)
    || String(a.date || '').localeCompare(String(b.date || ''))
    || (a.references || []).length - (b.references || []).length;
}

// Threads, newest activity first. Message-ID, In-Reply-To and References link messages; a
// message nothing links to joins a thread with the same subject (Re:/Fwd:/AW:/WG: ignored).
function threadMessages(msgs) {
  const list = (msgs || []).filter(Boolean);
  const parent = list.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  const owner = new Map();
  list.forEach((m, i) => {
    for (const id of [m.messageId, m.inReplyTo, ...(m.references || [])]) {
      if (!id) continue;
      const key = String(id).toLowerCase();
      if (owner.has(key)) parent[find(i)] = find(owner.get(key));
      else owner.set(key, i);
    }
  });
  const groups = new Map();
  list.forEach((_, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  });
  const threads = [];
  const bySubject = new Map();
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const thread = { members };
    threads.push(thread);
    for (const i of members) {
      const key = subjectKey(list[i].subject);
      if (key && !bySubject.has(key)) bySubject.set(key, thread);
    }
  }
  for (const members of groups.values()) {
    if (members.length !== 1) continue;
    const key = subjectKey(list[members[0]].subject);
    if (key && bySubject.has(key)) { bySubject.get(key).members.push(members[0]); continue; }
    const thread = { members: [...members] };
    threads.push(thread);
    if (key) bySubject.set(key, thread);
  }
  return threads
    .map(({ members }, n) => {
      const messages = members.sort((a, b) => a - b).map((i) => list[i]).sort(byTime);
      const first = messages[0];
      const titled = messages.find((m) => normalizeSubject(m.subject));
      const subject = titled ? normalizeSubject(titled.subject) : '';
      const key = (first.references || [])[0] || first.inReplyTo || first.messageId
        || (subject ? `subject:${subjectKey(subject)}` : `message:${n}`);
      return { key, subject, messages };
    })
    .sort((a, b) => byTime(b.messages[b.messages.length - 1], a.messages[a.messages.length - 1]));
}

function truncateBytes(text, maxBytes) {
  const room = Math.max(0, maxBytes - Buffer.byteLength('…'));
  if (!room) return '';
  return Buffer.from(text, 'utf8').subarray(0, room).toString('utf8').replace(/\ufffd+$/, '') + '…';
}

// The newest message in full and last; older ones without their quotes (forwards whole), or in
// full with keepQuotes (mail kept outside conversations, spec §3 B 9). The oldest go first when
// it doesn't fit.
function renderThread(thread, opts) {
  const maxBytes = opts?.maxBytes ?? 12000;
  const keepQuotes = Boolean(opts?.keepQuotes);
  const messages = (thread && thread.messages) || [];
  const last = messages.length - 1;
  const head = (m) => `From: ${m.from || m.fromAddress || 'unknown sender'}${m.date ? ` · ${m.date}` : ''}`;
  const blocks = [];
  messages.forEach((m, i) => {
    const body = i === last || keepQuotes ? tidy(m.text) : dequote(m);
    if (i === last || body) blocks.push(`${head(m)}\n${body}`.trim());
  });
  const sizes = blocks.map((b) => Buffer.byteLength(b, 'utf8'));
  let total = sizes.reduce((sum, n) => sum + n, 0) + 2 * Math.max(0, blocks.length - 1); // '\n\n' between
  let start = 0;
  while (start < blocks.length - 1 && total > maxBytes) total -= sizes[start++] + 2;
  const out = blocks.slice(start).join('\n\n');
  return total > maxBytes ? truncateBytes(out, maxBytes) : out;
}

module.exports = {
  parseEml,
  splitMbox,
  emailFromText,
  stripQuoted,
  threadMessages,
  renderThread,
  isForward,
  dequote,
  decodeBytes,
  htmlToText,
  isoDate,
  normalizeSubject,
};
