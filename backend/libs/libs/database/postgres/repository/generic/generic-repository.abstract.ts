import { BaseEntity } from 'typeorm';

export abstract class GenericRepository<T extends BaseEntity> {
  abstract findAll(relations?: string[]): Promise<T[]>;

  abstract findById(id: number, relations?: string[]): Promise<T | null>;

  abstract createOne(entity: T): Promise<T>;

  abstract updateOne(id: number, partialEntity: Partial<T>): Promise<T | null>;
}
