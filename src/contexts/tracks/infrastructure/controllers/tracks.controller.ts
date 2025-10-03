import { Controller, Param, Body } from '@nestjs/common'

import { SwaggerDocs } from '@/src/shared/decorators/swagger.decorator'
import { Endpoint } from '@/src/shared/decorators/endpoint.decorator'
import { HttpMethods } from '@/src/shared/swagger/api-responses-docs'
import { CONTROLLERS } from '@/src/app/constants/api.constants'
import { TAGS } from '@/src/app/constants/docs.contants'

import { GetTrackByIdResponseDto } from './dtos/responses/get-track-license-history.response.dto'
import { GetTrackByIdRequestDto } from './dtos/requests/get-license-status-request.dto'
import { CreateTrackResponseDto } from './dtos/responses/create-track.response.dto'
import { CreateTrackRequestDto } from './dtos/requests/create-track.request.dto'
import { TracksService } from '../../application/tracks.service'
import { Tracks } from '../../domain/tracks.entity'

@Controller(CONTROLLERS.TRACKS)
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @SwaggerDocs({
    dataDto: CreateTrackResponseDto,
    isPaginated: false,
    httpMethod: HttpMethods.post,
    errorResponseCodes: [400, 404],
    tags: TAGS.TRACKS,
    description: 'Creates a new track and associates it to a song \n\n',
    summary: 'Creates a track and associates it to a song',
  })
  @Endpoint({
    responseDto: CreateTrackResponseDto,
    operation: HttpMethods.post,
  })
  async createTrackWithLicense(
    @Body() newTrack: CreateTrackRequestDto,
  ): Promise<Tracks> {
    return await this.tracksService.create(newTrack)
  }

  @SwaggerDocs({
    dataDto: GetTrackByIdResponseDto,
    isPaginated: false,
    httpMethod: HttpMethods.get,
    errorResponseCodes: [400, 404],
    tags: TAGS.TRACKS,
    description: 'Retrieves a Track with its details by id',
    summary: 'Retrieves a Track with its details by id',
  })
  @Endpoint({
    responseDto: GetTrackByIdResponseDto,
    operation: HttpMethods.get,
    path: '/:id',
  })
  async getTrackLicenseStatusHistory(
    @Param() { id }: GetTrackByIdRequestDto,
  ): Promise<Tracks> {
    return await this.tracksService.getTrackById(id)
  }
}
