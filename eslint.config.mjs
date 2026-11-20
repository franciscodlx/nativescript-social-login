import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.build/**',
      '**/node_modules/**',
      '**/www/**',
      '**/.angular/**',
      '**/android/**',
      '**/ios/**',
      'tools/**',
      'examples/*/src/**/*.spec.ts',
      'examples/*/platforms/**',
      'examples/*/hooks/**',
      'examples/*/webpack.config.js',
      'examples/*/references.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  }
);
