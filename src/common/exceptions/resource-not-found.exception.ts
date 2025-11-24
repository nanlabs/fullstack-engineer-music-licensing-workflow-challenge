import { NotFoundException } from '@nestjs/common';

export class ResourceNotFoundException extends NotFoundException {
  constructor(resourceName: string, identifier?: string) {
    const message = identifier
      ? `${resourceName} with ID ${identifier} not found`
      : `${resourceName} not found`;

    super({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
