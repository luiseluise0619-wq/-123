export default [
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script' },
    rules: {
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-else-if': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-self-compare': 'error',
      'no-constant-condition': 'error',
      'no-sparse-arrays': 'error',
      'no-cond-assign': 'error',
      'no-fallthrough': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-compare-neg-zero': 'error',
      'no-unsafe-negation': 'error',
      'no-unused-private-class-members': 'error',
      'no-async-promise-executor': 'error',
      'require-atomic-updates': 'warn',
      'no-prototype-builtins': 'off'
    }
  }
];
