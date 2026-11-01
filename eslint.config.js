import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Alle Browser-Globals ausser denen, die auch in reinem JS/Node existieren (B4, QA Ticket 008).
const sprachGlobals = new Set([...Object.keys(globals.es2021), ...Object.keys(globals['shared-node-browser'])]);
const browserNurGlobals = [
  ...Object.keys(globals.browser).filter((g) => !sprachGlobals.has(g)),
  'localStorage', 'sessionStorage', 'indexedDB', 'navigator',
].filter((g, i, a) => a.indexOf(g) === i);

export default tseslint.config(
  { ignores: ['.claude/', 'dist/', 'node_modules/', 'test-results/', 'playwright-report/', 'public/konzepte/'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { project: ['./tsconfig.json', './tsconfig.node.json'], tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/render/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['three', 'three/*'], message: 'three nur in src/render/ (ADR 0001).' }] }],
    },
  },
  // ADR 0001/0002: Spiellogik bleibt engine- und DOM-frei; three nur im Render-Adapter.
  {
    files: ['src/core/**/*.ts', 'src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['three', 'three/*'], message: 'Spiellogik importiert keine Engine (ADR 0001/0002).' }, { group: ['**/render/**', '**/input/**', '**/ui/**'], message: 'Spiellogik kennt weder Darstellung noch Eingabe.' }] }],
      'no-restricted-globals': ['error', ...browserNurGlobals],
    },
  },
  {
    files: ['src/core/save/**/*.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  { files: ['eslint.config.js'], ...tseslint.configs.disableTypeChecked },
);
