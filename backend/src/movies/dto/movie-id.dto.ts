import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SEED_MOVIE_ID } from 'src/seed/constants/example-ids';

export class MovieIdDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The id of the movie',
    examples: {
      movie1: { value: SEED_MOVIE_ID, description: 'SEED DATA - Movie 1' },
    },
  })
  movieId: string;
}
