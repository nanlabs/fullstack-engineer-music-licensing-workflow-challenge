import { Field, ObjectType, ID } from '@nestjs/graphql';
import { LicensingStatus } from '../../../entities/enums/licensing-status.enum';

@ObjectType()
export class LicenseStatusChangedDto {
  @Field(() => ID)
  licenseId: string;

  @Field(() => ID)
  trackId: string;

  @Field()
  oldStatus: LicensingStatus;

  @Field()
  newStatus: LicensingStatus;

  @Field({ nullable: true })
  notes?: string;

  @Field()
  changedAt: Date;

  @Field()
  trackName: string;

  @Field()
  songTitle: string;

  @Field()
  songArtist: string;

  @Field()
  movieTitle: string;

  @Field()
  sceneName: string;
}