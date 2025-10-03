import { InjectRepository } from '@nestjs/typeorm'
import { Injectable } from '@nestjs/common'
import { Repository } from 'typeorm'

import { Order } from '@/src/shared/pagination/page-options'

import { MoviesRepository } from '../../domain/movies.repository.interface'
import { Movies } from '../../domain/movies.entity'

@Injectable()
export class MoviesRepositoryImpl implements MoviesRepository {
  constructor(
    @InjectRepository(Movies)
    private readonly moviesRepository: Repository<Movies>,
  ) {}

  async findById(id: number): Promise<Movies | null> {
    return this.moviesRepository.findOne({
      where: { id },
      relations: {
        scenes: {
          tracks: {
            song: true,
            license: {
              licenseHistory: true,
            },
          },
        },
      },
    })
  }

  async findAll(
    limit: number,
    offset: number,
    order: Order,
  ): Promise<[Movies[], count: number]> {
    return await this.moviesRepository.findAndCount({
      take: limit,
      skip: offset,
      order: {
        createdAt: order,
      },
      relations: {
        scenes: {
          tracks: {
            song: true,
            license: true,
          },
        },
      },
    })
  }

  async findByName(name: string): Promise<Movies | null> {
    return await this.moviesRepository.findOne({
      where: { name },
    })
  }

  async insert({ name }: { name: string }): Promise<Movies> {
    return await this.moviesRepository.save({ name })
  }
}
