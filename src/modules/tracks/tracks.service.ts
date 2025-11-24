import { Injectable } from '@nestjs/common';
import { Track } from '../../entities';
import { CreateTrackDto, UpdateTrackDto } from './dto';
import { TracksRepository } from './tracks.repository';
import { ResourceNotFoundException } from '../../common/exceptions';
import { ScenesRepository } from '../scenes/scenes.repository';
import { SongsRepository } from '../songs/songs.repository';

@Injectable()
export class TracksService {
  constructor(
    private tracksRepository: TracksRepository,
    private scenesRepository: ScenesRepository,
    private songsRepository: SongsRepository,
  ) {}

  async create(createTrackDto: CreateTrackDto): Promise<Track> {
    // Validate that scene exists
    const scene = await this.scenesRepository.findOne(createTrackDto.sceneId);
    if (!scene) {
      throw new ResourceNotFoundException('Scene', createTrackDto.sceneId);
    }

    // Validate that song exists
    const song = await this.songsRepository.findOne(createTrackDto.songId);
    if (!song) {
      throw new ResourceNotFoundException('Song', createTrackDto.songId);
    }

    return await this.tracksRepository.create(createTrackDto);
  }

  async findAll(): Promise<Track[]> {
    return await this.tracksRepository.findAll();
  }

  async findBySceneId(sceneId: string): Promise<Track[]> {
    return await this.tracksRepository.findBySceneId(sceneId);
  }

  async findOne(id: string): Promise<Track> {
    const track = await this.tracksRepository.findOne(id);
    if (!track) {
      throw new ResourceNotFoundException('Track', id);
    }
    return track;
  }

  async update(id: string, updateTrackDto: UpdateTrackDto): Promise<Track> {
    const track = await this.tracksRepository.update(id, updateTrackDto);
    if (!track) {
      throw new ResourceNotFoundException('Track', id);
    }
    return track;
  }

  async remove(id: string): Promise<{ message: string }> {
    const track = await this.tracksRepository.findOne(id);
    if (!track) {
      throw new ResourceNotFoundException('Track', id);
    }
    await this.tracksRepository.remove(id);
    return { message: 'Track deleted successfully' };
  }
}
