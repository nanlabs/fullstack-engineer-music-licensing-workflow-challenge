import {
  IsString,
  IsNotEmpty,
  IsInt,
  MaxLength,
  Min,
  Max,
  IsPositive,
} from 'class-validator';

export class CreateSongDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 5)
  releaseDate: number;

  @IsInt()
  @IsPositive()
  @Min(1)
  @Max(7200)
  seconds: number;
}
