import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FindByIdDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The id of the entity',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;
}
