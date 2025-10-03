import { Inject } from '@nestjs/common'

import { APPLICATION_ERRORS } from '@/src/app/common/response-normalizer/errors'
import { throwError } from '@/src/shared/utils/throw-error'

import { CreateSongRequestDto } from '../infrastructure/controllers/dtos/create-song.request.dto'
import { SongsRepository } from '../domain/songs.repository.interface'

export class SongsService {
  constructor(
    @Inject(SongsRepository)
    private readonly songsRepository: SongsRepository,
  ) {}

  async create(input: CreateSongRequestDto) {
    const song = await this.songsRepository.findByName(input.name)
    if (song) {
      throwError(APPLICATION_ERRORS.SONGS.FOUND_ERROR)
    }

    return await this.songsRepository.insert(input)
  }
}
