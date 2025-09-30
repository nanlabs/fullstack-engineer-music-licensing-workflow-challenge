import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Track } from '../../entities/track.entity';
import { Scene } from '../../entities/scene.entity';
import { Song } from '../../entities/song.entity';
import { License } from '../../entities/license.entity';
import { LicensingStatus } from '../../entities/enums/licensing-status.enum';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';

@Injectable()
export class TracksService {
  constructor(
    @InjectRepository(Track)
    private readonly trackRepository: Repository<Track>,
    @InjectRepository(Scene)
    private readonly sceneRepository: Repository<Scene>,
    @InjectRepository(Song)
    private readonly songRepository: Repository<Song>,
    @InjectRepository(License)
    private readonly licenseRepository: Repository<License>,
  ) {}

  async create(createTrackDto: CreateTrackDto): Promise<Track> {
    const { sceneId, songId, startTime, endTime, ...trackData } = createTrackDto;

    // Validate start/end times
    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be less than end time');
    }

    // Find related entities
    const scene = await this.sceneRepository.findOne({ where: { id: sceneId } });
    if (!scene) {
      throw new NotFoundException(`Scene with ID ${sceneId} not found`);
    }

    const song = await this.songRepository.findOne({ where: { id: songId } });
    if (!song) {
      throw new NotFoundException(`Song with ID ${songId} not found`);
    }

    // Create track
    const track = this.trackRepository.create({
      ...trackData,
      startTime,
      endTime,
      scene,
      song,
    });

    const savedTrack = await this.trackRepository.save(track);

    // Create initial license record
    const license = this.licenseRepository.create({
      trackId: savedTrack.id,
      status: LicensingStatus.PENDING,
      lastStatusChange: new Date(),
    });

    await this.licenseRepository.save(license);

    return this.findOne(savedTrack.id);
  }

  async findAll(): Promise<Track[]> {
    return await this.trackRepository.find({
      relations: ['scene', 'song', 'license'],
    });
  }

  async findByScene(sceneId: string): Promise<Track[]> {
    return await this.trackRepository.find({
      where: { scene: { id: sceneId } },
      relations: ['song', 'license'],
    });
  }

  async findOne(id: string): Promise<Track> {
    const track = await this.trackRepository.findOne({
      where: { id },
      relations: ['scene', 'scene.movie', 'song', 'license'],
    });

    if (!track) {
      throw new NotFoundException(`Track with ID ${id} not found`);
    }

    return track;
  }

  async update(id: string, updateTrackDto: UpdateTrackDto): Promise<Track> {
    const track = await this.findOne(id);
    const { sceneId, songId, startTime, endTime, ...trackData } = updateTrackDto;

    // Validate start/end times if provided
    if (startTime !== undefined && endTime !== undefined && startTime >= endTime) {
      throw new BadRequestException('Start time must be less than end time');
    }

    // Update scene if provided
    if (sceneId) {
      const scene = await this.sceneRepository.findOne({ where: { id: sceneId } });
      if (!scene) {
        throw new NotFoundException(`Scene with ID ${sceneId} not found`);
      }
      track.scene = scene;
    }

    // Update song if provided
    if (songId) {
      const song = await this.songRepository.findOne({ where: { id: songId } });
      if (!song) {
        throw new NotFoundException(`Song with ID ${songId} not found`);
      }
      track.song = song;
    }

    Object.assign(track, trackData);
    if (startTime !== undefined) track.startTime = startTime;
    if (endTime !== undefined) track.endTime = endTime;

    return await this.trackRepository.save(track);
  }

  async remove(id: string): Promise<void> {
    const track = await this.findOne(id);
    await this.trackRepository.remove(track);
  }
}