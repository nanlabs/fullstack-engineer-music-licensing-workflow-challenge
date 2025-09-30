import { registerEnumType } from '@nestjs/graphql';
import { LicensingStatus } from '../entities/enums/licensing-status.enum';

// Register enum for GraphQL
registerEnumType(LicensingStatus, {
  name: 'LicensingStatus',
  description: 'The licensing status of a track',
});