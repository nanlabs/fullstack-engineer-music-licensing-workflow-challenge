import { ParsedError } from './parse-error'

type ApplicationErrorPayload = {
  message: string
  statusCode: number
  detail?: ParsedError[]
}

/**
 * Throws an application-specific error with an optional overridden message.
 *
 * @param {ApplicationErrorPayload} errorPayload - The payload containing details like message, status code, and other metadata.
 * @throws {ApplicationError} Always throws an `ApplicationError` constructed from the payload and optional override message.
 */
export function throwError(
  errorPayload: ApplicationErrorPayload,
  options?: {
    overrideMessage?: string
    detail?: ParsedError[]
  },
): never {
  throw new ApplicationError({
    ...errorPayload,
    message: options?.overrideMessage ?? errorPayload.message,
    detail: options?.detail,
  })
}

/**
 * Represents a structured application error.
 * Extends the native Error class to include an HTTP status code.
 */
export class ApplicationError extends Error {
  private statusCode: number
  private detail?: ParsedError[]

  /**
   * @param {ApplicationErrorPayload} payload - The payload containing the error message and status code.
   */
  constructor({ message, statusCode, detail }: ApplicationErrorPayload) {
    super()
    this.message = message
    this.statusCode = statusCode
    this.detail = detail
  }

  /**
   * Returns the HTTP status code associated with the error.
   * @returns {number}
   */
  getStatus(): number {
    return this.statusCode
  }

  /**
   * Returns the error message.
   * @returns {string}
   */
  getReasons(): string {
    return this.message
  }

  getReasonsDetail(): ParsedError[] | undefined {
    return this.detail
  }
}
