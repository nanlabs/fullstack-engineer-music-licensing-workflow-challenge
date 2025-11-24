import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Track } from '../../entities';
import { CreateTrackDto, UpdateTrackDto } from './dto';

@Injectable()
export class TracksRepository {
  constructor(
    @InjectRepository(Track)
    private typeormRepository: Repository<Track>,
  ) {}

  async create(createTrackDto: CreateTrackDto): Promise<Track> {
    const track = this.typeormRepository.create(createTrackDto);
    return await this.typeormRepository.save(track);
  }

  async findAll(): Promise<Track[]> {
    return await this.typeormRepository.find({
      relations: ['scene', 'song', 'license'],
    });
  }

  async findBySceneId(sceneId: string): Promise<Track[]> {
    return await this.typeormRepository.find({
      where: { sceneId },
      relations: ['song', 'license'],
    });
  }

  async findOne(id: string): Promise<Track | null> {
    return await this.typeormRepository.findOne({
      where: { id },
      relations: ['scene', 'song', 'license'],
    });
  }

  async update(
    id: string,
    updateTrackDto: UpdateTrackDto,
  ): Promise<Track | null> {
    await this.typeormRepository.update(id, updateTrackDto);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.typeormRepository.delete(id);
  }
}
