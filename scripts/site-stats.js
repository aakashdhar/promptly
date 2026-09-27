'use strict';

// Recounts how Promptly was built and writes the numbers into the product site's
// "Built with the vibe skills" section (index.html, <dd data-count="…">). release.sh runs
// it before the release commit, so commits and releases count that commit too.
//   node scripts/site-stats.js [--dry-run]

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
// Only committed entries count, so drafts (a feature still being planned) don't inflate the numbers.
const dirCount = (dir, keep = () => true) => new Set(run('git', ['ls-files', '--', dir]).split('\n').filter(Boolean)
  .map((f) => f.slice(dir.length + 1).split('/')[0]).filter((f) => !f.startsWith('.') && keep(f))).size;

function unitTests() {
  // vitest's JSON report has the total; the suite takes a few seconds.
  try { return JSON.parse(run('npx', ['vitest', 'run', '--reporter=json'])).numTotalTests; } catch (err) {
    const out = err.stdout && err.stdout.toString();
    return out ? JSON.parse(out).numTotalTests : null;
  }
}

function e2eTests() {
  const m = run('npx', ['playwright', 'test', '--list']).match(/Total: (\d+) tests?/);
  return m ? Number(m[1]) : null;
}

const upcoming = 1; // the release commit about to be made
const stats = {
  commits: Number(run('git', ['rev-list', '--count', 'HEAD']).trim()) + upcoming,
  features: dirCount('vibe/features'),
  specReviews: dirCount('vibe/spec-reviews'),
  reviews: dirCount('vibe/reviews', (f) => f !== 'backlog.md'),
  bugs: dirCount('vibe/bugs'),
  tests: null,
  releases: run('git', ['log', '--oneline', '--grep=^chore(release)']).trim().split('\n').filter(Boolean).length + upcoming,
};
const unit = unitTests();
const e2e = e2eTests();
if (unit != null && e2e != null) stats.tests = unit + e2e;

// Labels in index.html, in page order, mapped to the numbers above.
const LABELS = {
  'Commits since 18 April 2026': stats.commits,
  'Feature specs written first': stats.features,
  'Spec reviews': stats.specReviews,
  'Code review gates': stats.reviews,
  'Bug fixes with a written diagnosis': stats.bugs,
  'Automated tests': stats.tests,
  'Releases': stats.releases,
};

const file = path.join(ROOT, 'index.html');
let html = fs.readFileSync(file, 'utf8');
for (const [label, value] of Object.entries(LABELS)) {
  if (value == null) { console.warn(`  ! kept "${label}" (couldn't count it)`); continue; }
  const re = new RegExp(`(<dt>${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</dt><dd data-count=")\\d+(">)\\d+(</dd>)`);
  if (!re.test(html)) throw new Error(`index.html has no stat labelled "${label}"`);
  html = html.replace(re, `$1${value}$2${value}$3`);
}

if (process.argv.includes('--dry-run')) console.log(JSON.stringify({ ...stats, unit, e2e }));
else { fs.writeFileSync(file, html); console.log(`  ✓ Site numbers: ${Object.entries(LABELS).map(([k, v]) => `${k.split(' ')[0].toLowerCase()} ${v}`).join(', ')}`); }
