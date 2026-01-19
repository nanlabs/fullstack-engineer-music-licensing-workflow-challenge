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

  findAll(): Promise<T[]> {
    return this.repository.find();
  }
  findById(id: number): Promise<T | null> {
    const options: FindOneOptions<T> = {
      where: {
        id,
      } as unknown as FindOptionsWhere<T>,
    };
    return this.repository.findOne(options);
  }

  createOne(entity: T): Promise<T> {
    return this.dataSource.transaction(() => this.repository.save(entity));
  }
}
