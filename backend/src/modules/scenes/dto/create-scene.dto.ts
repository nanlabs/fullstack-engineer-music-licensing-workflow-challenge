import { IsString, IsInt, Min, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSceneDto {
  @ApiProperty({ description: 'Scene name', maxLength: 255 })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({ description: 'Scene description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Scene number', minimum: 1 })
  @IsInt()
  @Min(1)
  sceneNumber: number;

  @ApiPropertyOptional({ description: 'Scene duration in seconds', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Movie ID this scene belongs to' })
  @IsInt()
  movieId: number;
}
