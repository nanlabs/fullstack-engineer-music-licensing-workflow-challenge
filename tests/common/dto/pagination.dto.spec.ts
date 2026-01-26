import { PaginationDto } from '../../../src/common/dto/pagination.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

describe('PaginationDto', () => {
  it('should create instance with default values', () => {
    const dto = new PaginationDto();
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
  });

  it('should accept valid page and limit values', async () => {
    const dto = plainToInstance(PaginationDto, {
      page: 2,
      limit: 20,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(20);
  });

  it('should validate minimum page value', async () => {
    const dto = plainToInstance(PaginationDto, {
      page: 0,
      limit: 10,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('page');
  });

  it('should validate minimum limit value', async () => {
    const dto = plainToInstance(PaginationDto, {
      page: 1,
      limit: 0,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('limit');
  });

  it('should validate maximum limit value', async () => {
    const dto = plainToInstance(PaginationDto, {
      page: 1,
      limit: 200, // Exceeds DEFAULT_MAX_LIMIT of 100
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('limit');
  });

  it('should accept optional page and limit', async () => {
    const dto = plainToInstance(PaginationDto, {});

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
  });

  it('should transform string numbers to integers', async () => {
    const dto = plainToInstance(PaginationDto, {
      page: '2',
      limit: '20',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(typeof dto.page).toBe('number');
    expect(typeof dto.limit).toBe('number');
  });

  it('should reject non-integer values', async () => {
    const dto = plainToInstance(PaginationDto, {
      page: 1.5,
      limit: 10.5,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
