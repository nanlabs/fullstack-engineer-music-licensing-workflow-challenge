import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  MinLength,
  Min,
} from 'class-validator';

export class CreateSceneDto {
  @IsString({ message: 'Name must be a string' })
  @MinLength(1, { message: 'Name must not be empty' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @IsNumber()
  @Min(1, { message: 'Scene number must be at least 1' })
  sceneNumber: number;

  @IsUUID()
  movieId: string;
}

export class UpdateSceneDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MinLength(1, { message: 'Name must not be empty' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Scene number must be at least 1' })
  sceneNumber?: number;
}
