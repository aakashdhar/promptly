#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const splashPath = path.join(__dirname, '..', 'splash.html');
const html = fs.readFileSync(splashPath, 'utf8');
let passed = 0;

function ok(msg) { console.log('  ✓ ' + msg); passed++; }
function fail(msg) {
  console.error('');
  console.error('  FAIL: ' + msg);
  console.error('');
  process.exit(1);
}

// ASSERT 1 — s1-notfound has manual path input
if (!html.includes('id="s1-manual-path"'))
  fail('s1-notfound state has no manual path input field. Users with non-standard installs have no escape hatch.');
ok('ASSERT 1: s1-notfound has manual path input (#s1-manual-path)');

// ASSERT 2 — s1-notresponding has manual path input
if (!html.includes('id="s1-notresponding-path"'))
  fail('s1-notresponding state has no manual path input field. This was BUG-NVM-PATH — users are completely stuck.');
ok('ASSERT 2: s1-notresponding has manual path input (#s1-notresponding-path)');

// ASSERT 3 — submit buttons exist for both path inputs
if (!html.includes('s1UseManualPath()'))
  fail('Manual path input exists but has no submit button (s1UseManualPath missing).');
if (!html.includes('s1NotrespondingUseManualPath()'))
  fail('Manual path input exists but has no submit button (s1NotrespondingUseManualPath missing).');
ok('ASSERT 3: submit buttons present for both path inputs');

// ASSERT 4 — "Check again" triggers on all dependency error screens
if (!html.includes('runScreen1()'))
  fail('Claude error state has no Check again button (runScreen1 missing as onclick).');
if (!html.includes('runScreen2()'))
  fail('Whisper/ffmpeg error state has no Check again button (runScreen2 missing as onclick).');
ok('ASSERT 4: Check again buttons present on all dependency error screens');

console.log('');
console.log('  All ' + passed + ' splash assertions passed.');
console.log('');
