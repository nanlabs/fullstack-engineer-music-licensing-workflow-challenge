import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMovieDto {
  @ApiProperty({ description: 'Movie title', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Movie description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Movie director', maxLength: 100, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  director?: string;

  @ApiProperty({ description: 'Movie producer', maxLength: 100, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  producer?: string;

  @ApiProperty({ description: 'Movie release date', required: false })
  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @ApiProperty({ description: 'Movie status', default: 'development', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;
}