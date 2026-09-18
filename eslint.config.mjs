// ESLint 9 flat config. `pnpm lint` runs with --max-warnings=0, so a warning is
// a build failure — there is no "we'll clean it up later" tier.

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import next from '@next/eslint-plugin-next';

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'coverage/**',
      'captures/**',
      'next-env.d.ts',
      // Extracted portfolio source, kept as reference. Not part of the build.
      'design-system/references/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      '@next/next': next,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...next.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,

      // The App Router injects React; the classic runtime rules are noise.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // spec/05-scene-state-contract.md §1: scene code reads the store
      // imperatively inside useFrame. The exhaustive-deps rule cannot see that,
      // so it stays an error here and any exception is justified inline.
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  {
    files: ['scripts/**/*.ts', '*.mjs'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-console': 'off',
    },
  },
);
