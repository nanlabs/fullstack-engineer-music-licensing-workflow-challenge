import { IsString, IsOptional, IsUUID, IsNumber, Min, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTrackDto {
  @ApiProperty({ description: 'Track name', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Track start time in seconds' })
  @IsNumber()
  @Min(0)
  startTime: number;

  @ApiProperty({ description: 'Track end time in seconds' })
  @IsNumber()
  @Min(0)
  endTime: number;

  @ApiProperty({ description: 'Track volume level (0-100)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  volume?: number;

  @ApiProperty({ description: 'Track description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Scene ID this track belongs to' })
  @IsUUID()
  sceneId: string;

  @ApiProperty({ description: 'Song ID for this track' })
  @IsUUID()
  songId: string;
}