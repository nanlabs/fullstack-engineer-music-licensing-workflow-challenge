import { Controller, Body } from '@nestjs/common'

import { SwaggerDocs } from '@/src/shared/decorators/swagger.decorator'
import { HttpMethods } from '@/src/shared/swagger/api-responses-docs'
import { Endpoint } from '@/src/shared/decorators/endpoint.decorator'
import { CONTROLLERS } from '@/src/app/constants/api.constants'
import { TAGS } from '@/src/app/constants/docs.contants'

import { CreateSongResponseDto } from './dtos/create-song.response.dto'
import { CreateSongRequestDto } from './dtos/create-song.request.dto'
import { SongsService } from '../../application/songs.service'

@Controller(CONTROLLERS.SONGS)
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @SwaggerDocs({
    dataDto: CreateSongResponseDto,
    isPaginated: false,
    httpMethod: HttpMethods.post,
    errorResponseCodes: [400, 409],
    tags: TAGS.SONGS,
    description:
      'Creates a new song in the system. \n\n' +
      'This endpoint stores the provided song details and returns the created song. \n\n' +
      'If a song with the same identifier already exists, a 400 error will be returned. \n\n',
    summary: 'Create Song',
  })
  @Endpoint({
    responseDto: CreateSongResponseDto,
    operation: HttpMethods.post,
  })
  async createSongController(@Body() input: CreateSongRequestDto) {
    return await this.songsService.create(input)
  }
}
