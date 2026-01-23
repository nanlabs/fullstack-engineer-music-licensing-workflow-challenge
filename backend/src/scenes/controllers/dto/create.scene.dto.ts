import { IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSceneDto {
    @ApiProperty({
        example: 'The opening scene of the movie where the protagonist is introduced.',
        description: 'A brief description of the scene',
    })
    @IsString()
    description: string;

    @ApiProperty({
        example: 'movie-12345',
        description: 'The ID of the movie this scene belongs to',
    })
    @IsString()
    movieId: string;

    @ApiProperty({
        example: 5,
        description: 'The start time of the scene in seconds',
    })
    @IsNumber()
    startTime: number;
}