import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  {
    // Core runs in a worker and in Node tests: only universal globals (no window, no fs).
    files: ['src/catalog.js', 'src/core/**/*.js'],
    languageOptions: { globals: { ...globals['shared-node-browser'] } },
  },
  { files: ['src/worker/**/*.js'], languageOptions: { globals: globals.worker } },
  { files: ['tests/**/*.js', '*.{js,mjs}'], languageOptions: { globals: globals.node } },
  {
    files: ['src/app/**/*.{js,jsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // page.evaluate() callbacks run in the browser
    files: ['**/*.test.{js,jsx}', 'tests/e2e/**/*.js', 'src/app/test-*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
