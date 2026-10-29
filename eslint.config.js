// ESLint 9 keeps the Node 22.12 development floor; ESLint 10 requires Node 22.13.
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import prettier from 'eslint-config-prettier/flat'
import globals from 'globals'

export default defineConfigWithVueTs(
  {
    ignores: [
      '**/node_modules/**',
      'dist/**',
      'demo-dist/**',
      '**/.nuxt/**',
      '**/.output/**',
      'coverage/**',
      'output/**',
      '.mimosa/**',
      '.video_agent/**',
    ],
  },
  js.configs.recommended,
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // Optional typed props intentionally retain undefined (for example controlled page).
      'vue/require-default-prop': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['demo/**/*.vue', 'examples/**/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  { files: ['tests/**/*.ts'], rules: { 'vue/one-component-per-file': 'off' } },
  prettier,
)
