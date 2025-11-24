import { BadRequestException } from '@nestjs/common';

export class InvalidStateTransitionException extends BadRequestException {
  constructor(currentState: string, attemptedState: string) {
    const message = `Cannot transition from ${currentState} to ${attemptedState}`;

    super({
      statusCode: 400,
      code: 'INVALID_STATE_TRANSITION',
      message,
      currentState,
      attemptedState,
      timestamp: new Date().toISOString(),
    });
  }
}
