import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Track } from '../../entities';
import { TracksService } from './tracks.service';
import { TracksRepository } from './tracks.repository';
import { TracksController } from './tracks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Track])],
  controllers: [TracksController],
  providers: [TracksRepository, TracksService],
  exports: [TracksService],
})
export class TracksModule {}
