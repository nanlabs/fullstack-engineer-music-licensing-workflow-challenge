import { ApiProperty } from '@nestjs/swagger';

export class CreateSongDto {
  @ApiProperty({ example: 'Time', description: 'The title of the song' })
  title: string;

  @ApiProperty({ example: 'Hans Zimmer', description: 'The artist of the song' })
  artist: string;

  @ApiProperty({ example: 275, description: 'Duration of the song in seconds' })
  duration: number;
}

export class UpdateSongDto {
  @ApiProperty({ example: 'Time', description: 'The title of the song', required: false })
  title?: string;

  @ApiProperty({ example: 'Hans Zimmer', description: 'The artist of the song', required: false })
  artist?: string;

  @ApiProperty({ example: 275, description: 'Duration of the song in seconds', required: false })
  duration?: number;
}
