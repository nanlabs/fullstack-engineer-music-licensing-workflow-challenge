import { ApiProperty } from '@nestjs/swagger';

export class CreateMovieDto {
  @ApiProperty({ example: 'Inception', description: 'The title of the movie' })
  title: string;

  @ApiProperty({ example: 2010, description: 'The release year of the movie' })
  releaseYear: number;
}

export class UpdateMovieDto {
  @ApiProperty({ example: 'Inception', description: 'The title of the movie', required: false })
  title?: string;

  @ApiProperty({ example: 2010, description: 'The release year of the movie', required: false })
  releaseYear?: number;
}
