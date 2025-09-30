export enum LicensingStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  NEGOTIATING = 'negotiating',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export const LICENSING_STATUS_TRANSITIONS: Record<LicensingStatus, LicensingStatus[]> = {
  [LicensingStatus.PENDING]: [LicensingStatus.IN_REVIEW, LicensingStatus.REJECTED],
  [LicensingStatus.IN_REVIEW]: [LicensingStatus.NEGOTIATING, LicensingStatus.APPROVED, LicensingStatus.REJECTED],
  [LicensingStatus.NEGOTIATING]: [LicensingStatus.APPROVED, LicensingStatus.REJECTED, LicensingStatus.IN_REVIEW],
  [LicensingStatus.APPROVED]: [LicensingStatus.EXPIRED],
  [LicensingStatus.REJECTED]: [LicensingStatus.PENDING],
  [LicensingStatus.EXPIRED]: [LicensingStatus.PENDING],
};