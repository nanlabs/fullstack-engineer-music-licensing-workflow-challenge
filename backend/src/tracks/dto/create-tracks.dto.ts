import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTrackDto {
  @ApiProperty({
    description: 'Song ID to associate',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  songId: string;

  @ApiProperty({
    description: 'Track start time (in seconds)',
    example: 12.5,
  })
  @IsNumber()
  startTime: number;

  @ApiProperty({
    description: 'Track end time (in seconds)',
    example: 56.2,
  })
  @IsNumber()
  endTime: number;

  @ApiPropertyOptional({ description: 'Track additional notes (optional)' })
  @IsOptional()
  @IsString()
  notes?: string;
}
