import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  MinLength,
  Min,
} from 'class-validator';

export class CreateTrackDto {
  @IsString({ message: 'Name must be a string' })
  @MinLength(1, { message: 'Name must not be empty' })
  name: string;

  @IsUUID()
  sceneId: string;

  @IsUUID()
  songId: string;

  @IsNumber()
  @Min(0, { message: 'Start time must be 0 or greater' })
  startTimeSeconds: number;

  @IsNumber()
  @Min(0, { message: 'End time must be 0 or greater' })
  endTimeSeconds: number;
}

export class UpdateTrackDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MinLength(1, { message: 'Name must not be empty' })
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Start time must be 0 or greater' })
  startTimeSeconds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'End time must be 0 or greater' })
  endTimeSeconds?: number;
}
