'use strict';

// macOS is the only supported platform today. When Windows lands, add win32.js with
// the same exports and select it here on process.platform === 'win32'.
module.exports = require('./darwin');
