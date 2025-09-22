import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScenesController } from './controllers/scenes.controller';
import { ScenesService } from './services/scenes.service';
import { ScenesRepository } from './repositories/scenes.repository';
import { ScenesResolver } from './resolvers/scenes.resolver';
import { Scene } from './entities/scene.entity';
import { MoviesModule } from '../movies/movies.module';

@Module({
  imports: [TypeOrmModule.forFeature([Scene]), MoviesModule],
  controllers: [ScenesController],
  providers: [ScenesService, ScenesRepository, ScenesResolver],
  exports: [ScenesService],
})
export class ScenesModule {}
