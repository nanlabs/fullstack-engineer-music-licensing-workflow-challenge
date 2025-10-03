import { ExecutionContext, NestInterceptor, CallHandler } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { map } from 'rxjs/operators'
import { Observable } from 'rxjs'

import { PageSerializeDto, PageDto } from '../pagination/page-dto'

/**
 * Constructor type for a class.
 */
export interface ClassConstructor<T = unknown> {
  new (...args: unknown[]): T
}

/**
 * Interceptor that serializes outgoing responses using a DTO.
 * Can handle single objects or paginated results.
 */
export class SerializeInterceptor<T> implements NestInterceptor {
  /**
   * @param dto - The DTO class to serialize data into.
   * @param isPaginated - Whether the response is a paginated result.
   */
  constructor(
    private dto: ClassConstructor<T>,
    private isPaginated: boolean = false,
  ) {}

  /**
   * Intercepts the response and transforms it using the provided DTO.
   * @param _ - Execution context (not used).
   * @param handler - Call handler for the request.
   * @returns Observable with transformed data.
   */
  intercept(
    _: ExecutionContext,
    handler: CallHandler,
  ): Observable<{ data: T } | PageSerializeDto<T>> {
    if (this.isPaginated) {
      return handler.handle().pipe(
        map((data: PageDto<unknown>) => {
          const transformedItems = data.items.map(item =>
            this.transformData(item),
          )

          return new PageSerializeDto(
            transformedItems,
            data.count,
            data.pages,
            data.currentPage,
          )
        }),
      )
    }

    return handler.handle().pipe(
      map((raw: unknown) => {
        const transformedData = this.transformData(raw)
        return {
          data: transformedData,
        }
      }),
    )
  }

  /**
   * Transforms raw data into an instance of the DTO.
   * @param data - Raw data to transform.
   * @returns An instance of the DTO type.
   */
  private transformData(data: unknown): T {
    return plainToInstance(this.dto, data, {
      excludeExtraneousValues: true,
      exposeUnsetFields: false,
    })
  }
}
