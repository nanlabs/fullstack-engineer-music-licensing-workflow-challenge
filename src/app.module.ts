import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { MoviesModule } from './movies/movies.module';
import { ScenesModule } from './scenes/scenes.module';
import { SongsModule } from './songs/songs.module';
import { TracksModule } from './tracks/tracks.module';
import { HealthModule } from './health/health.module';
import { RealtimeModule } from './realtime/realtime.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { TimeoutMiddleware } from './common/middleware/timeout.middleware';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('app.rateLimitTtl', 60000),
          limit: configService.get<number>('app.rateLimitMax', 100),
        },
      ],
    }),
    DatabaseModule,
    HealthModule,
    MoviesModule,
    ScenesModule,
    SongsModule,
    TracksModule,
    RealtimeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware, TimeoutMiddleware)
      .forRoutes('*');
  }
}
