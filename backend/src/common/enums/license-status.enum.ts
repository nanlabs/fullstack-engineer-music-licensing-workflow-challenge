import { registerEnumType } from '@nestjs/graphql';

export enum LicenseStatusEnum {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  NEGOTIATING = 'negotiating',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

registerEnumType(LicenseStatusEnum, {
  name: 'LicenseStatusEnum',
  description: 'Status of a license request',
});
