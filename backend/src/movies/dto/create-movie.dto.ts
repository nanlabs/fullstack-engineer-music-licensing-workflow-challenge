import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateMovieDto {
  @ApiProperty({ description: 'Movie title', example: 'Inception' })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Movie description',
    example: 'A movie about a dream within a dream',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Movie release year', example: 2010 })
  @IsOptional()
  @IsInt()
  releaseYear?: number;
}
