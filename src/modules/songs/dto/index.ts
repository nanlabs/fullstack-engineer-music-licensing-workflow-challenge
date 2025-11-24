import {
  IsString,
  IsNumber,
  IsOptional,
  MinLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSongDto {
  @ApiProperty({
    description: 'The title of the song',
    example: 'Bohemian Rhapsody',
  })
  @IsString({ message: 'Title must be a string' })
  @MinLength(1, { message: 'Title must not be empty' })
  title: string;

  @ApiProperty({
    description: 'The artist name',
    example: 'Queen',
  })
  @IsString({ message: 'Artist must be a string' })
  @MinLength(1, { message: 'Artist must not be empty' })
  artist: string;

  @ApiProperty({
    description: 'The duration of the song in seconds',
    example: 354,
    minimum: 1,
  })
  @IsNumber()
  @Min(1, { message: 'Duration must be at least 1 second' })
  durationSeconds: number;
}

export class UpdateSongDto {
  @ApiProperty({
    description: 'The title of the song',
    example: 'Bohemian Rhapsody',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Title must be a string' })
  @MinLength(1, { message: 'Title must not be empty' })
  title?: string;

  @ApiProperty({
    description: 'The artist name',
    example: 'Queen',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Artist must be a string' })
  @MinLength(1, { message: 'Artist must not be empty' })
  artist?: string;

  @ApiProperty({
    description: 'The duration of the song in seconds',
    example: 354,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Duration must be at least 1 second' })
  durationSeconds?: number;
}
