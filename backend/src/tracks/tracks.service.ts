import { Injectable, Logger } from '@nestjs/common';
import { CreateTrackDto } from './dto/create-tracks.dto';
import { UpdateTrackStatusDto } from './dto/update-tracks.dto';

const logger = new Logger('TracksService');

@Injectable()
export class TracksService {
  createForScene(sceneId: string, createTrackDto: CreateTrackDto) {
    logger.log('createForScene', sceneId, createTrackDto);
  }

  findByScene(sceneId: string) {
    logger.log('findByScene', sceneId);
  }

  updateStatus(trackId: string, updateTrackStatusDto: UpdateTrackStatusDto) {
    logger.log('updateStatus', trackId, updateTrackStatusDto);
  }
}
