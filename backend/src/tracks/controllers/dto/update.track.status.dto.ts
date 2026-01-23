import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { LicensingStatus } from '@prisma/client';

export class UpdateTrackStatusDto {
    @ApiProperty({
        enum: LicensingStatus,
        enumName: 'LicensingStatus',
        example: 'NEGOTIATING',
        description: 'The new licensing status for the track',
    })
    @IsEnum(LicensingStatus)
    status: LicensingStatus;
}