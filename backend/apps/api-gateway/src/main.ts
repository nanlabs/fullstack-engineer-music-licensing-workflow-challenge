import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //app.useGlobalPipes(new ValidationPipe());
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      port: Number(process.env.API_GATEWAY_PORT),
      host: process.env.API_GATEWAY_HOST,
    },
  });

  app.enableCors();

  await app.startAllMicroservices();
  await app.listen(process.env.BACKEND_PORT!!);
}
bootstrap();
