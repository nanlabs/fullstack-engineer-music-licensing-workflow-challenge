import type { ErrorResponse, ErrorType } from '@/types'

/** Thrown by both the real HTTP client and the mock backend, so callers
 *  never need to know which mode is active. */
export class ApiError extends Error {
  code: string
  errorType: ErrorType
  status: number
  details?: Record<string, unknown>

  constructor(status: number, body: ErrorResponse) {
    super(body.message)
    this.name = 'ApiError'
    this.code = body.code
    this.errorType = body.error_type
    this.status = status
    this.details = body.details
  }

  static of(status: number, code: string, message: string, errorType: ErrorType, details?: Record<string, unknown>) {
    return new ApiError(status, { code, message, error_type: errorType, details })
  }
}
