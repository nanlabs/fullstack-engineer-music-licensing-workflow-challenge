import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsInt, Min, Max, Length, IsEmail } from 'class-validator';

@InputType()
export class CreateSongInput {
  @Field()
  @IsString()
  @Length(1, 255)
  title: string;

  @Field()
  @IsString()
  @Length(1, 255)
  artist: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  album?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  releaseYear?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  genre?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  rightsHolder?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  @Length(1, 255)
  contactEmail?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
