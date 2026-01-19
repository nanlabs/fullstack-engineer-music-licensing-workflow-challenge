import { Controller, forwardRef, Get, Inject } from '@nestjs/common';
import {
  ClientRMQ,
  ClientTCP,
  EventPattern,
  Payload,
} from '@nestjs/microservices';
import { TypeOrmRepositoryService } from 'libs/database/postgres/repository/service/typeorm-repository.service';

@Controller()
export class MovieController {
  constructor(
    @Inject('api-gateway-host')
    private readonly apiGatewayMicroserviceClient: ClientTCP,
    @Inject(forwardRef(() => 'MOVIE_SERVICE'))
    private readonly movieServiceClient: ClientRMQ,
    private typeOrmRepositoryService: TypeOrmRepositoryService,
  ) {}

  @EventPattern('movie.fetch.all.request')
  async featuredContentProcessRequest(@Payload() payload: {}) {
    const movies =
      await this.typeOrmRepositoryService.movieRepository.findAll();

    console.log('call in fetch all movies', movies);
    this.apiGatewayMicroserviceClient.emit('movie.fetch.all.response', [
      {
        id: 1,
        title: 'The Shawshank Redemption',
        release_date: '1994-09-23',
        director: 'Frank Darabont',
      },
      {
        id: 2,
        title: 'The Godfather',
        release_date: '1972-03-24',
        director: 'Francis Ford Coppola',
      },
      {
        id: 3,
        title: 'The Dark Knight',
        release_date: '2008-07-18',
        director: 'Christopher Nolan',
      },
      {
        id: 4,
        title: 'Pulp Fiction',
        release_date: '1994-10-14',
        director: 'Quentin Tarantino',
      },
      {
        id: 5,
        title: 'Inception',
        release_date: '2010-07-16',
        director: 'Christopher Nolan',
      },
      {
        id: 6,
        title: 'Forrest Gump',
        release_date: '1994-07-06',
        director: 'Robert Zemeckis',
      },
      {
        id: 7,
        title: 'The Matrix',
        release_date: '1999-03-31',
        director: 'Lana Wachowski, Lilly Wachowski',
      },
      {
        id: 8,
        title: 'Goodfellas',
        release_date: '1990-09-19',
        director: 'Martin Scorsese',
      },
      {
        id: 9,
        title: 'Interstellar',
        release_date: '2014-11-07',
        director: 'Christopher Nolan',
      },
      {
        id: 10,
        title: 'Parasite',
        release_date: '2019-05-30',
        director: 'Bong Joon-ho',
      },
    ]);
  }
}
