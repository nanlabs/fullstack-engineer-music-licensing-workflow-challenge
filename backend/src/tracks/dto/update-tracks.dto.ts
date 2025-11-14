import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { LicensingStatus } from '../enums/licensing-status.enum';

export class UpdateTrackStatusDto {
  @ApiProperty({
    description: 'New track licensing status',
    enum: LicensingStatus,
    example: LicensingStatus.IN_NEGOTIATION,
  })
  @IsEnum(LicensingStatus)
  status: LicensingStatus;
}
