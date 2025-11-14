import { Injectable, Logger } from '@nestjs/common';
import { CreateSongDto } from './dto/create-song.dto';

const logger = new Logger('SongsService');

@Injectable()
export class SongsService {
  create(createSongDto: CreateSongDto) {
    logger.log('create', createSongDto);
  }

  findAll() {
    logger.log('findAll');
  }

  findOne(id: string) {
    logger.log('findOne', id);
  }
}
