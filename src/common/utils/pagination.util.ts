import { ConfigService } from '@nestjs/config';
import { PaginatedResult } from '../dto/pagination.dto';

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Utility class for handling pagination logic consistently across services
 */
export class PaginationHelper {
  /**
   * Calculate pagination parameters from page and limit inputs
   * @param configService - ConfigService instance to get default values
   * @param page - Optional page number (1-indexed)
   * @param limit - Optional limit per page
   * @returns PaginationOptions with calculated values
   */
  static getPaginationOptions(
    configService: ConfigService,
    page?: number,
    limit?: number,
  ): PaginationOptions {
    const defaultPage =
      configService.get<number>('app.pagination.defaultPage') || 1;
    const defaultLimit =
      configService.get<number>('app.pagination.defaultLimit') || 10;
    const maxLimit =
      configService.get<number>('app.pagination.maxLimit') || 100;

    // Validate page: must be >= 1
    if (page !== undefined && page < 1) {
      throw new Error('Page must be greater than or equal to 1');
    }

    // Validate limit: must be >= 1
    if (limit !== undefined && limit < 1) {
      throw new Error('Limit must be greater than or equal to 1');
    }

    const pageNum = page || defaultPage;
    const limitNum = Math.min(limit || defaultLimit, maxLimit);
    const skip = (pageNum - 1) * limitNum;

    // Additional validation: skip cannot be negative
    if (skip < 0) {
      throw new Error('Invalid pagination parameters: skip cannot be negative');
    }

    return {
      page: pageNum,
      limit: limitNum,
      skip,
    };
  }

  /**
   * Create paginated result from data array and total count
   * @param data - Array of data items
   * @param total - Total count of items
   * @param page - Current page number
   * @param limit - Items per page
   * @returns PaginatedResult with data and metadata
   */
  static createPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }
}
