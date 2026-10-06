'use strict';
// Runs the tests that need node:sqlite under Electron's own Node (24), the one the app uses:
// the Node on PATH may be older and lack node:sqlite. Works the same on macOS and Windows.
const { spawnSync } = require('child_process');
const path = require('path');
const electron = require('electron');
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['tests/projects-search.test.js'];
const vitest = path.join(__dirname, '..', 'node_modules', 'vitest', 'vitest.mjs');
const r = spawnSync(electron, [vitest, 'run', ...files], { stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
process.exit(r.status === null ? 1 : r.status);
