import { IsString, IsOptional, IsInt, Min, Max, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMovieDto {
  @ApiProperty({ description: 'Movie title', maxLength: 255 })
  @IsString()
  @Length(1, 255)
  title: string;

  @ApiPropertyOptional({ description: 'Movie description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Movie director', maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  director?: string;

  @ApiPropertyOptional({ description: 'Movie release year', minimum: 1900, maximum: 2100 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  releaseYear?: number;

  @ApiPropertyOptional({
    description: 'Movie status',
    enum: ['development', 'pre-production', 'production', 'post-production', 'released'],
    default: 'development',
  })
  @IsOptional()
  @IsString()
  status?: string;
}
