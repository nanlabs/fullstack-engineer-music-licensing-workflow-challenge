import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  SEED_TRACK_1_ID,
  SEED_TRACK_2_ID,
  SEED_TRACK_3_ID,
} from 'src/seed/constants/example-ids';

export class TrackIdDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The id of the track',
    examples: {
      pending: { value: SEED_TRACK_1_ID, description: 'SEED DATA - Pending' },
      negotiating: {
        value: SEED_TRACK_2_ID,
        description: 'SEED DATA - Negotiating',
      },
      approved: { value: SEED_TRACK_3_ID, description: 'SEED DATA - Approved' },
    },
  })
  trackId: string;
}
