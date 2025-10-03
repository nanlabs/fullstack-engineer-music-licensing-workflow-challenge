import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import unusedImports from 'eslint-plugin-unused-imports'
import perfectionist from 'eslint-plugin-perfectionist'
import vitest from '@vitest/eslint-plugin'
import tseslint from 'typescript-eslint'
import eslint from '@eslint/js'
export default tseslint.config([
  {
    ignores: [
      '**/dist/',
      '**/node_modules/',
      '**/coverage/',
      '**/docker/',
      '**/scripts/',
      '**/tools/',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@/no-restricted-properties': [
        'error',
        {
          object: 'console',
          property: 'log',
          message: 'Avoid using console.log(). Remove it before committing.',
        },
        {
          object: 'console',
          property: 'warn',
          message: 'Avoid using console.warn(). Remove it before committing.',
        },
        {
          object: 'console',
          property: 'error',
          message: 'Avoid using console.error(). Remove it before committing.',
        },
        {
          object: 'console',
          property: 'dir',
          message: 'Avoid using console.dir(). Remove it before committing.',
        },
      ],
      '@typescript-eslint/no-namespace': ['off'],
    },
  },
  {
    plugins: {
      perfectionist,
    },
    rules: {
      'perfectionist/sort-imports': [
        'error',
        {
          type: 'line-length',
          order: 'desc',
        },
      ],
      'perfectionist/sort-named-imports': [
        'error',
        {
          type: 'line-length',
          order: 'desc',
        },
      ],
    },
  },
  {
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/max-nested-describe': ['error', { max: 3 }],
      '@/no-restricted-properties': [
        'error',
        {
          object: 'test',
          property: 'only',
          message: 'Avoid using test.only(). Remove it before committing.',
        },
        {
          object: 'test',
          property: 'skip',
          message: 'Avoid using test.skip(). Remove it before committing.',
        },
        {
          object: 'describe',
          property: 'only',
          message: 'Avoid using describe.only(). Remove it before committing.',
        },
        {
          object: 'describe',
          property: 'skip',
          message: 'Avoid using describe.skip(). Remove it before committing.',
        },
        {
          object: 'it',
          property: 'only',
          message: 'Avoid using it.only(). Remove it before committing.',
        },
        {
          object: 'it',
          property: 'skip',
          message: 'Avoid using it.skip(). Remove it before committing.',
        },
      ],
    },
    plugins: {
      vitest,
    },
    files: ['tests/**'],
  },
  {
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
  eslintPluginPrettierRecommended,
])
