import { Injectable } from '@nestjs/common';
import { Track } from '../../entities';
import { CreateTrackDto, UpdateTrackDto } from './dto';
import { TracksRepository } from './tracks.repository';

@Injectable()
export class TracksService {
  constructor(private tracksRepository: TracksRepository) {}

  async create(createTrackDto: CreateTrackDto): Promise<Track> {
    return await this.tracksRepository.create(createTrackDto);
  }

  async findAll(): Promise<Track[]> {
    return await this.tracksRepository.findAll();
  }

  async findBySceneId(sceneId: string): Promise<Track[]> {
    return await this.tracksRepository.findBySceneId(sceneId);
  }

  async findOne(id: string): Promise<Track | null> {
    return await this.tracksRepository.findOne(id);
  }

  async update(
    id: string,
    updateTrackDto: UpdateTrackDto,
  ): Promise<Track | null> {
    return await this.tracksRepository.update(id, updateTrackDto);
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.tracksRepository.remove(id);
    return { message: 'Track deleted successfully' };
  }
}
