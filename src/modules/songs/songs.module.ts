import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Song } from '../../entities';
import { SongsService } from './songs.service';
import { SongsRepository } from './songs.repository';
import { SongsController } from './songs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Song])],
  controllers: [SongsController],
  providers: [SongsRepository, SongsService],
  exports: [SongsService, SongsRepository],
})
export class SongsModule {}
