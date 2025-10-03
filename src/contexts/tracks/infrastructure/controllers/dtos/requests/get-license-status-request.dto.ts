import { IsNotEmpty, IsPositive, IsInt } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'

export class GetTrackByIdRequestDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @ApiProperty({ description: 'Track ID', type: Number, example: 1 })
  id: number
}
