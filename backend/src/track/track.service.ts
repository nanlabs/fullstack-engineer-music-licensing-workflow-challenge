import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Track } from '../entities/track.entity';
import { Scene } from '../entities/scene.entity';
import { Song } from '../entities/song.entity';
import { LicenseStatus } from '../entities/license-status.entity';

@Injectable()
export class TrackService {
  constructor(
    @InjectRepository(Track)
    private trackRepository: Repository<Track>,

    @InjectRepository(Scene)
    private sceneRepository: Repository<Scene>,

    @InjectRepository(Song)
    private songRepository: Repository<Song>,

    @InjectRepository(LicenseStatus)
    private licenseStatusRepository: Repository<LicenseStatus>,
  ) {}

  async create(data: {
    startTime: string;
    endTime: string;
    sceneId: number;
    songId: number;
    licenseStatusId: number;
  }): Promise<Track> {
    const scene = await this.sceneRepository.findOne({ where: { id: data.sceneId } });
    const song = await this.songRepository.findOne({ where: { id: data.songId } });
    const license = await this.licenseStatusRepository.findOne({ where: { id: data.licenseStatusId } });

    if (!scene || !song || !license) {
      throw new Error('Missing relation: scene, song, or license status not found');
    }
    
    const existingTrack = await this.trackRepository.findOne({
      where: {
        scene: { id: data.sceneId },
        song: { id: data.songId },
      },
      relations: ['scene', 'song'],
    });

    if (existingTrack) {
      throw new ConflictException(
        `There is already a track for the scene "${scene.name}" with the song "${song.title}"`
      );
    }

    const track = this.trackRepository.create({
      startTime: data.startTime,
      endTime: data.endTime,
      scene,
      song,
      licenseStatus: license,
    });

    return this.trackRepository.save(track);
  }

  async remove(id: number): Promise<void> {
    await this.trackRepository.delete(id);
  }

  async findAll(): Promise<Track[]> {
    return this.trackRepository.find({
      relations: ['scene', 'song', 'licenseStatus'],
    });
  }

  async findBySceneId(sceneId: number): Promise<Track[]> {
    return this.trackRepository.find({
      where: {
        scene: { id: sceneId },
      },
      relations: ['scene', 'song', 'licenseStatus'],
    });
  }
}
