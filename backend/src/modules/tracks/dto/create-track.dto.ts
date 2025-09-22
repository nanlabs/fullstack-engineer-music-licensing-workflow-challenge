import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateTrackDto {
  @ApiProperty({ description: 'Track name', maxLength: 255 })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiProperty({ description: 'Start time in seconds', minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  startTimeSeconds: number;

  @ApiProperty({ description: 'End time in seconds', minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  endTimeSeconds: number;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Scene ID this track belongs to' })
  @IsInt()
  sceneId: number;

  @ApiProperty({ description: 'Song ID for this track' })
  @IsInt()
  songId: number;
}
