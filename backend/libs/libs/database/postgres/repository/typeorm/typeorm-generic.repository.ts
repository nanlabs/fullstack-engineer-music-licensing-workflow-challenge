import {
  BaseEntity,
  DataSource,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { GenericRepository } from '../generic/generic-repository.abstract';

export class TypeOrmGenericRepository<
  T extends BaseEntity,
> implements GenericRepository<T> {
  protected repository: Repository<T>;
  protected dataSource: DataSource;

  constructor(repository: Repository<T>, dataSource: DataSource) {
    this.dataSource = dataSource;
    this.repository = repository;
  }

  findAll(relations?: string[]): Promise<T[]> {
    return this.repository.find({
      relations: relations || [],
    });
  }

  findById(id: number, relations?: string[]): Promise<T | null> {
    const options: FindOneOptions<T> = {
      where: {
        id,
      } as unknown as FindOptionsWhere<T>,
      relations: relations || [],
    };
    return this.repository.findOne(options);
  }

  createOne(entity: T): Promise<T> {
    return this.dataSource.transaction(() => this.repository.save(entity));
  }

  async updateOne(id: number, partialEntity: Partial<T>): Promise<T | null> {
    await this.repository.update(id, partialEntity as any);
    return this.findById(id);
  }
}
