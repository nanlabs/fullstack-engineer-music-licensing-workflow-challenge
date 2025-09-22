import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsInt, Min, IsOptional, Length } from 'class-validator';

@InputType()
export class CreateSceneInput {
  @Field()
  @IsString()
  @Length(1, 255)
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  sceneNumber: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => Int)
  @IsInt()
  movieId: number;
}
