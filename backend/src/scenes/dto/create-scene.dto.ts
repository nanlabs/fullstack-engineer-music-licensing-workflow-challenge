import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateSceneDto {
  @ApiProperty({ description: 'Scene name', example: 'Chase Scene' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Order number in the movie (optional)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiProperty({ description: 'Movie ID this scene belongs to', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  movieId: string;
}
