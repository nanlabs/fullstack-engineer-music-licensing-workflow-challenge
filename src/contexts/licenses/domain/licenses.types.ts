import { LicenseStatus } from '@/src/app/database/types'

export type LicenseStatusEvent = {
  licenseId: number
  newStatus: LicenseStatus
  updatedAt: Date
}
