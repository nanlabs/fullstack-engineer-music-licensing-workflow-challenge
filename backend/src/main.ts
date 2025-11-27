import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Music Licensing Workflow API')
    .setDescription('API for managing movies, scenes, songs, and licensing tracks')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Generate openapi.yml
  const fs = require('fs');
  const yaml = require('yaml');
  const yamlString = yaml.stringify(document);
  fs.writeFileSync('openapi.yml', yamlString);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
