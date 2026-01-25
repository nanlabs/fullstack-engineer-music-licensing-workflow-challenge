import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum RealtimeEventType {
  LICENSING_STATUS_UPDATE = 'licensing_status_update',
  TRACK_CREATED = 'track_created',
  TRACK_UPDATED = 'track_updated',
  TRACK_DELETED = 'track_deleted',
}

export class RealtimeQueryDto {
  @ApiPropertyOptional({
    enum: RealtimeEventType,
    description: 'Filter events by type',
    example: RealtimeEventType.LICENSING_STATUS_UPDATE,
  })
  @IsOptional()
  @IsEnum(RealtimeEventType)
  eventType?: RealtimeEventType;

  @ApiPropertyOptional({
    description: 'Filter events for a specific track ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  trackId?: string;

  @ApiPropertyOptional({
    description: 'Filter events for a specific scene ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  sceneId?: string;

  @ApiPropertyOptional({
    description: 'Filter events for a specific movie ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  movieId?: string;
}
