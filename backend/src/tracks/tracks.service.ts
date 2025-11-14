import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateTrackDto } from './dto/create-tracks.dto';
import { UpdateTrackStatusDto } from './dto/update-tracks.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Scene } from 'src/scenes/entities/scene.entity';
import { Track } from './entities/track.entity';
import { Repository } from 'typeorm';
import { Song } from 'src/songs/entities/song.entity';
import { LicensingStatus } from './enums/licensing-status.enum';
import { SceneIdDto } from 'src/scenes/dto/scene-id.dto';
import { TrackIdDto } from './dto/track-id.dto';

const logger = new Logger('TracksService');

@Injectable()
export class TracksService {
  constructor(
    @InjectRepository(Track)
    private readonly trackRepo: Repository<Track>,
    @InjectRepository(Scene)
    private readonly sceneRepo: Repository<Scene>,
    @InjectRepository(Song)
    private readonly songRepo: Repository<Song>,
  ) {}

  async createForScene(sceneIdDto: SceneIdDto, createTrackDto: CreateTrackDto) {
    const sceneId = sceneIdDto.sceneId;
    try {
      const scene = await this.sceneRepo.findOne({ where: { id: sceneId } });
      if (!scene) {
        logger.warn(`Scene not found with id: ${sceneId}`);
        throw new NotFoundException(`Scene not found with id: ${sceneId}`);
      }

      const song = await this.songRepo.findOne({
        where: { id: createTrackDto.songId },
      });
      if (!song) {
        logger.warn(`Song not found with id: ${createTrackDto.songId}`);
        throw new NotFoundException(
          `Song not found with id: ${createTrackDto.songId}`,
        );
      }

      const track = this.trackRepo.create({
        scene,
        song,
        startTime: createTrackDto.startTime,
        endTime: createTrackDto.endTime,
        notes: createTrackDto.notes,
        licensingStatus: LicensingStatus.PENDING,
      });

      return await this.trackRepo.save(track);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      logger.error(`Error creating track: ${error}`);
      throw new InternalServerErrorException(error);
    }
  }

  async findByScene(sceneIdDto: SceneIdDto) {
    const sceneId = sceneIdDto.sceneId;
    try {
      const tracks = await this.trackRepo.find({
        where: { scene: { id: sceneId } },
        relations: ['scene', 'scene.movie'],
        order: { startTime: 'ASC' },
      });
      if (tracks.length === 0) {
        logger.warn(`No tracks found for scene with id: ${sceneId}`);
        return [];
      }
      return tracks;
    } catch (error) {
      logger.error(`Error finding tracks: ${error}`);
      throw new InternalServerErrorException(error);
    }
  }

  async updateStatus(
    trackIdDto: TrackIdDto,
    updateTrackStatusDto: UpdateTrackStatusDto,
  ) {
    try {
      const trackId = trackIdDto.trackId;
      const track = await this.trackRepo.findOne({
        where: { id: trackId },
        relations: ['scene', 'song'],
      });
      if (!track) {
        logger.warn(`Track not found with id: ${trackId}`);
        throw new NotFoundException(`Track not found with id: ${trackId}`);
      }
      track.licensingStatus = updateTrackStatusDto.status;
      return await this.trackRepo.save(track);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      logger.error(`Error updating track status: ${error}`);
      throw new InternalServerErrorException(error);
    }
  }
}
