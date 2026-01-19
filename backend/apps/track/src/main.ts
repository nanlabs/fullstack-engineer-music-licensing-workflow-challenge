import { NestFactory } from '@nestjs/core';
import { TrackModule } from './track.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    TrackModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [`amqp://${process.env.RMQ_HOST}:${process.env.RMQ_PORT}`],
        queue: 'TRACK_QUEUE',
        queueOptions: {
          durable: false,
        },
      },
    },
  );
  await app.listen();
}

bootstrap();
