import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { parseEml, splitMbox, emailFromText, stripQuoted, threadMessages, renderThread, isForward, dequote, decodeBytes, htmlToText, isoDate } = require('../main/projects/email.js')
const { extractDoc, writeExtracted } = require('../main/projects/extract.js')
const darwin = require('../main/platform/darwin.js')
const win32 = require('../main/platform/win32.js')

const crlf = (lines) => lines.join('\r\n')
const wrap76 = (s) => s.match(/.{1,76}/g).join('\r\n')
const elapsed = (fn) => { const start = performance.now(); fn(); return performance.now() - start }

// Forwards as three mail clients write them, each with a one-line note above.
const FORWARDS = {
  gmail: [
    'From: Aakash <aakash@betacraft.io>',
    'Subject: Fwd: SSO requirements',
    'Date: Sun, 5 Oct 2026 10:00:00 +0530',
    '',
    'FYI, see below.',
    '',
    '---------- Forwarded message ---------',
    'From: Aparna Rao <aparna@infer360.com>',
    'Date: Sat, 4 Oct 2026 at 10:12',
    'Subject: SSO requirements',
    'To: Aakash <aakash@betacraft.io>',
    '',
    'We need SSO with Azure AD by 15 Oct.',
  ].join('\n'),
  outlook: [
    'From: Aakash <aakash@betacraft.io>',
    'Subject: FW: Contract',
    'Date: Sun, 5 Oct 2026 10:00:00 +0530',
    '',
    'Please review.',
    '',
    '________________________________',
    'From: Aparna Rao <aparna@infer360.com>',
    'Sent: Saturday, 4 October 2026 10:12',
    'To: Aakash',
    'Subject: Contract',
    '',
    'Budget is ₹5,000 for phase 2.',
  ].join('\n'),
  appleMd: [
    '# Fwd: Kickoff',
    '',
    '**From:** Aakash <aakash@betacraft.io>',
    '**Date:** 5 Oct 2026',
    '**Subject:** Kickoff',
    '',
    'Adding Priya.',
    '',
    'Begin forwarded message:',
    '',
    'From: Aparna Rao <aparna@infer360.com>',
    'Subject: Kickoff',
    'Date: 4 October 2026 at 10:12',
    'To: Aakash',
    '',
    'Kickoff is Monday 9am IST.',
  ].join('\n'),
}

// The three messages of one thread, as a mail client exports them.
const THREAD = {
  m1: [
    'From: "Aparna Rao" <aparna@infer360.com>',
    'To: Aakash <aakash@betacraft.io>',
    'Subject: SSO setup',
    'Date: Thu, 2 Oct 2026 09:00:00 +0530',
    'Message-ID: <m1@infer360.com>',
    '',
    'Hi Aakash,',
    'Can we add the copyable link this week?',
    'Also we need SSO.',
    '',
    '-- ',
    'Aparna Rao',
    'Infer360',
  ].join('\n'),
  m2: [
    'From: Aakash <aakash@betacraft.io>',
    'To: "Aparna Rao" <aparna@infer360.com>',
    'Subject: Re: SSO setup',
    'Date: Fri, 3 Oct 2026 11:00:00 +0530',
    'Message-ID: <m2@betacraft.io>',
    'In-Reply-To: <m1@infer360.com>',
    'References: <m1@infer360.com>',
    '',
    'Yes, the link ships Friday. Please send the tenant ID.',
    '',
    'On Thu, 2 Oct 2026 at 09:00, Aparna Rao <aparna@infer360.com>',
    'wrote:',
    '> Hi Aakash,',
    '> Can we add the copyable link this week?',
  ].join('\n'),
  m3: [
    'From: "Aparna Rao" <aparna@infer360.com>',
    'To: Aakash <aakash@betacraft.io>',
    'Subject: RE: SSO setup',
    'Date: Sat, 4 Oct 2026 10:12:00 +0530',
    'Message-ID: <m3@infer360.com>',
    'In-Reply-To: <m2@betacraft.io>',
    'References: <m1@infer360.com>',
    ' <m2@betacraft.io>',
    '',
    'Tenant ID is 7f3c-22. Thanks!',
    '',
    '________________________________',
    'From: Aakash <aakash@betacraft.io>',
    'Sent: Friday, 3 October 2026 11:00',
    'To: Aparna Rao',
    'Subject: Re: SSO setup',
    '',
    'Yes, the link ships Friday. Please send the tenant ID.',
  ].join('\n'),
}

describe('.eml parsing (spec §23)', () => {
  it('reads a plain email: unfolded headers, display name, lowercase address, ISO date, ids', () => {
    const mail = parseEml(crlf([
      'From: "Aparna Rao" <Aparna.Rao@Infer360.com>',
      'To: Aakash <aakash@betacraft.io>, "Rao, Priya" <priya@infer360.com>',
      'Cc: team@infer360.com',
      'Subject: Copyable link and',
      '\tthe tenant ID',
      'Date: Sat, 4 Oct 2026 23:30:00 -0700 (PDT)',
      'Message-ID: <abc.123@infer360.com>',
      'In-Reply-To: <parent@betacraft.io> (Aakash\'s message)',
      'References: <root@betacraft.io>',
      '  <parent@betacraft.io>',
      '',
      'Hi Aakash,',
      'Can we add the copyable link this week?',
    ]))
    expect(mail.from).toBe('Aparna Rao <Aparna.Rao@Infer360.com>')
    expect(mail.fromAddress).toBe('aparna.rao@infer360.com')
    expect(mail.to).toBe('Aakash <aakash@betacraft.io>, Rao, Priya <priya@infer360.com>')
    expect(mail.cc).toBe('team@infer360.com')
    expect(mail.subject).toBe('Copyable link and the tenant ID')
    // The sender's own day, not shifted to UTC (that would be 5 Oct).
    expect(mail.date).toBe('2026-10-04')
    expect(mail.messageId).toBe('abc.123@infer360.com')
    expect(mail.inReplyTo).toBe('parent@betacraft.io')
    expect(mail.references).toEqual(['root@betacraft.io', 'parent@betacraft.io'])
    expect(mail.text).toBe('Hi Aakash,\nCan we add the copyable link this week?')
  })

  it('gives an empty date for one it cannot read, and still reads the rest', () => {
    const mail = parseEml('From: a@b.com\nDate: sometime soon\nSubject: Hi\n\nBody')
    expect(mail.date).toBe('')
    expect(mail.subject).toBe('Hi')
    expect(mail.text).toBe('Body')
    expect(parseEml('Date: 2026-10-04T23:30:00Z\n\nx').date).toBe('2026-10-04')
    expect(parseEml('Date: Oct 4, 2026\n\nx').date).toBe('2026-10-04')
    expect(parseEml('Date: 31 Feb 2026\n\nx').date).toBe('')
  })

  it('prefers text/plain in multipart/alternative', () => {
    const mail = parseEml(crlf([
      'From: Aparna <aparna@infer360.com>',
      'Subject: Status',
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="alt-1"',
      '',
      'This is a multi-part message in MIME format.',
      '--alt-1',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Plain version: phase 2 starts Monday.',
      '--alt-1',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<p>HTML version: <b>phase 2</b> starts Monday.</p>',
      '--alt-1--',
      'epilogue',
    ]))
    expect(mail.text).toBe('Plain version: phase 2 starts Monday.')
  })

  it('turns an HTML-only body into text: scripts and styles go, blocks become lines, entities decode', () => {
    const mail = parseEml(crlf([
      'From: a@b.com',
      'Content-Type: multipart/alternative; boundary=b1',
      '',
      '--b1',
      'Content-Type: text/plain',
      '',
      '',
      '--b1',
      'Content-Type: text/html; charset="utf-8"',
      '',
      '<html><head><style>p { color: red }</style><title>x</title></head><body>',
      '<script>alert("no")</script><p>Hi&nbsp;team,</p><div>Budget: &#8377;5,000 &amp; 2 weeks</div>',
      '<ul><li>One</li><li>Two &lt;b&gt;</li></ul>Line<br>break &rsquo;s &#x1F600;</body></html>',
      '--b1--',
    ]))
    expect(mail.text).toBe('Hi team,\n\nBudget: ₹5,000 & 2 weeks\n\n- One\n- Two <b>\nLine\nbreak ’s 😀')
    expect(mail.text).not.toMatch(/alert|color: red/)
  })

  it('keeps the line breaks inside <pre> (plain-text mail wrapped in HTML)', () => {
    expect(htmlToText('<pre>a\nb</pre>')).toBe('a\nb')
    expect(htmlToText('<p>Log:</p><pre class="x">\nline one\r\n  line two\nline three</pre><p>End  of\nmail</p>')).toBe('Log:\n\nline one\nline two\nline three\n\nEnd of mail')
    // An unclosed <pre> runs to the end, as in a browser.
    expect(htmlToText('<p>Top</p><pre>a\nb')).toBe('Top\n\na\nb')
  })

  it('decodes the Latin-1 letter entities of European mail, any case', () => {
    expect(htmlToText('Caf&eacute; &Eacute;t&eacute; &agrave; &egrave; &uuml;ber &Ouml;l &auml; &ccedil;a &ntilde; Stra&szlig;e &EACUTE;'))
      .toBe('Café Été à è über Öl ä ça ñ Straße é')
    // The table runs from U+00A0 to U+00FF in order: its ends and middle land on the right letters.
    expect(htmlToText('&iexcl;&iquest;&Agrave;&times;&Oslash;&divide;&yuml; &bdquo;Ja&ldquo; &oelig;')).toBe('¡¿À×Ø÷ÿ „Ja“ œ')
    expect(htmlToText('a&nbsp;b&shy;c &unknown; &AMP;')).toBe('a bc &unknown; &')
    // Names with digits.
    expect(htmlToText('&frac12; day, 10&sup2; m, &frac14; &frac34; &sup1; &sup3; &frac99;')).toBe('½ day, 10² m, ¼ ¾ ¹ ³ &frac99;')
  })

  it('reads numeric spaces and invisible marks as the named ones (a preview line padded with them)', () => {
    expect(htmlToText('Sale ends today&#847;&zwnj;&nbsp;&#847;&#8204;&#160;&#8203;&#xFEFF;&#x200B;<p>Hi</p>')).toBe('Sale ends today\nHi')
    expect(htmlToText('a&#8199;b&#x2009;c&#8239;d')).toBe('a b c d')
    // Only entities: a literal joiner inside an emoji stays.
    expect(htmlToText('<p>\u{1F468}\u200d\u{1F469}</p>')).toBe('\u{1F468}\u200d\u{1F469}')
  })

  it('reads a literal no-break space as a space', () => {
    expect(htmlToText('<p>Hi\u00a0team,\u00a0\u00a0phase\u00a02</p>')).toBe('Hi team, phase 2')
  })

  it('decodes a base64 body', () => {
    const body = 'Namaste — ₹5,000 is agreed for phase 2.\nThe copyable link ships this week.'
    const mail = parseEml(crlf([
      'From: a@b.com',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      wrap76(Buffer.from(body).toString('base64')),
    ]))
    expect(mail.text).toBe(body)
  })

  it('decodes a quoted-printable body with soft line breaks', () => {
    const mail = parseEml(crlf([
      'From: a@b.com',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: Quoted-Printable',
      '',
      'Namaste =E2=82=B9 5,000 agreed for phase 2, and the copy=',
      'able link ships this week. 3 =3D 3   ',
      'Done.',
    ]))
    expect(mail.text).toBe('Namaste ₹ 5,000 agreed for phase 2, and the copyable link ships this week. 3 = 3\nDone.')
  })

  it('decodes ISO-8859-1 bodies, 8-bit and quoted-printable', () => {
    const eightBit = Buffer.concat([
      Buffer.from('From: a@b.com\r\nContent-Type: text/plain; charset=ISO-8859-1\r\nContent-Transfer-Encoding: 8bit\r\n\r\n', 'latin1'),
      Buffer.from('R\xe9union au caf\xe9, d\xe9j\xe0 r\xe9serv\xe9e.', 'latin1'),
    ])
    expect(parseEml(eightBit).text).toBe('Réunion au café, déjà réservée.')
    const qp = parseEml('From: a@b.com\nContent-Type: text/plain; charset=iso-8859-1\nContent-Transfer-Encoding: quoted-printable\n\nCaf=E9 cr=E8me')
    expect(qp.text).toBe('Café crème')
  })

  it('falls back to UTF-8, then latin1, for an unknown or missing charset', () => {
    const utf8 = Buffer.from('From: a@b.com\nContent-Type: text/plain; charset=x-made-up\n\nCafé ₹', 'utf8')
    expect(parseEml(utf8).text).toBe('Café ₹')
    const latin1 = Buffer.from('From: a@b.com\n\nCaf\xe9', 'latin1')
    expect(parseEml(latin1).text).toBe('Café')
  })

  it('decodes RFC 2047 subjects and names (B and Q, any charset, split characters)', () => {
    const b = Buffer.from('Réunion — ₹ budget').toString('base64')
    expect(parseEml(`Subject: =?UTF-8?B?${b}?=\n\nx`).subject).toBe('Réunion — ₹ budget')
    expect(parseEml('Subject: =?ISO-8859-1?Q?R=E9union_pr=E9vue?= demain\n\nx').subject).toBe('Réunion prévue demain')
    // Whitespace between encoded words goes; a character split across two words still decodes.
    const w1 = Buffer.from([0x52, 0xe2]).toString('base64')
    const w2 = Buffer.from([0x82, 0xb9, 0x20, 0x35]).toString('base64')
    expect(parseEml(`Subject: =?utf-8?B?${w1}?=\r\n =?utf-8?B?${w2}?= lakh\r\n\r\nx`).subject).toBe('R₹ 5 lakh')
    expect(parseEml('From: =?utf-8?q?Aparna_R=C3=A3o?= <APARNA@infer360.com>\n\nx')).toMatchObject({ from: 'Aparna Rão <APARNA@infer360.com>', fromAddress: 'aparna@infer360.com' })
    // Raw UTF-8 bytes in a header (no encoded word) read as UTF-8.
    expect(parseEml(Buffer.from('Subject: Café ₹\n\nx', 'utf8')).subject).toBe('Café ₹')
  })

  it('walks nested multiparts and leaves attachments out', () => {
    const mail = parseEml(crlf([
      'From: a@b.com',
      'Content-Type: multipart/mixed; boundary="outer"',
      '',
      '--outer',
      'Content-Type: multipart/alternative; boundary="inner"',
      '',
      '--inner',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      'Contract attached =E2=80=94 please sign.',
      '--inner',
      'Content-Type: text/html',
      '',
      '<p>Contract attached</p>',
      '--inner--',
      '--outer',
      'Content-Type: application/pdf; name="sow.pdf"',
      'Content-Disposition: attachment; filename="sow.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      'JVBERi0xLjQK',
      '--outer',
      'Content-Type: text/plain; name="notes.txt"',
      'Content-Disposition: attachment; filename="notes.txt"',
      '',
      'attached notes',
      '--outer--',
    ]))
    expect(mail.text).toBe('Contract attached — please sign.')
  })

  it('keeps every part of a multipart/mixed in order: an HTML body is not lost to a plain footer or a forward', () => {
    const mixed = (...parts) => parseEml(crlf([
      'From: Aparna <aparna@infer360.com>',
      'Content-Type: multipart/mixed; boundary="m"',
      '',
      ...parts.flatMap((p) => ['--m', ...p]),
      '--m--',
    ]))
    const html = ['Content-Type: text/html; charset=utf-8', '', '<p>I approve item 3. Go ahead.</p>']
    const forward = (disposition) => [
      'Content-Type: message/rfc822',
      ...(disposition ? [`Content-Disposition: ${disposition}`] : []),
      '',
      'From: Aakash <aakash@betacraft.io>',
      'Subject: Items for approval',
      '',
      'Item 3: SSO with Azure AD.',
    ]
    const forwarded = '---------- Forwarded message ----------\nFrom: Aakash <aakash@betacraft.io>\nSubject: Items for approval\n\nItem 3: SSO with Azure AD.'
    for (const disposition of ['attachment; filename="items.eml"', 'inline', '']) {
      const mail = mixed(html, forward(disposition))
      expect(mail.text).toBe(`I approve item 3. Go ahead.\n\n${forwarded}`)
      expect(dequote(mail)).toContain('I approve item 3.')
    }
    // A mailing list's plain footer after an HTML-only body.
    expect(mixed(html, ['Content-Type: text/plain', '', '_____', 'team mailing list']).text)
      .toBe('I approve item 3. Go ahead.\n\n_____\nteam mailing list')
    // The HTML copy of a plain part beside it is still left out.
    expect(mixed(['Content-Type: text/plain', '', 'I approve item 3.', 'Go ahead.'], html).text).toBe('I approve item 3.\nGo ahead.')
  })

  it('keeps a message forwarded inline as a message/rfc822 part, marked as a forward', () => {
    const mail = parseEml(crlf([
      'From: Aakash <aakash@betacraft.io>',
      'Subject: Contract',
      'Content-Type: multipart/mixed; boundary="m"',
      '',
      '--m',
      'Content-Type: text/plain',
      '',
      'See forwarded.',
      '--m',
      'Content-Type: message/rfc822',
      '',
      'From: "Aparna Rao" <aparna@infer360.com>',
      'Subject: =?utf-8?q?Budget_=E2=82=B9?=',
      'Date: Sat, 4 Oct 2026 10:12:00 +0530',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<p>Phase 2 budget is <b>5,000</b>.</p>',
      '--m--',
    ]))
    expect(mail.text).toBe('See forwarded.\n\n---------- Forwarded message ----------\nFrom: Aparna Rao <aparna@infer360.com>\nDate: Sat, 4 Oct 2026 10:12:00 +0530\nSubject: Budget ₹\n\nPhase 2 budget is 5,000.')
    expect(isForward(mail)).toBe(true)
    expect(dequote(mail)).toContain('Phase 2 budget is 5,000.')
  })

  it('reads UTF-8 mislabelled as us-ascii as UTF-8, and falls back to windows-1252, not latin1', () => {
    const mislabelled = Buffer.from('From: a@b.com\nContent-Type: text/plain; charset=us-ascii\n\nCafé ₹', 'utf8')
    expect(parseEml(mislabelled).text).toBe('Café ₹')
    expect(decodeBytes(Buffer.from('caf\xe9', 'latin1'), 'US-ASCII')).toBe('café')
    // 0x93/0x94 are curly quotes in windows-1252 and control characters in latin1. (Node 20's
    // TextDecoder still reads windows-1252 as latin1; Electron's Node 24 gets them right.)
    const smart = Buffer.from([0x93, 0x68, 0x69, 0x94])
    expect(decodeBytes(smart, 'x-unknown')).toBe(new TextDecoder('windows-1252').decode(smart))
  })

  it('reads a multipart with no boundary, or one the body never uses, instead of losing it', () => {
    expect(parseEml('Content-Type: multipart/mixed\n\nhello').text).toBe('hello')
    expect(parseEml('Content-Type: multipart/mixed; boundary=x\n\nhi there').text).toBe('hi there')
    expect(parseEml('Content-Type: multipart/alternative; boundary=x\n\n<div>Phase 2 <b>starts</b> Monday.</div><p>Thanks</p>').text).toBe('Phase 2 starts Monday.\n\nThanks')
    // The parts are still found when the header names the wrong boundary, or none.
    const parts = [
      'This is a multi-part message in MIME format.',
      '--real',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Contract attached.',
      '--real',
      'Content-Type: application/pdf',
      'Content-Disposition: attachment; filename="sow.pdf"',
      '',
      'JVBERi0xLjQK',
      '--real--',
    ]
    expect(parseEml(crlf(['Content-Type: multipart/mixed', '', ...parts])).text).toBe('Contract attached.')
    expect(parseEml(crlf(['Content-Type: multipart/mixed; boundary="wrong"', '', ...parts])).text).toBe('Contract attached.')
    // A "-----" rule in ordinary text is not taken for a boundary.
    expect(parseEml('Content-Type: multipart/mixed\n\nhello\n-----\n\nbye').text).toBe('hello\n-----\n\nbye')
  })

  it('finds the boundary of a malformed multipart whose parts have no headers (text/plain by default)', () => {
    expect(parseEml('Content-Type: multipart/mixed\n\n--b\n\nhello there\n--b--').text).toBe('hello there')
    expect(parseEml(crlf(['Content-Type: multipart/mixed; boundary="wrong"', '', '--b', '', 'one', '--b', '', 'two', '--b--'])).text).toBe('one\n\ntwo')
    // A "--token" line that never comes back, or a repeated rule of dashes, is ordinary text.
    expect(parseEml('Content-Type: multipart/mixed\n\n--note\n\nhello').text).toBe('--note\n\nhello')
    expect(parseEml('Content-Type: multipart/mixed\n\nhello\n-----\n\nmid\n-----\n\nbye').text).toBe('hello\n-----\n\nmid\n-----\n\nbye')
  })

  it('keeps a message forwarded as an attachment (Outlook, Apple Mail), marked as a forward', () => {
    const inner = crlf([
      'From: "Aparna Rao" <aparna@infer360.com>',
      'Subject: SOW v2 terms',
      'Date: Sat, 4 Oct 2026 10:12:00 +0530',
      '',
      'Phase 2 is 6 weeks and includes SSO.',
    ])
    const outer = (encoded, encoding) => parseEml(crlf([
      'From: Aakash <aakash@betacraft.io>',
      'Subject: Fw: SOW v2 terms',
      'Content-Type: multipart/mixed; boundary="m"',
      '',
      '--m',
      'Content-Type: text/plain',
      '',
      'See attached.',
      '--m',
      'Content-Type: message/rfc822; name="SOW v2 terms.eml"',
      'Content-Disposition: attachment; filename="SOW v2 terms.eml"',
      ...(encoding ? [`Content-Transfer-Encoding: ${encoding}`] : []),
      '',
      encoded,
      '--m',
      'Content-Type: application/pdf; name="sow.pdf"',
      'Content-Disposition: attachment; filename="sow.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      'JVBERi0xLjQK',
      '--m--',
    ]))
    const expected = 'See attached.\n\n---------- Forwarded message ----------\nFrom: Aparna Rao <aparna@infer360.com>\nDate: Sat, 4 Oct 2026 10:12:00 +0530\nSubject: SOW v2 terms\n\nPhase 2 is 6 weeks and includes SSO.'
    const mail = outer(inner)
    expect(mail.text).toBe(expected)
    expect(isForward(mail)).toBe(true)
    // Base64 keeps the forwarded message's CRLFs; its headers are still read.
    expect(outer(wrap76(Buffer.from(inner).toString('base64')), 'base64').text).toBe(expected)
    // Other attachments still stay out.
    expect(mail.text).not.toMatch(/JVBER/)
  })

  it('reads format=flowed plain text as paragraphs (RFC 3676), quote depth and signature kept', () => {
    const flowed = parseEml([
      'Content-Type: text/plain; charset=utf-8; format=flowed',
      '',
      'Phase 2 starts Monday and the copyable link ',
      'ships the same week. ',
      ' From now on we use SSO.',
      '',
      '> Can we add the tenant ',
      '> ID too?',
      '>> older ',
      '> line',
      '-- ',
      'Aparna',
    ].join('\n'))
    expect(flowed.text).toBe('Phase 2 starts Monday and the copyable link ships the same week. From now on we use SSO.\n\n> Can we add the tenant ID too?\n>> older\n> line\n-- \nAparna')
    expect(parseEml('Content-Type: text/plain; format="Flowed"; delsp=yes\n\nThe tenant is con \nfigured.').text).toBe('The tenant is configured.')
    // Without format=flowed, trailing spaces are not line joins.
    expect(parseEml('Content-Type: text/plain\n\nLine one \nLine two').text).toBe('Line one \nLine two')
  })

  it('format=flowed never joins a paragraph onto the "-- " signature line, so the signature still goes', () => {
    const signed = parseEml('Content-Type: text/plain; format=flowed\n\nThanks \n-- \nAparna\nCEO')
    expect(signed.text).toBe('Thanks\n-- \nAparna\nCEO')
    expect(stripQuoted(signed.text)).toBe('Thanks')
    expect(parseEml('Content-Type: text/plain; format=flowed; delsp=yes\n\nSee you Mon \nday. \n-- \nAparna').text).toBe('See you Monday.\n-- \nAparna')
    expect(parseEml('Content-Type: text/plain; format=flowed\n\nOK.\n\n> Thanks \n> -- \n> Aparna').text).toBe('OK.\n\n> Thanks\n> -- \n> Aparna')
  })

  it('gives no date for text that names no year, instead of letting Date.parse invent one', () => {
    for (const junk of ['12', 'Version 3.1', 'Oct 4', 'tomorrow 10am']) expect(isoDate(junk)).toBe('')
    expect(isoDate('Sat Oct  4 10:12:00 2026')).toBe('2026-10-04')
    expect(emailFromText('From: Aparna <a@b.com>\nDate: 12\nSubject: Hi\n\nBody').date).toBe('')
  })
})

describe('quoted replies (spec §24)', () => {
  it('drops > lines and a wrapped "On … wrote:" attribution, keeping a bottom-posted reply', () => {
    expect(stripQuoted('Sounds good.\n\nOn Sat, 4 Oct 2026 at 10:12, Aparna <a@x.com>\nwrote:\n> Can we?\n> Thanks')).toBe('Sounds good.')
    expect(stripQuoted('On 4 Oct 2026, at 10:12, Aparna wrote:\n> Can we add it?\n\nYes, this week.')).toBe('Yes, this week.')
    expect(stripQuoted('Inline:\n> question one\nanswer one\n> question two\nanswer two')).toBe('Inline:\nanswer one\nanswer two')
  })

  it('cuts at an attribution not followed by > quotes (HTML mail), and at Original Message', () => {
    expect(stripQuoted('Done.\n\nOn Fri, Oct 3, 2026 at 11:00 AM Aakash <a@b.io> wrote:\n\nYes, the link ships Friday.')).toBe('Done.')
    expect(stripQuoted('Approved.\n\n-----Original Message-----\nFrom: Aakash\nSent: Friday\n\nOld text')).toBe('Approved.')
    expect(stripQuoted('Ja.\n\nAm 3. Okt. 2026 um 11:00 schrieb Aakash <a@b.io>:\nAlter Text')).toBe('Ja.')
  })

  it('cuts at an Outlook header block (plain or **bold**) and at an underscore rule', () => {
    expect(stripQuoted('Noted.\n\nFrom: Aakash <a@b.io>\nSent: Friday, 3 October 2026 11:00\nTo: Aparna\nSubject: Re: SSO\n\nOld')).toBe('Noted.')
    expect(stripQuoted('Noted.\n\n**From:** Aakash\n**Sent:** Friday\n**To:** Aparna\n\nOld')).toBe('Noted.')
    expect(stripQuoted('Noted.\n________________________________\nanything')).toBe('Noted.')
    // A From: line on its own is just text.
    expect(stripQuoted('From: the client side, all good.\nNext step is SSO.')).toBe('From: the client side, all good.\nNext step is SSO.')
  })

  it('drops a signature after "-- "', () => {
    expect(stripQuoted('See you Monday.\n\n-- \nAparna Rao\nInfer360 · +91 98')).toBe('See you Monday.')
    expect(stripQuoted('See you.\n--\nAparna')).toBe('See you.')
  })

  it('keeps a bottom-posted reply and what follows the quote; a digit-less "On …, X wrote:" is text', () => {
    // Deliberate: when '>' quotes follow the attribution only they go, so interleaved and
    // bottom-posted replies survive, and so does a footer below the quote.
    expect(stripQuoted('On 4 Oct 2026, at 10:12, Aparna wrote:\n> Can we add it?\n\nYes, this week.\n\nSent from my iPhone'))
      .toBe('Yes, this week.\n\nSent from my iPhone')
    // Mail clients always date the attribution; a line without a digit is someone's own words.
    expect(stripQuoted('Recap.\nOn Monday, Aparna wrote:\nWe need SSO by the 15th.')).toBe('Recap.\nOn Monday, Aparna wrote:\nWe need SSO by the 15th.')
    expect(stripQuoted('Recap.\nOn Monday, Aparna wrote:\n> We need SSO.\nAgreed.')).toBe('Recap.\nOn Monday, Aparna wrote:\nAgreed.')
  })

  it('a bare "--" (a trimmed "-- ") cuts only before a short block, so a divider keeps the text below it', () => {
    const below = Array.from({ length: 8 }, (_, i) => `Point ${i + 1}: the copyable link needs a tenant ID first.`).join('\n')
    expect(stripQuoted(`Notes:\n--\n${below}`)).toBe(`Notes:\n--\n${below}`)
    expect(stripQuoted('Thanks.\n--\nAparna\nInfer360\n\nOn Fri, 3 Oct 2026 at 11:00, Aakash <a@b.io> wrote:\n> old')).toBe('Thanks.')
  })
})

describe('threads (spec §24, §20.2)', () => {
  const parsed = () => [parseEml(THREAD.m3), parseEml(THREAD.m1), parseEml(THREAD.m2)]

  it('groups by Message-ID / In-Reply-To / References and orders oldest → newest', () => {
    const threads = threadMessages([...parsed(), parseEml('From: x@y.com\nSubject: Invoice\nMessage-ID: <inv@y.com>\nDate: 5 Oct 2026\n\nInvoice attached')])
    expect(threads).toHaveLength(2)
    const sso = threads.find((t) => t.subject === 'SSO setup')
    expect(sso.messages.map((m) => m.messageId)).toEqual(['m1@infer360.com', 'm2@betacraft.io', 'm3@infer360.com'])
    expect(sso.key).toBe('m1@infer360.com')
    // Newest activity first.
    expect(threads[0].subject).toBe('Invoice')
  })

  it('a 3-message thread keeps the newest in full and only the new text of older ones', () => {
    const [thread] = threadMessages(parsed())
    const out = renderThread(thread)
    const blocks = out.split('\n\n')
    expect(blocks[0]).toBe('From: Aparna Rao <aparna@infer360.com> · 2026-10-02\nHi Aakash,\nCan we add the copyable link this week?\nAlso we need SSO.')
    expect(blocks[1]).toBe('From: Aakash <aakash@betacraft.io> · 2026-10-03\nYes, the link ships Friday. Please send the tenant ID.')
    expect(out.indexOf('· 2026-10-02')).toBeLessThan(out.indexOf('· 2026-10-03'))
    // Newest last and in full, its own quoted history included.
    expect(out.endsWith('Subject: Re: SSO setup\n\nYes, the link ships Friday. Please send the tenant ID.')).toBe(true)
    expect(out).toContain('From: Aparna Rao <aparna@infer360.com> · 2026-10-04\nTenant ID is 7f3c-22. Thanks!\n\n________________________________')
    // Older ones carry no quotes, attribution or signature.
    expect(out).not.toMatch(/^>|wrote:|Infer360$/m)
  })

  it('drops the oldest messages first to fit maxBytes, and cuts the newest if it alone is too big', () => {
    const [thread] = threadMessages(parsed())
    const full = renderThread(thread)
    const withoutOldest = full.slice(full.indexOf('From: Aakash'))
    expect(renderThread(thread, { maxBytes: Buffer.byteLength(withoutOldest) })).toBe(withoutOldest)
    const tiny = renderThread(thread, { maxBytes: 60 })
    expect(Buffer.byteLength(tiny)).toBeLessThanOrEqual(60)
    expect(tiny.startsWith('From: Aparna Rao <aparna@infer360.com> · 2026-10-04')).toBe(true)
    expect(tiny.endsWith('…')).toBe(true)
  })

  it('falls back to the normalised subject (Re:/Fwd:/Fw:/AW:/WG:) when nothing links messages', () => {
    const threads = threadMessages([
      { subject: 'AW: Fwd: SSO Setup', date: '2026-10-03', from: 'C', text: 'c' },
      { subject: 'SSO setup', date: '2026-10-01', from: 'A', text: 'a' },
      { subject: 'Invoice', date: '2026-10-02', from: 'X', text: 'x' },
      { subject: 'WG: Re: sso setup', date: '2026-10-02', from: 'B', text: 'b' },
      { subject: 'Fw: SSO setup', date: '2026-10-04', from: 'D', text: 'd' },
    ])
    expect(threads.map((t) => t.messages.map((m) => m.from).join(''))).toEqual(['ABCD', 'X'])
    expect(threads[0]).toMatchObject({ subject: 'SSO setup', key: 'subject:sso setup' })
  })

  it('keeps an older forward whole: what it carries is not a quote', () => {
    const forward = parseEml(FORWARDS.gmail)
    const reply = parseEml('From: Aparna Rao <aparna@infer360.com>\nSubject: Re: Fwd: SSO requirements\nDate: Mon, 6 Oct 2026 09:00:00 +0530\n\nAzure AD tenant is ready.\n\nOn Sun, 5 Oct 2026 at 10:00, Aakash <aakash@betacraft.io> wrote:\n> FYI, see below.')
    const [thread] = threadMessages([reply, forward])
    expect(thread.messages).toHaveLength(2)
    const out = renderThread(thread)
    expect(out).toContain('FYI, see below.\n\n---------- Forwarded message ---------')
    expect(out).toContain('We need SSO with Azure AD by 15 Oct.')
    expect(out.endsWith('> FYI, see below.')).toBe(true)
  })

  it('keepQuotes renders older messages in full (mail kept outside conversations)', () => {
    const [thread] = threadMessages(parsed())
    const out = renderThread(thread, { keepQuotes: true })
    expect(out).toContain('From: Aakash <aakash@betacraft.io> · 2026-10-03\nYes, the link ships Friday. Please send the tenant ID.\n\nOn Thu, 2 Oct 2026 at 09:00, Aparna Rao <aparna@infer360.com>\nwrote:\n> Hi Aakash,')
    expect(out).toContain('Also we need SSO.\n\n-- \nAparna Rao\nInfer360')
    expect(renderThread(thread, { keepQuotes: false })).toBe(renderThread(thread))
  })

  it('a cut through a multi-byte character leaves no replacement character', () => {
    const thread = { messages: [{ from: 'A', text: '₹₹₹₹' }] }
    for (let maxBytes = 9; maxBytes <= 20; maxBytes++) {
      const out = renderThread(thread, { maxBytes })
      expect(out).not.toContain('\ufffd')
      expect(Buffer.byteLength(out)).toBeLessThanOrEqual(maxBytes)
    }
    expect(renderThread(thread, { maxBytes: 13 })).toBe('From: A\n…')
  })

  it('takes null or no options, and Infinity for no limit', () => {
    const [thread] = threadMessages([parseEml(THREAD.m1), parseEml(THREAD.m2), parseEml(THREAD.m3)])
    const full = renderThread(thread)
    expect(renderThread(thread, null)).toBe(full)
    expect(renderThread(thread, {})).toBe(full)
    expect(renderThread(thread, { maxBytes: Infinity })).toBe(full)
    expect(renderThread(null)).toBe('')
  })

  it('an exported .md reply without ids joins the thread its subject names', () => {
    const md = emailFromText('From: Aakash <aakash@betacraft.io>\nDate: 5 Oct 2026\nSubject: Re: SSO setup\n\nSSO is live.')
    const threads = threadMessages([...parsed(), md])
    expect(threads).toHaveLength(1)
    expect(threads[0].messages.at(-1).text).toBe('SSO is live.')
  })
})

describe('emails saved as .md/.txt (spec §25)', () => {
  it('recognises From/Date/Subject/To lines at the top', () => {
    const mail = emailFromText('From: Aparna Rao <aparna@infer360.com>\nDate: Sat, 4 Oct 2026 10:12\nSubject: Re: SSO setup\nTo: Aakash\n\nTenant ID is 7f3c-22.\n\nOn Fri, 3 Oct 2026, Aakash wrote:\n> Please send the tenant ID.')
    expect(mail).toMatchObject({ from: 'Aparna Rao <aparna@infer360.com>', fromAddress: 'aparna@infer360.com', to: 'Aakash', date: '2026-10-04', subject: 'Re: SSO setup' })
    expect(mail.text.startsWith('Tenant ID is 7f3c-22.')).toBe(true)
  })

  it('tolerates markdown bold, blank lines between header lines, a heading and front matter', () => {
    const bold = emailFromText('# Re: SSO setup\n\n**From:** Aparna Rao <aparna@infer360.com>  \n\n**Date:** Saturday, October 4, 2026 10:12 AM\n- **To**: Aakash\n\n---\n\nTenant ID is 7f3c-22.')
    expect(bold).toMatchObject({ from: 'Aparna Rao <aparna@infer360.com>', date: '2026-10-04', subject: 'Re: SSO setup', to: 'Aakash', text: 'Tenant ID is 7f3c-22.' })
    const yaml = emailFromText('---\nfrom: "Aparna <aparna@infer360.com>"\ntags: [client]\ndate: 2026-10-04\nsubject: SSO\n---\nBody')
    expect(yaml).toMatchObject({ from: 'Aparna <aparna@infer360.com>', date: '2026-10-04', subject: 'SSO', text: 'Body' })
  })

  it('reads header lines wrapped onto an indented line, and drops a trailing ** from a value', () => {
    const wrapped = emailFromText('From: Aparna Rao <aparna@infer360.com>\nTo: aakash@betacraft.io,\n  priya@infer360.com\nSubject: Kickoff\n  agenda\nDate: 4 Oct 2026\n\nBody')
    expect(wrapped).toMatchObject({ to: 'aakash@betacraft.io, priya@infer360.com', subject: 'Kickoff agenda', date: '2026-10-04', text: 'Body' })
    const early = emailFromText('From: Aparna\nSent: 4 Oct 2026\nTo: a@b.com,\n  c@d.com\nSubject: Kickoff\n\nBody')
    expect(early).toMatchObject({ subject: 'Kickoff', text: 'Body' })
    expect(emailFromText('From: **Aparna Rao**\nSubject: __Kickoff__\n\nBody')).toMatchObject({ from: 'Aparna Rao', subject: 'Kickoff' })
  })

  it('reads an export that starts with a byte-order mark', () => {
    expect(emailFromText('\ufeffFrom: Aparna <aparna@infer360.com>\r\nSubject: Kickoff\r\n\r\nBody')).toMatchObject({ from: 'Aparna <aparna@infer360.com>', subject: 'Kickoff', text: 'Body' })
  })

  it('is not fooled by ordinary notes', () => {
    expect(emailFromText('# Standup 4 Oct\n\nFrom: the client side, Aparna asked for SSO.')).toBeNull()
    expect(emailFromText('Notes\nFrom: me\nDate: today')).toBeNull()
    expect(emailFromText('From: Aparna')).toBeNull()
    expect(emailFromText('')).toBeNull()
  })
})

describe('.mbox (spec §23)', () => {
  const MBOX = [
    'From aparna@infer360.com Thu Oct  2 09:00:00 2026',
    THREAD.m1.replace('Also we need SSO.', 'Also we need SSO.\n>From here on we use SSO.\n\nFrom what I hear, the tenant is ready.'),
    '',
    'From aakash@betacraft.io Fri Oct  3 11:00:00 2026',
    THREAD.m2,
    '',
    'From aparna@infer360.com Sat Oct  4 10:12:00 2026',
    THREAD.m3,
    '',
  ].join('\r\n')

  it('splits on From_ lines and unescapes >From', () => {
    const parts = splitMbox(MBOX)
    expect(parts).toHaveLength(3)
    expect(parts[0].startsWith('From: "Aparna Rao"')).toBe(true)
    expect(parts[0]).toContain('\nFrom here on we use SSO.')
    expect(parts[0]).toContain('\nFrom what I hear, the tenant is ready.')
    expect(parts.map((p) => parseEml(p).messageId)).toEqual(['m1@infer360.com', 'm2@betacraft.io', 'm3@infer360.com'])
  })

  it('a file without From_ lines is one message; an empty one is none', () => {
    expect(splitMbox('From: a@b.com\nSubject: x\n\nbody')).toEqual(['From: a@b.com\nSubject: x\n\nbody'])
    expect(splitMbox('\n\n')).toEqual([])
  })
})

describe('extractDoc and writeExtracted', () => {
  let dir
  const write = (rel, content) => {
    const abs = path.join(dir, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content)
    return abs
  }

  beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-extract-')) })
  afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  it('an .md email export takes sender, title and date from its header lines, de-quoted', async () => {
    const abs = write('comms/reply.md', 'From: Aparna Rao <aparna@infer360.com>\nDate: Sat, 4 Oct 2026 10:12\nSubject: Re: SSO setup\n\nTenant ID is 7f3c-22.\n\nOn Fri, 3 Oct 2026, Aakash wrote:\n> Please send the tenant ID.')
    expect(await extractDoc(abs, 'comms/reply.md', { kind: 'conversations' })).toEqual({
      rel: 'comms/reply.md', kind: 'conversations', date: '2026-10-04',
      sender: 'Aparna Rao <aparna@infer360.com>', title: 'Re: SSO setup', text: 'Tenant ID is 7f3c-22.',
    })
  })

  it('a note takes its title from the first heading and its date from the file name', async () => {
    const abs = write('notes/2026-10-01-standup.md', '\uFEFFIntro line\n\n## **Standup** with Infer360 ##\n\nTenant ID and SSO discussed.\n\n# Later heading')
    const doc = await extractDoc(abs, 'notes/2026-10-01-standup.md', { kind: 'overview' })
    expect(doc).toMatchObject({ date: '2026-10-01', title: 'Standup with Infer360', sender: '' })
    expect(doc.text.startsWith('Intro line')).toBe(true)
    expect((await extractDoc(write('notes/standup-20260930.txt', 'x'), 'notes/standup-20260930.txt', { kind: 'overview' })).date).toBe('2026-09-30')
  })

  it('a Windows note (CRLF or CR line endings) still takes its title from the first heading', async () => {
    const crlfNote = await extractDoc(write('notes/crlf.md', '# Kickoff notes\r\n\r\nWe agreed on SSO.\r\n'), 'notes/crlf.md', { kind: 'overview' })
    expect(crlfNote).toMatchObject({ title: 'Kickoff notes', text: '# Kickoff notes\n\nWe agreed on SSO.' })
    const crNote = await extractDoc(write('notes/cr.txt', 'Intro\r## SSO plan ##\rTenant first.'), 'notes/cr.txt', { kind: 'overview' })
    expect(crNote.title).toBe('SSO plan')
    const wide = write('notes/utf16.md', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('# Budget ₹\r\n\r\nPhase 2.', 'utf16le')]))
    expect((await extractDoc(wide, 'notes/utf16.md', { kind: 'overview' })).title).toBe('Budget ₹')
  })

  it('takes the first real date in the file name, passing over an id that only looks like one', async () => {
    const abs = write('notes/12345678-2026-10-04.md', 'Standup')
    expect((await extractDoc(abs, 'notes/12345678-2026-10-04.md', { kind: 'overview' })).date).toBe('2026-10-04')
    const both = write('notes/20261003 call 2026-10-04.md', 'Call')
    expect((await extractDoc(both, 'notes/20261003 call 2026-10-04.md', { kind: 'overview' })).date).toBe('2026-10-03')
  })

  it('without a date in the email or the name, uses the file date; title falls back to the file name', async () => {
    const abs = write('plain notes.txt', 'Just some text')
    const when = new Date(2026, 8, 15, 12, 0, 0)
    fs.utimesSync(abs, when, when)
    expect(await extractDoc(abs, 'plain notes.txt', { kind: 'reference' })).toMatchObject({ date: '2026-09-15', title: 'plain notes', text: 'Just some text' })
  })

  it('reads non-UTF-8 text as latin1 and strips a BOM, never throwing', async () => {
    const latin = write('latin.txt', Buffer.from('Caf\xe9 au lait, cr\xe8me br\xfbl\xe9e', 'latin1'))
    expect((await extractDoc(latin, 'latin.txt', { kind: 'reference' })).text).toBe('Café au lait, crème brûlée')
    const bom = write('bom.md', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Héllo')]))
    expect((await extractDoc(bom, 'bom.md', { kind: 'reference' })).text).toBe('Héllo')
    const utf16 = write('utf16.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Wide ₹', 'utf16le')]))
    expect((await extractDoc(utf16, 'utf16.txt', { kind: 'reference' })).text).toBe('Wide ₹')
  })

  it('reads .eml (de-quoted, newest text only) and keeps a bare forward rather than emptying it', async () => {
    const doc = await extractDoc(write('comms/m2.eml', THREAD.m2), 'comms/m2.eml', { kind: 'conversations' })
    expect(doc).toMatchObject({ date: '2026-10-03', sender: 'Aakash <aakash@betacraft.io>', title: 'Re: SSO setup', text: 'Yes, the link ships Friday. Please send the tenant ID.' })
    const fwd = await extractDoc(write('comms/fwd.eml', 'From: a@b.com\nSubject: Fwd: SOW\n\n-----Original Message-----\nFrom: c@d.com\nThe SOW is signed.'), 'comms/fwd.eml', { kind: 'conversations' })
    expect(fwd.text).toContain('The SOW is signed.')
  })

  it('keeps the forwarded message of a Gmail, an Outlook and an Apple Mail forward', async () => {
    const gmail = await extractDoc(write('comms/gmail-fwd.eml', FORWARDS.gmail), 'comms/gmail-fwd.eml', { kind: 'conversations' })
    expect(gmail.text).toContain('FYI, see below.')
    expect(gmail.text).toContain('We need SSO with Azure AD by 15 Oct.')
    // The marker alone is enough when the subject lost its Fwd:.
    const unprefixed = await extractDoc(write('comms/gmail-fwd2.eml', FORWARDS.gmail.replace('Fwd: ', '')), 'comms/gmail-fwd2.eml', { kind: 'conversations' })
    expect(unprefixed.text).toContain('We need SSO with Azure AD by 15 Oct.')
    const outlook = await extractDoc(write('comms/outlook-fw.eml', FORWARDS.outlook), 'comms/outlook-fw.eml', { kind: 'conversations' })
    expect(outlook.text).toContain('Please review.')
    expect(outlook.text).toContain('Budget is ₹5,000 for phase 2.')
    const apple = await extractDoc(write('comms/apple-fwd.md', FORWARDS.appleMd), 'comms/apple-fwd.md', { kind: 'conversations' })
    expect(apple).toMatchObject({ sender: 'Aakash <aakash@betacraft.io>', title: 'Kickoff', date: '2026-10-05' })
    expect(apple.text).toContain('Adding Priya.')
    expect(apple.text).toContain('Kickoff is Monday 9am IST.')
  })

  it('a reply to a forward is still de-quoted', async () => {
    const reply = 'From: Aparna <aparna@infer360.com>\nSubject: Re: Fwd: SOW\nDate: 5 Oct 2026\n\nThanks!\n\nOn Sat, 4 Oct 2026 at 10:12, Aakash <a@b.io> wrote:\n> ---------- Forwarded message ---------\n> The SOW is attached.'
    expect(isForward(parseEml(reply))).toBe(false)
    expect((await extractDoc(write('comms/re-fwd.eml', reply), 'comms/re-fwd.eml', { kind: 'conversations' })).text).toBe('Thanks!')
  })

  it('removes quotes only from conversations (spec §3 B 9): an approval elsewhere keeps the terms it quotes', async () => {
    const approval = 'From: Aparna <aparna@infer360.com>\nSubject: Re: SOW v2\nDate: 5 Oct 2026\n\nApproved.\n\nOn Sat, 4 Oct 2026 at 10:12, Aakash <a@b.io> wrote:\n> Phase 2: ₹5,000, 6 weeks, SSO included.'
    const abs = write('agreements/approval.eml', approval)
    expect((await extractDoc(abs, 'agreements/approval.eml', { kind: 'agreements' })).text).toBe('Approved.\n\nOn Sat, 4 Oct 2026 at 10:12, Aakash <a@b.io> wrote:\n> Phase 2: ₹5,000, 6 weeks, SSO included.')
    expect((await extractDoc(abs, 'agreements/approval.eml', { kind: 'conversations' })).text).toBe('Approved.')
    const md = write('reference/approval.md', approval)
    expect((await extractDoc(md, 'reference/approval.md', { kind: 'reference' })).text).toContain('6 weeks, SSO included.')
    expect((await extractDoc(md, 'reference/approval.md')).text).toContain('6 weeks, SSO included.')
  })

  it('renders every .mbox message like a thread', async () => {
    const mbox = ['From a Thu Oct  2 09:00:00 2026', THREAD.m1, '', 'From b Fri Oct  3 11:00:00 2026', THREAD.m2, '', 'From c Sat Oct  4 10:12:00 2026', THREAD.m3].join('\n')
    const doc = await extractDoc(write('comms/all.mbox', mbox), 'comms/all.mbox', { kind: 'conversations' })
    expect(doc).toMatchObject({ date: '2026-10-04', sender: 'Aparna Rao <aparna@infer360.com>', title: 'RE: SSO setup' })
    expect(doc.text.startsWith('Subject: SSO setup\n\nFrom: Aparna Rao <aparna@infer360.com> · 2026-10-02')).toBe(true)
    expect(doc.text).toContain('From: Aakash <aakash@betacraft.io> · 2026-10-03\nYes, the link ships Friday. Please send the tenant ID.\n\nFrom: Aparna')
    expect(doc.text).not.toContain('wrote:')
  })

  it('an .mbox outside conversations keeps the quotes of its older messages, as an .eml does', async () => {
    const approval = 'From: Aparna <aparna@infer360.com>\nSubject: Re: SOW v2\nDate: Sun, 5 Oct 2026 09:00:00 +0530\nMessage-ID: <a1@infer360.com>\n\nApproved.\n\nOn Sat, 4 Oct 2026 at 10:12, Aakash <a@b.io> wrote:\n> Phase 2: ₹5,000, 6 weeks, SSO included.'
    const thanks = 'From: Aakash <a@b.io>\nSubject: Re: SOW v2\nDate: Mon, 6 Oct 2026 09:00:00 +0530\nIn-Reply-To: <a1@infer360.com>\n\nThanks, starting Monday.'
    const mbox = ['From a Sun Oct  5 09:00:00 2026', approval, '', 'From b Mon Oct  6 09:00:00 2026', thanks].join('\n')
    const abs = write('agreements/sow.mbox', mbox)
    const kept = await extractDoc(abs, 'agreements/sow.mbox', { kind: 'agreements' })
    expect(kept.text).toContain('Approved.\n\nOn Sat, 4 Oct 2026 at 10:12, Aakash <a@b.io> wrote:\n> Phase 2: ₹5,000, 6 weeks, SSO included.')
    expect(kept.text.endsWith('Thanks, starting Monday.')).toBe(true)
    expect((await extractDoc(abs, 'agreements/sow.mbox')).text).toContain('6 weeks, SSO included.')
    const dequoted = await extractDoc(abs, 'agreements/sow.mbox', { kind: 'conversations' })
    expect(dequoted.text).not.toContain('6 weeks')
    expect(dequoted.text).toContain('Approved.')
  })

  it('strips .html to text on any platform, with its <title>', async () => {
    const abs = write('ref/page.html', Buffer.from('<html><head><meta charset="iso-8859-1"><title>SOW &amp; plan</title><style>b{}</style></head><body><h1>Caf\xe9</h1><p>Phase&nbsp;2</p></body></html>', 'latin1'))
    for (const platform of [darwin, win32]) {
      expect(await extractDoc(abs, 'ref/page.html', { kind: 'reference', platform })).toMatchObject({ title: 'SOW & plan', text: 'Café\n\nPhase 2' })
    }
  })

  it('converts .docx/.rtf/.doc with textutil through execFile (argument array, 20 s, 20 MB)', async () => {
    const abs = write('agreements/SOW v2.docx', 'binary docx')
    const calls = []
    const execFileImpl = (cmd, args, opts, cb) => { calls.push([cmd, args, opts]); cb(null, Buffer.from('Statement of work\n\nPhase 2 budget ₹5,000\n')) }
    const doc = await extractDoc(abs, 'agreements/SOW v2.docx', { kind: 'agreements', platform: darwin, execFileImpl })
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe('/usr/bin/textutil')
    expect(calls[0][1]).toEqual(['-convert', 'txt', '-stdout', abs])
    expect(calls[0][2]).toMatchObject({ timeout: 20000, maxBuffer: 20 * 1024 * 1024 })
    expect(doc).toMatchObject({ kind: 'agreements', title: 'SOW v2', sender: '', text: 'Statement of work\n\nPhase 2 budget ₹5,000' })
  })

  it('a failed conversion, Windows, an empty file, an unknown type or a missing file give null', async () => {
    const abs = write('agreements/old.rtf', '{\\rtf1}')
    const failing = (cmd, args, opts, cb) => cb(new Error('timed out'))
    expect(await extractDoc(abs, 'agreements/old.rtf', { kind: 'agreements', platform: darwin, execFileImpl: failing })).toBeNull()
    const throwing = () => { throw new Error('ENOENT') }
    expect(await extractDoc(abs, 'agreements/old.rtf', { kind: 'agreements', platform: darwin, execFileImpl: throwing })).toBeNull()
    let called = false
    expect(await extractDoc(abs, 'agreements/old.rtf', { kind: 'agreements', platform: win32, execFileImpl: () => { called = true } })).toBeNull()
    expect(called).toBe(false)
    expect(await extractDoc(write('empty.md', ' \n\n '), 'empty.md', { kind: 'reference' })).toBeNull()
    expect(await extractDoc(write('pic.png', 'x'), 'pic.png', { kind: 'reference' })).toBeNull()
    expect(await extractDoc(path.join(dir, 'gone.md'), 'gone.md', { kind: 'reference' })).toBeNull()
  })

  it('writeExtracted mirrors rel under the text folder and refuses anything outside it', () => {
    const textDir = path.join(dir, 'cache', 'text')
    writeExtracted(textDir, 'comms/2026/reply.eml', 'first')
    writeExtracted(textDir, 'comms/2026/reply.eml', 'second')
    expect(fs.readFileSync(path.join(textDir, 'comms', '2026', 'reply.eml.txt'), 'utf8')).toBe('second')
    writeExtracted(textDir, 'top.md', 'Tenant ₹')
    expect(fs.readFileSync(path.join(textDir, 'top.md.txt'), 'utf8')).toBe('Tenant ₹')
    for (const bad of ['../escape.md', 'a/../../escape.md', path.join(dir, 'abs.md'), '', '..']) {
      expect(() => writeExtracted(textDir, bad, 'x')).toThrow(/outside the text folder/)
    }
    expect(fs.existsSync(path.join(dir, 'cache', 'escape.md.txt'))).toBe(false)
    expect(fs.existsSync(path.join(dir, 'abs.md.txt'))).toBe(false)
  })
})

describe('malformed input stays linear (files run on the main process, up to 2 MB)', () => {
  // Each of these took 1.6–32 s before; linear work on them takes a few milliseconds.
  const LIMIT_MS = 1000

  it('HTML with thousands of unclosed comments, list items, tags or raw-text elements', () => {
    for (const html of ['<!--a'.repeat(50000), '<li'.repeat(50000), '<a'.repeat(60000), '<script'.repeat(50000), '<title'.repeat(50000), '<div class="x'.repeat(30000)]) {
      expect(elapsed(() => htmlToText(html))).toBeLessThan(LIMIT_MS)
    }
    // Unclosed raw-text elements hide the rest, as in a browser; text before them stays.
    expect(htmlToText('<p>Kept</p><!-- never closed <p>hidden')).toBe('Kept')
    expect(htmlToText('<p>Kept</p><style>p{}')).toBe('Kept')
    expect(htmlToText('<head><meta charset="utf-8"><title>T</title></head><body><p>Body</p>')).toBe('Body')
  })

  it('an .html file of unclosed comments or titles', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-linear-'))
    try {
      for (const [name, html] of [['comments.html', '<!--a'.repeat(60000)], ['titles.html', '<title'.repeat(50000)], ['heading.md', `# ${'#'.repeat(200000)}x`]]) {
        const abs = path.join(dir, name)
        fs.writeFileSync(abs, html)
        const start = performance.now()
        await extractDoc(abs, name, { kind: 'reference' })
        expect(performance.now() - start).toBeLessThan(LIMIT_MS)
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('a huge From header, in an .eml or an .md export', () => {
    expect(elapsed(() => parseEml(`From: ${'a'.repeat(200000)}\n\nx`))).toBeLessThan(LIMIT_MS)
    expect(elapsed(() => parseEml(`From: ${'a@'.repeat(100000)}\n\nx`))).toBeLessThan(LIMIT_MS)
    expect(elapsed(() => parseEml(`From: <${'a@'.repeat(100000)}\n\nx`))).toBeLessThan(LIMIT_MS)
    expect(elapsed(() => emailFromText(`From: ${'a'.repeat(200000)}\nDate: 4 Oct 2026\n\nx`))).toBeLessThan(LIMIT_MS)
    // Bare addresses are still found.
    expect(parseEml('From: team@infer360.com.\n\nx').fromAddress).toBe('team@infer360.com')
    expect(parseEml('From: Aparna (aparna@Infer360.com)\n\nx').fromAddress).toBe('aparna@infer360.com')
    expect(parseEml('From: not-an-address@localhost\n\nx').fromAddress).toBe('')
  })

  it('long runs of spaces, "Re: " prefixes, attributions and dashes', () => {
    expect(elapsed(() => parseEml(`Content-Transfer-Encoding: quoted-printable\n\n${' '.repeat(200000)}x`))).toBeLessThan(LIMIT_MS)
    expect(elapsed(() => parseEml(`Content-Type: multipart/mixed; boundary=b\n\n--b\n\n${' '.repeat(200000)}x\n--b--`))).toBeLessThan(LIMIT_MS)
    // Boundary guessing over thousands of "--token" lines, and entity names that never close.
    expect(elapsed(() => parseEml(`Content-Type: multipart/mixed\n\n${Array.from({ length: 50000 }, (_, i) => `--t${i}\n`).join('\n')}`))).toBeLessThan(LIMIT_MS)
    expect(elapsed(() => htmlToText(`&${'a1'.repeat(200000)} ${'&a1'.repeat(100000)}`))).toBeLessThan(LIMIT_MS)
    expect(elapsed(() => threadMessages([parseEml(`Subject: ${'Re: '.repeat(50000)}x\n\nb`)]))).toBeLessThan(LIMIT_MS)
    expect(threadMessages([{ subject: `${'Re: '.repeat(50000)}SSO`, text: 'x' }])[0].subject).toBe('SSO')
    expect(elapsed(() => stripQuoted('On 1 Oct 2026, A wrote:\n> q\n'.repeat(50000)))).toBeLessThan(LIMIT_MS)
    expect(elapsed(() => stripQuoted(`Am 1${' schrieb'.repeat(40)}\n`.repeat(20000)))).toBeLessThan(LIMIT_MS)
    expect(elapsed(() => isoDate('('.repeat(200000)))).toBeLessThan(LIMIT_MS)
  })

  it('a 4,000-message thread renders without re-measuring every block each step', () => {
    const thread = { messages: Array.from({ length: 4000 }, (_, i) => ({ from: 'A', date: '2026-10-01', text: `${'x'.repeat(500)} ${i}` })) }
    let out
    expect(elapsed(() => { out = renderThread(thread) })).toBeLessThan(LIMIT_MS)
    expect(Buffer.byteLength(out)).toBeLessThanOrEqual(12000)
    expect(out.endsWith('x 3999')).toBe(true)
  })
})

describe('source hygiene', () => {
  it('email.js and extract.js hold no invisible literal characters (they are written as \\u escapes)', () => {
    const invisible = /[\u00a0\u00ad\u061c\u180e\u2000-\u200f\u2028-\u202f\u205f-\u2069\u3000\ufe00-\ufe0f\ufeff\ufffd]/
    for (const file of ['../main/projects/email.js', '../main/projects/extract.js']) {
      const lines = fs.readFileSync(new URL(file, import.meta.url), 'utf8').split('\n')
      expect(lines.filter((l) => invisible.test(l))).toEqual([])
    }
  })
})

describe('platform seam: extractTextCommand', () => {
  it('macOS converts Word and RTF with textutil; nothing else', () => {
    for (const ext of ['.docx', '.rtf', '.doc', '.DOCX']) {
      expect(darwin.extractTextCommand(ext, '/p/a file')).toEqual(['/usr/bin/textutil', ['-convert', 'txt', '-stdout', '/p/a file']])
    }
    for (const ext of ['.md', '.html', '.pdf', '']) expect(darwin.extractTextCommand(ext, '/p/x')).toBeNull()
  })

  it('Windows has no converter yet', () => {
    for (const ext of ['.docx', '.rtf', '.doc', '.md']) expect(win32.extractTextCommand(ext, 'C:\\p\\x')).toBeNull()
    expect(typeof win32.extractTextCommand).toBe(typeof darwin.extractTextCommand)
  })
})
