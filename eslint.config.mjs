// Lint config for the game source. No dependencies beyond eslint itself:
//   npx eslint src/
// The rules here are the ones that actually catch bugs in a graphics codebase —
// undefined identifiers, unreachable code, duplicate keys, bad typeof.
import globals from 'globals';

export default [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.worker },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-duplicate-case': 'error',
      'no-func-assign': 'error',
      'no-redeclare': 'error',
      'no-self-assign': 'error',
      'no-unreachable': 'error',
      'no-unsafe-negation': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-cond-assign': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-fallthrough': 'error',
    },
  },
];
