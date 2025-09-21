import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsInt, Min, Max, Length } from 'class-validator';

@InputType()
export class CreateMovieInput {
  @Field()
  @IsString()
  @Length(1, 255)
  title: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  director?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  releaseYear?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;
}
