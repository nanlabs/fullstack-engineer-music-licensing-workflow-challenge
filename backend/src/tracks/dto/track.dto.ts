import { ApiProperty } from '@nestjs/swagger';
import { LicensingStatus } from '@prisma/client';

export class CreateTrackDto {
  @ApiProperty({ example: 'uuid-of-scene', description: 'The ID of the scene' })
  sceneId: string;

  @ApiProperty({ example: 'uuid-of-song', description: 'The ID of the song' })
  songId: string;

  @ApiProperty({ example: 0, description: 'Start time of the track in the scene (seconds)' })
  startTime: number;

  @ApiProperty({ example: 60, description: 'End time of the track in the scene (seconds)' })
  endTime: number;
}

export class UpdateTrackDto {
  @ApiProperty({ example: 'uuid-of-scene', description: 'The ID of the scene', required: false })
  sceneId?: string;

  @ApiProperty({ example: 'uuid-of-song', description: 'The ID of the song', required: false })
  songId?: string;

  @ApiProperty({ example: 0, description: 'Start time of the track in the scene (seconds)', required: false })
  startTime?: number;

  @ApiProperty({ example: 60, description: 'End time of the track in the scene (seconds)', required: false })
  endTime?: number;

  @ApiProperty({ enum: LicensingStatus, description: 'The licensing status of the track', required: false })
  status?: LicensingStatus;
}
