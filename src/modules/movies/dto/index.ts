import {
  IsString,
  IsNumber,
  IsOptional,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMovieDto {
  @ApiProperty({
    description: 'The title of the movie',
    example: 'Inception',
  })
  @IsString({ message: 'Title must be a string' })
  @MinLength(1, { message: 'Title must not be empty' })
  title: string;

  @ApiProperty({
    description: 'Optional description of the movie',
    example: 'A sci-fi thriller about dreams within dreams',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @ApiProperty({
    description: 'The release year of the movie',
    example: 2010,
    minimum: 1800,
    maximum: 2100,
  })
  @IsNumber()
  @Min(1800, { message: 'Release year must be 1800 or later' })
  @Max(2100, { message: 'Release year must be 2100 or earlier' })
  releaseYear: number;
}

export class UpdateMovieDto {
  @ApiProperty({
    description: 'The title of the movie',
    example: 'Inception',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Title must be a string' })
  @MinLength(1, { message: 'Title must not be empty' })
  title?: string;

  @ApiProperty({
    description: 'Optional description of the movie',
    example: 'A sci-fi thriller about dreams within dreams',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @ApiProperty({
    description: 'The release year of the movie',
    example: 2010,
    minimum: 1800,
    maximum: 2100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1800, { message: 'Release year must be 1800 or later' })
  @Max(2100, { message: 'Release year must be 2100 or earlier' })
  releaseYear?: number;
}
