import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MoviesModule } from './movies/movies.module';
import { PrismaModule } from './prisma/prisma.module';
import { ScenesModule } from './scenes/scenes.module';
import { SongsModule } from './songs/songs.module';
import { TracksModule } from './tracks/tracks.module';

@Module({
  imports: [MoviesModule, PrismaModule, ScenesModule, SongsModule, TracksModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
