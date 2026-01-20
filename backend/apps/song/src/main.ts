import { NestFactory } from '@nestjs/core';
import { SongModule } from './song.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { QUEUES } from 'libs/shared';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    SongModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [`amqp://${process.env.RMQ_HOST}:${process.env.RMQ_PORT}`],
        queue: QUEUES.SONG,
        queueOptions: {
          durable: false,
        },
      },
    },
  );
  await app.listen();
}

bootstrap();
