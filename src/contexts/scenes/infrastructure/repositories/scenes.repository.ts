import { InjectRepository } from '@nestjs/typeorm'
import { Injectable } from '@nestjs/common'
import { Repository } from 'typeorm'

import { ScenesRepository } from '../../domain/scenes.repository.interface'
import { Scenes } from '../../domain/scenes.entity'

@Injectable()
export class ScenesRepositoryImpl implements ScenesRepository {
  constructor(
    @InjectRepository(Scenes)
    private readonly scenesRespository: Repository<Scenes>,
  ) {}
  async findById(id: number): Promise<Scenes | null> {
    return await this.scenesRespository.findOne({
      where: { id },
    })
  }

  async save(
    input: Omit<
      Scenes,
      'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'movie' | 'tracks'
    >,
  ): Promise<Scenes> {
    return await this.scenesRespository.save(input)
  }
}
