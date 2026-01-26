/**
 * Interface for HttpException response when it's an object
 */
export interface HttpExceptionResponse {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

/**
 * Type guard to check if exception response is an object with message property
 */
export function isHttpExceptionResponse(
  response: unknown,
): response is HttpExceptionResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'message' in response &&
    (typeof (response as HttpExceptionResponse).message === 'string' ||
      Array.isArray((response as HttpExceptionResponse).message))
  );
}
