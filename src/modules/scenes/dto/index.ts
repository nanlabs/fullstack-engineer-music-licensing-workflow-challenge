import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  MinLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSceneDto {
  @ApiProperty({
    description: 'The name of the scene',
    example: 'Opening Scene',
  })
  @IsString({ message: 'Name must be a string' })
  @MinLength(1, { message: 'Name must not be empty' })
  name: string;

  @ApiProperty({
    description: 'Optional description of the scene',
    example: 'The protagonist wakes up in a mysterious room',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @ApiProperty({
    description: 'The scene number in the movie',
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @Min(1, { message: 'Scene number must be at least 1' })
  sceneNumber: number;

  @ApiProperty({
    description: 'The UUID of the movie this scene belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  movieId: string;
}

export class UpdateSceneDto {
  @ApiProperty({
    description: 'The name of the scene',
    example: 'Opening Scene',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MinLength(1, { message: 'Name must not be empty' })
  name?: string;

  @ApiProperty({
    description: 'Optional description of the scene',
    example: 'The protagonist wakes up in a mysterious room',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @ApiProperty({
    description: 'The scene number in the movie',
    example: 1,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Scene number must be at least 1' })
  sceneNumber?: number;
}
