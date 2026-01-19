import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ClientRMQ } from '@nestjs/microservices';

@Injectable()
export class AppService {
  constructor(
    @Inject(forwardRef(() => 'MOVIE_SERVICE'))
    private readonly movieMicroserviceClient: ClientRMQ,
  ) {}

  getHello(): string {
    return 'Hello World FROM API API Gateway!';
  }

  fetchAllMoviesRequest() {
    this.movieMicroserviceClient.emit('movie.fetch.all.request', {});
  }
}
