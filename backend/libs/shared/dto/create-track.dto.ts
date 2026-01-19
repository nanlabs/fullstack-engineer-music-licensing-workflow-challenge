import {
  IsInt,
  IsNotEmpty,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateTrackDto {
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  startTime: number;

  @IsInt()
  @IsNotEmpty()
  @Min(0)
  @ValidateIf((o) => o.endTime > o.startTime, {
    message: 'endTime must be greater than startTime',
  })
  endTime: number;

  @IsInt()
  @IsNotEmpty()
  movieSceneId: number;

  @IsInt()
  @IsNotEmpty()
  songId: number;
}
