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
  { files: ['eslint.config.js'], ...tseslint.configs.disableTypeChecked },
);
