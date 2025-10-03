import { resolve } from 'node:path'

export const r = (p: string) => resolve(process.cwd(), p)

export const alias: Record<string, string> = {
  '@/src/': r('src'),
  '@/shared/': r('src/contexts/shared/'),
  '@/http-api/*': r('src/http-api/'),
  '@/contexts/*': r('src/contexts/'),
  '@/tests/*': r('tests/'),
}
