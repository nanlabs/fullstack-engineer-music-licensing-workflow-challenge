import { InputType, Field, Float } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString, IsNumber, IsDateString, Min } from 'class-validator';
import { LicenseStatusEnum } from '../../../common/enums/license-status.enum';

@InputType()
export class UpdateLicenseStatusInput {
  @Field(() => LicenseStatusEnum)
  @IsEnum(LicenseStatusEnum)
  status: LicenseStatusEnum;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  updatedBy?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  licenseFee?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  licenseStartDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  licenseEndDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  contractDetails?: string;
}
