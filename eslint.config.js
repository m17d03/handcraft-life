import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

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
  // ADR 0001/0002: Spiellogik bleibt engine- und DOM-frei; three nur im Render-Adapter.
  {
    files: ['src/core/**/*.ts', 'src/modules/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['three', 'three/*'], message: 'Spiellogik importiert keine Engine (ADR 0001/0002).' }, { group: ['**/render/**', '**/input/**', '**/ui/**'], message: 'Spiellogik kennt weder Darstellung noch Eingabe.' }] }],
      'no-restricted-globals': ['error', 'document', 'window', 'navigator'],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/render/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['three', 'three/*'], message: 'three nur in src/render/ (ADR 0001).' }] }],
    },
  },
  {
    files: ['src/core/save/**/*.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  { files: ['eslint.config.js'], ...tseslint.configs.disableTypeChecked },
);
