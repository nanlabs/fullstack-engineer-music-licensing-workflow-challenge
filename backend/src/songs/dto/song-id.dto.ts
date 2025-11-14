import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SEED_SONG_1_ID, SEED_SONG_2_ID } from 'src/seed/constants/example-ids';

export class SongIdDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The id of the song',
    examples: {
      song1: { value: SEED_SONG_1_ID, description: 'SEED DATA - Song 1' },
      song2: { value: SEED_SONG_2_ID, description: 'SEED DATA - Song 2' },
    },
  })
  songId: string;
}
