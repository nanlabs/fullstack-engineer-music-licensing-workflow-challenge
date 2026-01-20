import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMovieSceneDto {
  @IsInt()
  @IsNotEmpty()
  movieId: number;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;
}
