import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateSongDto {
  @ApiProperty({ description: 'Song title', example: 'Bohemian Rhapsody' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Song artist', example: 'Queen' })
  @IsString()
  artist: string;

  @ApiPropertyOptional({
    description: 'Song album (optional)',
    example: 'A Night at the Opera',
  })
  @IsOptional()
  @IsString()
  album?: string;

  @ApiPropertyOptional({
    description: 'Song duration in seconds (optional)',
    example: 354,
  })
  @IsOptional()
  @IsInt()
  durationSeconds?: number;
}
