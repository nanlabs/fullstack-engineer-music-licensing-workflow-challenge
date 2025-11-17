import { PartialType } from '@nestjs/mapped-types';
import { CreateSceneDto } from './create-scene.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSceneDto extends PartialType(CreateSceneDto) {
  @ApiPropertyOptional({
    description: 'ID of the movie this scene belongs to',
    example: 1,
    type: Number,
  })
  movie_id?: number;

  @ApiPropertyOptional({
    description: 'Title of the scene',
    example: 'Opening Scene',
    type: String,
  })
  title?: string;

  @ApiPropertyOptional({
    description: 'Description of the scene',
    example: 'The opening scene of the movie',
    type: String,
  })
  description?: string;
}
