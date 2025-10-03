import { Order } from '@/src/shared/pagination/page-options'

import { Movies } from './movies.entity'

export abstract class MoviesRepository {
  abstract findById(id: number): Promise<Movies | null>
  abstract findAll(
    limit: number,
    offset: number,
    order: Order,
  ): Promise<[Movies[], count: number]>
  abstract findByName(name: string): Promise<Movies | null>
  abstract insert(input: { name: string }): Promise<Movies>
}
