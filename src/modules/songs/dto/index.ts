import {
  IsString,
  IsNumber,
  IsOptional,
  MinLength,
  Min,
} from 'class-validator';

export class CreateSongDto {
  @IsString({ message: 'Title must be a string' })
  @MinLength(1, { message: 'Title must not be empty' })
  title: string;

  @IsString({ message: 'Artist must be a string' })
  @MinLength(1, { message: 'Artist must not be empty' })
  artist: string;

  @IsNumber()
  @Min(1, { message: 'Duration must be at least 1 second' })
  durationSeconds: number;
}

export class UpdateSongDto {
  @IsOptional()
  @IsString({ message: 'Title must be a string' })
  @MinLength(1, { message: 'Title must not be empty' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'Artist must be a string' })
  @MinLength(1, { message: 'Artist must not be empty' })
  artist?: string;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Duration must be at least 1 second' })
  durationSeconds?: number;
}
