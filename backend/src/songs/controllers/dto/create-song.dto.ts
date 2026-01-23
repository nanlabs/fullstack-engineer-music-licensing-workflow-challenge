import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSongDto {
    @ApiProperty({ example: 'Imagine', description: 'The title of the song' })
    @IsString()
    title: string;

    @ApiProperty({ example: 'John Lennon', description: 'The artist of the song' })
    @IsString()
    artist: string;
    
    @ApiProperty({ example: 'Apple Records', description: 'The label of the song' })
    @IsString()
    label: string;
}