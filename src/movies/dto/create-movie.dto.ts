import { IsString, IsOptional, IsInt, Min, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMovieDto {
  @ApiProperty({ example: 'The Epic Adventure' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ example: 'An epic journey through time and space' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'John Director' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  director?: string;

  @ApiPropertyOptional({ example: 2024 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  releaseYear?: number;
}
