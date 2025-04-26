// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {    
      
      // 🔧 Permitir argumentos sin validación de tipo
      '@typescript-eslint/no-unsafe-argument': 'off',

      // 🔧 Permitir funciones vacías (útil en stubs)
      '@typescript-eslint/no-empty-function': 'off',

      // 🔧 Permitir variables sin usar (útil en destructuring parcial)
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],

      // 🔧 Permitir console.log en desarrollo
      'no-console': 'off',

      // 🔧 Desactivar preferencia por const (más flexible al declarar)
      'prefer-const': 'off',

      // ✨ Habilitar Prettier como guía de formato
      'prettier/prettier': ['warn'],
    },
  },
);
