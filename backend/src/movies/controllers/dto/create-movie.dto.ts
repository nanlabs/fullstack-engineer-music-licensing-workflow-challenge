import { IsString, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMovieDto {
    @ApiProperty({ example: 'Inception', description: 'The title of the movie'  })
    @IsString()
    title: string;

    @ApiProperty({ example: '2010-07-16', description: 'The release date of the movie' })
    @IsDate()
    releaseDate: Date;
}
