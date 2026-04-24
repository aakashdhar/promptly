'use strict';

module.exports = [
  {
    files: ['main.js', 'preload.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'error',
      'no-console': 'warn',
      'no-undef': 'error',
    },
  },
  {
    files: ['index.html'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        WebkitSpeechRecognition: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'error',
      'no-console': 'warn',
      'no-undef': 'error',
    },
  },
];
