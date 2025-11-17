import { PartialType } from '@nestjs/mapped-types';
import { CreateMovieDto } from './create-movie.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMovieDto extends PartialType(CreateMovieDto) {
  @ApiPropertyOptional({
    description: 'Title of the movie',
    example: 'The Matrix',
    type: String,
  })
  title?: string;

  @ApiPropertyOptional({
    description: 'Description of the movie',
    example: 'A computer hacker learns about the true nature of reality',
    type: String,
  })
  description?: string;
}
