import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  MinLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTrackDto {
  @ApiProperty({
    description: 'The name of the track',
    example: 'Background Music Track',
  })
  @IsString({ message: 'Name must be a string' })
  @MinLength(1, { message: 'Name must not be empty' })
  name: string;

  @ApiProperty({
    description: 'The UUID of the scene this track belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  sceneId: string;

  @ApiProperty({
    description: 'The UUID of the song used in this track',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  songId: string;

  @ApiProperty({
    description: 'The start time of the track in seconds',
    example: 0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0, { message: 'Start time must be 0 or greater' })
  startTimeSeconds: number;

  @ApiProperty({
    description: 'The end time of the track in seconds',
    example: 120,
    minimum: 0,
  })
  @IsNumber()
  @Min(0, { message: 'End time must be 0 or greater' })
  endTimeSeconds: number;
}

export class UpdateTrackDto {
  @ApiProperty({
    description: 'The name of the track',
    example: 'Background Music Track',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MinLength(1, { message: 'Name must not be empty' })
  name?: string;

  @ApiProperty({
    description: 'The start time of the track in seconds',
    example: 0,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Start time must be 0 or greater' })
  startTimeSeconds?: number;

  @ApiProperty({
    description: 'The end time of the track in seconds',
    example: 120,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'End time must be 0 or greater' })
  endTimeSeconds?: number;
}
