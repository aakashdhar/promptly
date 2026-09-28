'use strict';

// darwin.js and win32.js export the same keys (tests/main.test.js checks this).
// Anything that isn't Windows gets the macOS module, exactly as before.
module.exports = process.platform === 'win32' ? require('./win32') : require('./darwin');
