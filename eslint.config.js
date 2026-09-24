'use strict';

const globals = require('globals');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');

const baseRules = {
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
  'no-console': 'warn',
  'no-undef': 'error',
};

module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', 'dist-renderer/**', 'vibe/**', 'memory/**', 'build/**'],
  },
  {
    // Electron main process, preload, and Node scripts (CommonJS)
    files: ['main.js', 'preload.js', 'main/**/*.js', 'scripts/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: baseRules,
  },
  {
    // CLI scripts print their results
    files: ['scripts/**/*.js'],
    rules: { 'no-console': 'off' },
  },
  {
    // Build config and tests (ES modules on Node)
    files: ['vite.config.js', 'vitest.config.mjs', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: baseRules,
  },
  {
    // React renderer
    files: ['src/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...baseRules,
      'react/jsx-uses-vars': 'error',
      'react/jsx-key': 'error',
      'react/no-danger': 'error',
      'react-hooks/rules-of-hooks': 'error',
      // The app deliberately reads live values through refs inside mount-only effects;
      // keep this visible as a warning rather than forcing churn across every hook.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
