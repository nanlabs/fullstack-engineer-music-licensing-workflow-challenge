import { DataSource } from 'typeorm';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { GenericRepository } from '../generic/generic-repository.abstract';
import { TypeOrmGenericRepository } from '../typeorm/typeorm-generic.repository';
import { MovieEntity } from 'libs/shared';
import { SongEntity } from '@app/shared/SongEntity';
import { TrackEntity } from '@app/shared/TrackEntity';
import { LicensingEntity } from '@app/shared/LicensingEntity';
import { MovieSceneEntity } from '@app/shared/MovieSceneEntity';

@Injectable()
export class TypeOrmRepositoryService implements OnApplicationBootstrap {
  public movieRepository: GenericRepository<MovieEntity>;
  public songRepository: GenericRepository<SongEntity>;
  public trackRepository: GenericRepository<TrackEntity>;
  public licensingRepository: GenericRepository<LicensingEntity>;
  public movieSceneRepository: GenericRepository<MovieSceneEntity>;

  constructor(private dataSource: DataSource) {}

  onApplicationBootstrap() {
    const movieRepository = this.dataSource.getRepository(MovieEntity);
    const songRepository = this.dataSource.getRepository(SongEntity);
    const trackRepository = this.dataSource.getRepository(TrackEntity);
    const licensingRepository = this.dataSource.getRepository(LicensingEntity);
    const movieSceneRepository = this.dataSource.getRepository(MovieSceneEntity);

    const genericMovieRepository = new TypeOrmGenericRepository(
      movieRepository,
      this.dataSource,
    );

    const genericSongRepository = new TypeOrmGenericRepository(
      songRepository,
      this.dataSource,
    );

    const genericTrackRepository = new TypeOrmGenericRepository(
      trackRepository,
      this.dataSource,
    );

    const genericLicensingRepository = new TypeOrmGenericRepository(
      licensingRepository,
      this.dataSource,
    );

    const genericMovieSceneRepository = new TypeOrmGenericRepository(
      movieSceneRepository,
      this.dataSource,
    );

    this.movieRepository = genericMovieRepository;
    this.songRepository = genericSongRepository;
    this.trackRepository = genericTrackRepository;
    this.licensingRepository = genericLicensingRepository;
    this.movieSceneRepository = genericMovieSceneRepository;
  }
}
