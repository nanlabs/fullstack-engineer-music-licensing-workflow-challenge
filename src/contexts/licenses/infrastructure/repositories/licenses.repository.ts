import { InjectRepository } from '@nestjs/typeorm'
import { Injectable } from '@nestjs/common'
import { Repository } from 'typeorm'

import { LicensesRepository } from '../../domain/licenses.repository.interface'
import { Licenses } from '../../domain/licenses.entity'

@Injectable()
export class LicensesRepositoryImpl implements LicensesRepository {
  constructor(
    @InjectRepository(Licenses)
    private readonly licensesRepository: Repository<Licenses>,
  ) {}
  async findOneByIdOrFail(id: number): Promise<Licenses> {
    return await this.licensesRepository.findOneOrFail({
      where: {
        id,
      },
      relations: {
        track: {
          song: true,
          scene: true,
        },
      },
    })
  }

  async create(
    license: Pick<Licenses, 'trackId' | 'rightsHolder' | 'status' | 'notes'>,
  ): Promise<Licenses> {
    return await this.licensesRepository.save(license)
  }

  async update({
    id,
    status,
  }: Pick<Licenses, 'id' | 'status'>): Promise<boolean> {
    const updateResult = await this.licensesRepository.update(
      {
        id,
      },
      { status },
    )

    return !!updateResult.affected
  }
}
