import { Injectable, Inject } from '@nestjs/common'

import { APPLICATION_ERRORS } from '@/src/app/common/response-normalizer/errors'
import { throwError } from '@/src/shared/utils/throw-error'

import { CreateSceneRequestDto } from '../infrastructure/controllers/dtos/requests/create-scene.request.dto'
import { MoviesRepository } from '../../movies/domain/movies.repository.interface'
import { ScenesRepository } from '../domain/scenes.repository.interface'
import { Scenes } from '../domain/scenes.entity'

@Injectable()
export class ScenesService {
  constructor(
    @Inject(MoviesRepository)
    private readonly moviesRepository: MoviesRepository,
    @Inject(ScenesRepository)
    private readonly scenesRepository: ScenesRepository,
  ) {}
  async create(data: CreateSceneRequestDto): Promise<Scenes> {
    const movie = await this.moviesRepository.findById(data.movieId)
    if (!movie) {
      throwError(APPLICATION_ERRORS.MOVIES.NOT_FOUND_ERROR)
    }

    return await this.scenesRepository.save(data)
  }
}
