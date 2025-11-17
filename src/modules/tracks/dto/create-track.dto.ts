import { IsInt, IsNotEmpty } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTrackDto {
  @ApiProperty({
    description: 'ID of the scene this track belongs to',
    example: 1,
    type: Number,
  })
  @IsInt({ message: i18nValidationMessage('validation.isInt.scene_id') })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.isNotEmpty.scene_id'),
  })
  scene_id: number;

  @ApiProperty({
    description: 'ID of the song used in this track',
    example: 1,
    type: Number,
  })
  @IsInt({ message: i18nValidationMessage('validation.isInt.song_id') })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.isNotEmpty.song_id'),
  })
  song_id: number;

  @ApiProperty({
    description: 'Start time of the track in seconds',
    example: 0,
    type: Number,
  })
  @IsInt({
    message: i18nValidationMessage('validation.isInt.start_time_seconds'),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.isNotEmpty.start_time_seconds'),
  })
  start_time_seconds: number;

  @ApiProperty({
    description: 'End time of the track in seconds',
    example: 120,
    type: Number,
  })
  @IsInt({
    message: i18nValidationMessage('validation.isInt.end_time_seconds'),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.isNotEmpty.end_time_seconds'),
  })
  end_time_seconds: number;
}
