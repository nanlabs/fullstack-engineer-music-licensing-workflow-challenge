import { Injectable, Logger } from '@nestjs/common';
import { CreateSceneDto } from './dto/create-scene.dto';

const logger = new Logger('ScenesService');

@Injectable()
export class ScenesService {
  create(createSceneDto: CreateSceneDto) {
    logger.log('create', createSceneDto);
  }

  findAllByMovie(movieId: string) {
    logger.log('findAllByMovie', movieId);
  }

  findOne(id: string) {
    logger.log('findOne', id);
  }
}
