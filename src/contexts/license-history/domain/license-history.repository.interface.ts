import { LicenseHistory } from './license-history.entity'

export abstract class LicenseHistoryRepository {
  abstract create(
    licenseHistory: Pick<
      LicenseHistory,
      'licenseId' | 'oldStatus' | 'newStatus'
    >,
  ): Promise<void>
}
