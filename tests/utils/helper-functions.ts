import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'

import { APPLICATION_ERRORS } from '@/src/app/common/response-normalizer/errors'
import { parseError } from '@/src/shared/utils/parse-error'
import { LicenseStatus } from '@/src/app/database/types'

export function generateTransitionErrorMessage({
  from,
  to,
}: {
  from: LicenseStatus
  to: LicenseStatus
}) {
  return `Cannot change license from ${from} to ${to}`
}

export function generateValidatorError<T extends object>(
  dto: new () => T,
  payload: Record<string, unknown>,
) {
  const instance = plainToInstance(dto, payload)
  const errors = validateSync(instance)
  return {
    ...APPLICATION_ERRORS.INPUT.INVALID_INPUT_ERROR,
    validationErrors: parseError(errors),
  }
}
