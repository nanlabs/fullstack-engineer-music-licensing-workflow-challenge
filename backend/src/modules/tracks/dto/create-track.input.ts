import { Field, Float, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

@InputType()
export class CreateTrackInput {
  @Field()
  @IsString()
  @Length(1, 255)
  name: string;

  @Field(() => Float)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  startTimeSeconds: number;

  @Field(() => Float)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  endTimeSeconds: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => Int)
  @IsInt()
  sceneId: number;

  @Field(() => Int)
  @IsInt()
  songId: number;
}
