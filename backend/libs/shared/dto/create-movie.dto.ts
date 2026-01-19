import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateMovieDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['DVD', 'Blu-ray', 'Digital', '4K UHD'])
  encodingFormat: string;

  @IsInt()
  @Min(1888) // First movie ever made
  @Max(new Date().getFullYear() + 5) // Allow up to 5 years in future
  releaseDate: number;
}
