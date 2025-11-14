import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateSongDto } from './dto/create-song.dto';
import { Song } from './entities/song.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SongIdDto } from './dto/song-id.dto';

const logger = new Logger('SongsService');

@Injectable()
export class SongsService {
  constructor(
    @InjectRepository(Song)
    private readonly songRepo: Repository<Song>,
  ) {}

  async create(createSongDto: CreateSongDto) {
    try {
      const song = this.songRepo.create(createSongDto);
      await this.songRepo.save(song);
      logger.log(`Song created: ${song.id}`);
      return song;
    } catch (error) {
      logger.error(`Error creating song: ${error}`);
      throw new InternalServerErrorException(error);
    }
  }

  async findAll() {
    try {
      const songs = await this.songRepo.find();
      if (songs.length === 0) {
        logger.warn('No songs found');
        return [];
      }
      return songs;
    } catch (error) {
      logger.error(`Error finding songs: ${error}`);
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(songIdDto: SongIdDto) {
    const songId = songIdDto.songId;
    try {
      const song = await this.songRepo.findOne({ where: { id: songId } });
      if (!song) {
        logger.warn(`Song not found with id: ${songId}`);
        throw new NotFoundException(`Song not found with id: ${songId}`);
      }
      return song;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      logger.error(`Error finding song: ${error}`);
      throw new InternalServerErrorException(error);
    }
  }
}
