import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { EventPattern } from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/movies')
  async fetchMovies() {
    this.appService.fetchAllMoviesRequest();
  }

  @EventPattern('movie.fetch.all.response')
  fetchAllMoviesResponse(payload: any[]) {
    console.log('response', payload);
  }
}
