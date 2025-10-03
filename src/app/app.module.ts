import { ConfigModule } from '@nestjs/config'
import { Module } from '@nestjs/common'

import { LicensesControllerModule } from '../contexts/licenses/infrastructure/controllers/licenses.module'
import { MoviesControllerModule } from '../contexts/movies/infrastructure/controllers/movies.module'
import { TracksControllerModule } from '../contexts/tracks/infrastructure/controllers/tracks.module'
import { ScenesControllerModule } from '../contexts/scenes/infrastructure/controllers/scenes.module'
import { ResponseNormalizerModule } from './common/response-normalizer/response-normalizer.module'
import { SongsControllerModule } from '../contexts/songs/infrastructure/controllers/songs.module'
import { EnvironmentConfigModule } from './common/environment-config/environment-config.module'
import { TypeOrmConfigModule } from './database/typeorm.module'
import { HealthModule } from '../contexts/health/health.module'

@Module({
  imports: [
    ResponseNormalizerModule,
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    EnvironmentConfigModule,
    TypeOrmConfigModule,
    HealthModule,
    MoviesControllerModule,
    TracksControllerModule,
    LicensesControllerModule,
    ScenesControllerModule,
    SongsControllerModule,
  ],
})
export class AppModule {}
