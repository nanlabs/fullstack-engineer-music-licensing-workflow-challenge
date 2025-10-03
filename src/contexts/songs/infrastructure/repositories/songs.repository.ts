import { InjectRepository } from '@nestjs/typeorm'
import { Injectable } from '@nestjs/common'
import { Repository } from 'typeorm'

import { hhmmssToSeconds } from '@/src/shared/utils/time-transforms'

import { CreateSongRequestDto } from '../controllers/dtos/create-song.request.dto'
import { SongsRepository } from '../../domain/songs.repository.interface'
import { Songs } from '../../domain/songs.entity'

@Injectable()
export class SongsRepositoryImpl implements SongsRepository {
  constructor(
    @InjectRepository(Songs)
    private readonly songsRepository: Repository<Songs>,
  ) {}

  async findById(id: number): Promise<Songs | null> {
    return this.songsRepository.findOne({
      where: { id },
    })
  }

  async findByName(name: string): Promise<Songs | null> {
    return await this.songsRepository.findOne({
      where: { name },
    })
  }

  async insert(song: CreateSongRequestDto): Promise<Songs> {
    return await this.songsRepository.save({
      ...song,
      duration: hhmmssToSeconds(song.duration),
    })
  }
}
