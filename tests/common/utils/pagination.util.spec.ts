import { ConfigService } from '@nestjs/config';
import { PaginationHelper } from '../../../src/common/utils/pagination.util';
import { BadRequestException } from '@nestjs/common';

describe('PaginationHelper', () => {
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, any> = {
          'app.pagination.defaultPage': 1,
          'app.pagination.defaultLimit': 10,
          'app.pagination.maxLimit': 100,
        };
        return config[key];
      }),
    } as any;
  });

  describe('getPaginationOptions', () => {
    it('should return default values when no parameters provided', () => {
      const result = PaginationHelper.getPaginationOptions(
        mockConfigService,
        undefined,
        undefined,
      );

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.skip).toBe(0);
    });

    it('should use provided page and limit', () => {
      const result = PaginationHelper.getPaginationOptions(
        mockConfigService,
        2,
        20,
      );

      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.skip).toBe(20);
    });

    it('should throw error for negative page', () => {
      expect(() => {
        PaginationHelper.getPaginationOptions(mockConfigService, -1, 10);
      }).toThrow('Page must be greater than or equal to 1');
    });

    it('should throw error for page 0', () => {
      expect(() => {
        PaginationHelper.getPaginationOptions(mockConfigService, 0, 10);
      }).toThrow('Page must be greater than or equal to 1');
    });

    it('should throw error for negative limit', () => {
      expect(() => {
        PaginationHelper.getPaginationOptions(mockConfigService, 1, -1);
      }).toThrow('Limit must be greater than or equal to 1');
    });

    it('should throw error for limit 0', () => {
      expect(() => {
        PaginationHelper.getPaginationOptions(mockConfigService, 1, 0);
      }).toThrow('Limit must be greater than or equal to 1');
    });

    it('should cap limit at maxLimit', () => {
      const result = PaginationHelper.getPaginationOptions(
        mockConfigService,
        1,
        200,
      );

      expect(result.limit).toBe(100); // Capped at maxLimit
    });

    it('should calculate skip correctly', () => {
      const result = PaginationHelper.getPaginationOptions(
        mockConfigService,
        3,
        20,
      );

      expect(result.skip).toBe(40); // (3 - 1) * 20
    });

    it('should handle very large page numbers', () => {
      const result = PaginationHelper.getPaginationOptions(
        mockConfigService,
        999999,
        10,
      );

      expect(result.page).toBe(999999);
      expect(result.skip).toBe(9999980);
    });

    it('should use config service defaults when not provided', () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = PaginationHelper.getPaginationOptions(
        mockConfigService,
        undefined,
        undefined,
      );

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe('createPaginatedResult', () => {
    it('should create paginated result correctly', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = PaginationHelper.createPaginatedResult(data, 25, 2, 10);

      expect(result.data).toEqual(data);
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(25);
      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPreviousPage).toBe(true);
    });

    it('should calculate hasNextPage correctly', () => {
      const data = [{ id: 1 }];
      const result = PaginationHelper.createPaginatedResult(data, 10, 1, 10);

      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(false);
    });

    it('should calculate hasPreviousPage correctly', () => {
      const data = [{ id: 1 }];
      const result = PaginationHelper.createPaginatedResult(data, 25, 3, 10);

      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(true);
    });

    it('should handle empty data', () => {
      const result = PaginationHelper.createPaginatedResult([], 0, 1, 10);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(false);
    });
  });
});
