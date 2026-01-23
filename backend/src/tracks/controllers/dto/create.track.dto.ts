import { IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTrackDto {
    @ApiProperty({
        example: 'scene-123',
        description: 'The ID of the scene the track belongs to',
    })
    @IsString()
    sceneId: string;

    @ApiProperty({
        example: 'song-456',
        description: 'The ID of the song associated with the track',
    })
    @IsString()
    songId: string;

    @ApiProperty({
        example: 0,
        description: 'The start time of the track within the scene',
    })
    @IsNumber()
    startInScene: number;
    
    @ApiProperty({
        example: 10,
        description: 'The end time of the track within the scene',
    })
    @IsNumber()
    endInScene: number;
}