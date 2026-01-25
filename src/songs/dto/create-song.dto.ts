import { IsString, IsOptional, IsInt, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSongDto {
  @ApiProperty({ example: 'Epic Theme' })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'The Orchestra' })
  @IsString()
  @MaxLength(255)
  artist!: string;

  @ApiPropertyOptional({ example: 'Movie Soundtracks' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  album?: string;

  @ApiPropertyOptional({ example: 'Orchestral' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  genre?: string;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86400)
  duration?: number;

  @ApiPropertyOptional({ example: 'Epic Music Records' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  rightsHolder?: string;
}
