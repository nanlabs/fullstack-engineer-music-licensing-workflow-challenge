import { Module } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { MoviesController } from './movies.controller';
import { MoviesRepository } from './movies.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MoviesController],
  providers: [MoviesService, MoviesRepository],
})
export class MoviesModule {}
