import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateMovieDto } from '../../../src/movies/dto/create-movie.dto';

describe('CreateMovieDto', () => {
  it('should validate a valid movie DTO', async () => {
    const dto = plainToInstance(CreateMovieDto, {
      title: 'Test Movie',
      description: 'Test Description',
      director: 'Test Director',
      releaseYear: 2024,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject empty title', async () => {
    const dto = plainToInstance(CreateMovieDto, {
      title: '',
      releaseYear: 2024,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('title');
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });

  it('should reject missing title', async () => {
    const dto = plainToInstance(CreateMovieDto, {
      releaseYear: 2024,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.property === 'title')).toBe(true);
  });

  it('should reject title that is too long', async () => {
    const dto = plainToInstance(CreateMovieDto, {
      title: 'A'.repeat(256), // Exceeds 255 character limit
      releaseYear: 2024,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('title');
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });

  it('should reject non-string title', async () => {
    const dto = plainToInstance(CreateMovieDto, {
      title: 123,
      releaseYear: 2024,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('title');
  });

  it('should accept valid optional fields', async () => {
    const dto = plainToInstance(CreateMovieDto, {
      title: 'Test Movie',
      description: 'Test Description',
      director: 'Test Director',
      releaseYear: 2024,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept movie with only required field', async () => {
    const dto = plainToInstance(CreateMovieDto, {
      title: 'Test Movie',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject negative release year', async () => {
    const dto = plainToInstance(CreateMovieDto, {
      title: 'Test Movie',
      releaseYear: -1,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('releaseYear');
    expect(errors[0].constraints).toHaveProperty('min');
  });

  it('should reject release year below 1900', async () => {
    const dto = plainToInstance(CreateMovieDto, {
      title: 'Test Movie',
      releaseYear: 1899,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('releaseYear');
  });

  it('should reject non-integer release year', async () => {
    const dto = plainToInstance(CreateMovieDto, {
      title: 'Test Movie',
      releaseYear: 2024.5,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('releaseYear');
  });
});
