import { DataSource } from 'typeorm';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { GenericRepository } from '../generic/generic-repository.abstract';
import { TypeOrmGenericRepository } from '../typeorm/typeorm-generic.repository';
import { MovieEntity } from '@app/shared';

@Injectable()
export class TypeOrmRepositoryService implements OnApplicationBootstrap {
  public movieRepository: GenericRepository<MovieEntity>;

  constructor(private dataSource: DataSource) {}

  onApplicationBootstrap() {
    const movieRepository = this.dataSource.getRepository(MovieEntity);
    const genericMovieRepository = new TypeOrmGenericRepository(
      movieRepository,
      this.dataSource,
    );

    this.movieRepository = genericMovieRepository;
  }
}
