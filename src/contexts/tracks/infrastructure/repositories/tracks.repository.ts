import { InjectRepository } from '@nestjs/typeorm'
import { Injectable } from '@nestjs/common'
import { Repository } from 'typeorm'

import { TracksRepository } from '../../domain/tracks.repository.interface'
import { Tracks } from '../../domain/tracks.entity'

@Injectable()
export class TracksRepositoryImpl implements TracksRepository {
  constructor(
    @InjectRepository(Tracks)
    private readonly tracksRepository: Repository<Tracks>,
  ) {}

  async findOneByIdOrFail(id: number): Promise<Tracks> {
    return await this.findById(id, { throwsError: true })
  }

  async findOneById(id: number): Promise<Tracks | null> {
    return await this.findById(id, { throwsError: false })
  }

  private findById(id: number, options: { throwsError: true }): Promise<Tracks>
  private findById(
    id: number,
    options: { throwsError: false },
  ): Promise<Tracks | null>
  private findById(id: number, options: { throwsError: boolean }) {
    const query = {
      where: { id },
      relations: {
        license: {
          licenseHistory: true,
        },
      },
    }

    if (options.throwsError) {
      return this.tracksRepository.findOneOrFail(query)
    }
    return this.tracksRepository.findOne(query)
  }

  async insert(
    track: Pick<Tracks, 'sceneId' | 'songId' | 'startTime' | 'endTime'>,
  ): Promise<Tracks> {
    return await this.tracksRepository.save(track)
  }
}
