import {
  IsString,
  IsUUID,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSceneDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  movieId!: string;

  @ApiProperty({ example: 'Opening Scene' })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ example: 'The hero embarks on their journey' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sceneNumber?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999999999.99)
  startTime?: number;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999999999.99)
  endTime?: number;
}
