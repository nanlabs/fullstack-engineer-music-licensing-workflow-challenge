import { ConflictException } from '@nestjs/common';

export class DuplicateResourceException extends ConflictException {
  constructor(resourceName: string, conflictingField: string, value: string) {
    const message = `${resourceName} with ${conflictingField} ${value} already exists`;

    super({
      statusCode: 409,
      code: 'DUPLICATE_RESOURCE',
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
