import { IsString, IsOptional, IsUUID, MaxLength, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSceneDto {
  @ApiProperty({ description: 'Scene name', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Scene description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Scene duration in seconds', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  duration?: number;

  @ApiProperty({ description: 'Scene start time in seconds', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  startTime?: number;

  @ApiProperty({ description: 'Movie ID this scene belongs to' })
  @IsUUID()
  movieId: string;
}