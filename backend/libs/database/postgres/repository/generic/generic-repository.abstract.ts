import { BaseEntity } from 'typeorm';

export abstract class GenericRepository<T extends BaseEntity> {
  abstract findAll(): Promise<T[]>;

  abstract findById(id: number): Promise<T | null>;

  abstract createOne(entity: T): Promise<T>;
}
