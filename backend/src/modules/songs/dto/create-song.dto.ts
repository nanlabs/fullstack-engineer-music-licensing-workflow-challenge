import { IsString, IsOptional, IsInt, Min, Max, Length, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSongDto {
  @ApiProperty({ description: 'Song title', maxLength: 255 })
  @IsString()
  @Length(1, 255)
  title: string;

  @ApiProperty({ description: 'Artist name', maxLength: 255 })
  @IsString()
  @Length(1, 255)
  artist: string;

  @ApiPropertyOptional({ description: 'Album name', maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  album?: string;

  @ApiPropertyOptional({ description: 'Release year', minimum: 1900, maximum: 2100 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  releaseYear?: number;

  @ApiPropertyOptional({ description: 'Music genre', maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  genre?: string;

  @ApiPropertyOptional({ description: 'Song duration in seconds', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;

  @ApiPropertyOptional({ description: 'Rights holder name', maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  rightsHolder?: string;

  @ApiPropertyOptional({ description: 'Contact email for licensing', maxLength: 255 })
  @IsOptional()
  @IsEmail()
  @Length(1, 255)
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
