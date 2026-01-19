import { NestFactory } from '@nestjs/core';
import { TrackModule } from './track.module';

async function bootstrap() {
  const app = await NestFactory.create(TrackModule);
  await app.listen(process.env.port ?? 3001);
}
bootstrap();
