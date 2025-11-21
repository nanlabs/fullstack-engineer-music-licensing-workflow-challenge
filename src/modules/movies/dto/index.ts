import {
  IsString,
  IsNumber,
  IsOptional,
  MinLength,
  Min,
  Max,
} from 'class-validator';

export class CreateMovieDto {
  @IsString({ message: 'Title must be a string' })
  @MinLength(1, { message: 'Title must not be empty' })
  title: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @IsNumber()
  @Min(1800, { message: 'Release year must be 1800 or later' })
  @Max(2100, { message: 'Release year must be 2100 or earlier' })
  releaseYear: number;
}

export class UpdateMovieDto {
  @IsOptional()
  @IsString({ message: 'Title must be a string' })
  @MinLength(1, { message: 'Title must not be empty' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1800, { message: 'Release year must be 1800 or later' })
  @Max(2100, { message: 'Release year must be 2100 or earlier' })
  releaseYear?: number;
}
