import { ApiProperty } from '@nestjs/swagger';

export class CreateSceneDto {
  @ApiProperty({ example: 'Opening Scene', description: 'The name of the scene' })
  name: string;

  @ApiProperty({ example: 'Dream within a dream', description: 'Description of the scene', required: false })
  description?: string;

  @ApiProperty({ example: 'uuid-of-movie', description: 'The ID of the movie this scene belongs to' })
  movieId: string;
}

export class UpdateSceneDto {
  @ApiProperty({ example: 'Opening Scene', description: 'The name of the scene', required: false })
  name?: string;

  @ApiProperty({ example: 'Dream within a dream', description: 'Description of the scene', required: false })
  description?: string;

  @ApiProperty({ example: 'uuid-of-movie', description: 'The ID of the movie this scene belongs to', required: false })
  movieId?: string;
}
