import { Module } from '@nestjs/common';
import { SongsController } from './controllers/songs.controller';
import { GetSongs } from './application/get.songs';
import { GetSong } from './application/get.song';
import { CreateSong } from './application/create.song';
import { UpdateSong } from './application/update.song';
import { RemoveSong } from './application/remove.song';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaSongRepository } from './infrastructure/prisma.song.repository';

@Module({
  imports: [],
  controllers: [SongsController],
  providers: [
    PrismaService,
    PrismaSongRepository,
    CreateSong,
    UpdateSong,
    GetSongs,
    GetSong,
    RemoveSong,
  ],
})
export class SongsModule {}