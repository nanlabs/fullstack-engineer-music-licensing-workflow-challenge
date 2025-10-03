import tsConfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'

import { createVitestTestConfig } from './create-vitest-config'
import { alias } from './utils/alias'

export default defineConfig({
  test: createVitestTestConfig(),
  resolve: {
    alias,
  },
  plugins: [swc.vite(), tsConfigPaths()],
})
