import { loadEnv } from 'vite'

import { r } from './utils/alias'

export const createVitestTestConfig = () => {
  return {
    name: 'e2e',
    dir: 'tests/e2e',
    hookTimeout: 60_000,
    pool: 'forks',
    minWorkers: 1,
    maxWorkers: 3,
    deps: {
      interopDefault: false,
    },
    globalSetup: r('./tests/utils/vitest-setup.ts'),
    include: ['**/*.test.ts'],
    globals: true,
    env: loadEnv('test', process.cwd(), ''),
    coverage: {
      exclude: [
        './*.ts',
        './*.mts',
        'src/app',
        'src/main.ts',
        'src/**/infrastructure/controllers/*.module.ts',
        'src/contexts/shared',
        'tests',
      ],
    },
  }
}
