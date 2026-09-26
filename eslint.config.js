const js = require('@eslint/js');
const globals = require('globals');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const tseslint = require('typescript-eslint');

const sharedGlobals = {
  ...globals.browser,
  ...globals.node,
  ...globals.es2022,
  React: 'readonly',
};

module.exports = [
  {
    ignores: [
      'node_modules/**',
      '.vercel/**',
      'dist-capacitor/**',
      'dist-electron/**',
      'android/.gradle/**',
      'android/**/build/**',
      'android/app/src/main/assets/public/**',
      'android/capacitor-cordova-android-plugins/**',
      'public/app.js',
      'public/core.js',
      'public/landing.js',
      'public/dist.css',
      'public/vendor/**',
      'src-tauri/binaries/**',
      'src-tauri/gen/**',
      'src-tauri/target/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...sharedGlobals,
        ...globals.vitest,
        ReactDOM: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-constant-binary-expression': 'error',
      'no-control-regex': 'off',
      'no-promise-executor-return': 'error',
      'no-template-curly-in-string': 'error',
      'no-useless-escape': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['src/desktop/main.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['public/**/*.{jsx,tsx}', 'src/**/*.{jsx,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: '18.3' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    files: ['tests/**/*.js', '**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
    },
  },
];
