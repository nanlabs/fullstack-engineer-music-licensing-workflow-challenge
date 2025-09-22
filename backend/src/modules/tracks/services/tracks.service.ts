import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ScenesService } from '../../scenes/services/scenes.service';
import { SongsService } from '../../songs/services/songs.service';
import { CreateTrackDto } from '../dto/create-track.dto';
import { Track } from '../entities/track.entity';
import { TracksRepository } from '../repositories/tracks.repository';

@Injectable()
export class TracksService {
  private readonly logger = new Logger(TracksService.name);

  constructor(
    private readonly tracksRepository: TracksRepository,
    private readonly scenesService: ScenesService,
    @Inject(forwardRef(() => SongsService))
    private readonly songsService: SongsService,
  ) {}

  async create(createTrackDto: CreateTrackDto): Promise<Track> {
    // Business rule: Validate timing constraints
    this.validateTrackTiming(createTrackDto);

    // Business rule: Scene must exist
    await this.scenesService.exists(createTrackDto.sceneId);

    // Business rule: Song must exist
    const songExists = await this.songsService.findOne(createTrackDto.songId);
    if (!songExists) {
      throw new NotFoundException(`Song with ID ${createTrackDto.songId} not found`);
    }

    // Create track
    const trackData = {
      ...createTrackDto,
    };
    const savedTrack = await this.tracksRepository.create(trackData);

    const finalTrack = await this.findOne(savedTrack.id);

    return finalTrack;
  }

  async findAll(): Promise<Track[]> {
    return await this.tracksRepository.findAll();
  }

  async findOne(id: number): Promise<Track> {
    const track = await this.tracksRepository.findById(id);

    if (!track) {
      throw new NotFoundException(`Track with ID ${id} not found`);
    }

    return track;
  }

  async findByScene(sceneId: number): Promise<Track[]> {
    return await this.tracksRepository.findBySceneId(sceneId);
  }

  async findByMovie(movieId: number): Promise<Track[]> {
    return await this.tracksRepository.findByMovieId(movieId);
  }

  async remove(id: number): Promise<void> {
    const track = await this.findOne(id);
    await this.tracksRepository.remove(track);
  }

  // Private business logic methods
  private validateTrackTiming(trackData: CreateTrackDto): void {
    if (trackData.endTimeSeconds <= trackData.startTimeSeconds) {
      throw new BadRequestException('End time must be after start time');
    }

    if (trackData.startTimeSeconds < 0) {
      throw new BadRequestException('Start time cannot be negative');
    }
  }
}
