import { Controller, Body } from '@nestjs/common'

import { SwaggerDocs } from '@/src/shared/decorators/swagger.decorator'
import { Endpoint } from '@/src/shared/decorators/endpoint.decorator'
import { HttpMethods } from '@/src/shared/swagger/api-responses-docs'
import { CONTROLLERS } from '@/src/app/constants/api.constants'
import { TAGS } from '@/src/app/constants/docs.contants'

import { CreateSceneResponseDto } from './dtos/responses/create-scene.response.dto'
import { CreateSceneRequestDto } from './dtos/requests/create-scene.request.dto'
import { ScenesService } from '../../application/scenes.service'
import { Scenes } from '../../domain/scenes.entity'

@Controller(CONTROLLERS.SCENES)
export class ScenesController {
  constructor(private readonly scenesService: ScenesService) {}

  @SwaggerDocs({
    dataDto: CreateSceneResponseDto,
    isPaginated: false,
    httpMethod: HttpMethods.post,
    errorResponseCodes: [400, 404],
    tags: TAGS.SCENES,
    description:
      'Creates a new scene associated with a movie. \n\n' +
      'This endpoint accepts scene details and persists them in the system. \n\n' +
      'If a scene with the same unique constraints already exists, a 409 Conflict error will be returned. \n\n',
    summary: 'Create Scene',
  })
  @Endpoint({
    responseDto: CreateSceneResponseDto,
    operation: HttpMethods.post,
  })
  async createScene(
    @Body() createSceneDto: CreateSceneRequestDto,
  ): Promise<Scenes> {
    return await this.scenesService.create(createSceneDto)
  }
}
