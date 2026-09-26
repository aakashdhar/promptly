// What the fake Claude answers in Harness mode: a loop plan, a pipeline plan, and the files.

export const HARNESS_LOOP = JSON.stringify({
  name: 'Nightly test fixer',
  shape: 'loop',
  summary: 'Fixes failing tests one at a time every night, and stops when they all pass or it gets stuck.',
  goal: 'Every test passes on a fresh run of the test command.',
  steps: [
    { title: 'Pick', detail: 'The next failing test' },
    { title: 'Fix', detail: 'Smallest change, diff reviewed' },
    { title: 'Check', detail: 'Run the test command' },
    { title: 'Record', detail: 'Log it, commit if green' },
  ],
  checks: [{ name: 'Tests', command: 'npm test' }],
  stopWhen: [
    { kind: 'done', text: 'All tests pass' },
    { kind: 'stuck', text: 'A test still fails after 3 tries' },
    { kind: 'limit', text: '25 passes or 2 hours' },
  ],
  never: ['Edit db/migrations/', 'Delete, skip or loosen a test'],
  onFailure: 'Try again, up to 3 times per test',
  roles: [{ name: 'reviewer', job: 'Reads each diff before commit' }],
  gaps: [
    { id: 'test_command', label: 'Test command', example: 'npm test' },
    { id: 'branch', label: 'Work on branch', example: 'fix/nightly-tests' },
  ],
  schedule: 'Every night at 2:00 AM',
})

export const HARNESS_PIPELINE = JSON.stringify({
  name: 'TypeScript migration',
  shape: 'pipeline',
  summary: 'Plans the modules once, converts them with three agents in parallel, and merges only what passes every check.',
  goal: 'tsc reports no errors and every test passes on main.',
  steps: [
    { title: 'Planner', detail: 'Sorts 14 modules by imports', runs: 'once' },
    { title: 'Workers', detail: 'Convert one module each', parallel: 3 },
    { title: 'Merge', detail: 'Rebase on main, fast-forward' },
  ],
  checks: [
    { name: 'Type check', command: 'npx tsc --noEmit' },
    { name: 'Tests', command: 'npm test' },
    { name: 'No new any', command: 'grep' },
    { name: 'Reviewer agent', command: '' },
  ],
  stopWhen: [
    { kind: 'done', text: 'Queue empty, type check clean' },
    { kind: 'stuck', text: 'A module fails twice: skip it' },
    { kind: 'limit', text: '3 hours in total' },
  ],
  never: ['Add any or @ts-ignore', 'Change what a test expects', 'Push to the remote'],
  onFailure: 'Back to the queue. The second time, skip it and notify you.',
  roles: [{ name: 'reviewer', job: 'Rejects weak types or changed behaviour' }],
  gaps: [
    { id: 'test_command', label: 'Test command', example: 'npm test' },
    { id: 'strict', label: 'Strict mode', example: 'on' },
    { id: 'merge_into', label: 'Merge into', example: 'main' },
  ],
  schedule: '',
})

export const HARNESS_FILES = [
  'RUN: bash .harness/loop.sh',
  'SCHEDULE: daily 02:00',
  '=== FILE .harness/loop.sh ===',
  'PURPOSE: Runs the passes',
  '#!/bin/bash',
  '# Nightly test fixer. Stops when green, stuck, or out of passes.',
  'git switch fix/nightly-tests',
  'for pass in $(seq 1 25); do',
  '  claude -p "$(cat .harness/PROMPT.md)" --model sonnet --permission-mode acceptEdits --max-turns 40',
  '  if npm test --silent; then echo "All green after pass $pass" >> .harness/PROGRESS.md; exit 0; fi',
  '  grep -q "^STUCK" .harness/PROGRESS.md && exit 2',
  'done',
  '=== END ===',
  '=== FILE .harness/PROMPT.md ===',
  'PURPOSE: What each pass does',
  '## Each pass',
  '1. Read .harness/PROGRESS.md. Pick the first failing test not marked SKIPPED.',
  '2. Make the smallest change that makes it pass. Fix the code, not the test.',
  '3. Ask the reviewer agent to read your diff before you commit.',
  '=== END ===',
  '=== FILE .harness/PROGRESS.md ===',
  'PURPOSE: Memory between passes',
  '# Nightly test fixer',
  '| Test | Try | Change | Result |',
  '|------|-----|--------|--------|',
  '=== END ===',
].join('\n')
