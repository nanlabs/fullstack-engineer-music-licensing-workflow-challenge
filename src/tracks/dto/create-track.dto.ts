import {
  IsUUID,
  IsNumber,
  Min,
  Max,
  ValidateIf,
  Validate,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTrackDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  sceneId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  songId!: string;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  @Max(9999999999.99)
  startTime!: number;

  @ApiProperty({ example: 180 })
  @IsNumber()
  @Min(0)
  @Max(9999999999.99)
  @ValidateIf(o => o.endTime !== undefined)
  @Validate(
    (value: number, args: ValidationArguments) => {
      const startTime = (args.object as CreateTrackDto).startTime;
      return value > startTime;
    },
    {
      message: 'endTime must be greater than startTime',
    },
  )
  endTime!: number;
}
