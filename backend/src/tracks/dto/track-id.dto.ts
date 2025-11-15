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
      '1-pending': {
        value: SEED_TRACK_3_ID,
        description: 'SEED DATA - Pending',
      },
      '2-negotiating': {
        value: SEED_TRACK_2_ID,
        description: 'SEED DATA - Negotiating',
      },
      '3-approved': {
        value: SEED_TRACK_1_ID,
        description: 'SEED DATA - Approved',
      },
    },
  })
  trackId: string;
}
