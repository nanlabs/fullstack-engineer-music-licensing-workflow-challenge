import { IsString, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSongDto {
  @ApiProperty({ description: 'Song title', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Song artist', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  artist: string;

  @ApiProperty({ description: 'Song duration in seconds', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  duration?: number;

  @ApiProperty({ description: 'Rights holder information', maxLength: 255, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  rightsHolder?: string;
}