import { PartialType } from '@nestjs/mapped-types';
import { CreateSongDto } from './create-song.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSongDto extends PartialType(CreateSongDto) {
  @ApiPropertyOptional({
    description: 'Title of the song',
    example: 'Bohemian Rhapsody',
    type: String,
  })
  title?: string;

  @ApiPropertyOptional({
    description: 'Artist name',
    example: 'Queen',
    type: String,
  })
  artist?: string;

  @ApiPropertyOptional({
    description: 'Genre of the song',
    example: 'Rock',
    type: String,
  })
  genre?: string;
}
