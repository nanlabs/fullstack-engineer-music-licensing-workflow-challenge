import { NestFactory } from '@nestjs/core';
import { MovieModule } from './movie.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    MovieModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [`amqp://${process.env.RMQ_HOST}:${process.env.RMQ_PORT}`],
        queue: 'MOVIE_QUEUE',
        queueOptions: {
          durable: false,
        },
      },
    },
  );
  await app.listen();
}

bootstrap();
