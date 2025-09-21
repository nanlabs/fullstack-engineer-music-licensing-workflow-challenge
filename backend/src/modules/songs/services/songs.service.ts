import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { LicenseStatusEnum } from '../../../common/enums/license-status.enum';
import { LicensesService } from '../../licenses/services/licenses.service';
import { CreateSongDto } from '../dto/create-song.dto';
import { Song } from '../entities/song.entity';
import { SongsRepository } from '../repositories/songs.repository';

@Injectable()
export class SongsService {
  constructor(
    private readonly songsRepository: SongsRepository,
    @Inject(forwardRef(() => LicensesService))
    private readonly licensesService: LicensesService,
  ) {}

  async create(createSongDto: CreateSongDto): Promise<Song> {
    // Business rule: Validate song data
    this.validateSongData(createSongDto);

    const song = await this.songsRepository.create(createSongDto);

    // Business rule: Create initial license status
    await this.licensesService.updateSongLicenseStatus(song.id, {
      status: LicenseStatusEnum.PENDING,
    });

    return song;
  }

  async findAll(): Promise<Song[]> {
    return await this.songsRepository.findAll();
  }

  async findOne(id: number): Promise<Song> {
    const song = await this.songsRepository.findById(id);

    if (!song) {
      throw new NotFoundException(`Song with ID ${id} not found`);
    }

    return song;
  }

  async update(id: number, updateSongDto: Partial<CreateSongDto>): Promise<Song> {
    // Business rule: Song must exist
    const song = await this.findOne(id);

    // Business rule: Validate update data
    this.validateSongData(updateSongDto);

    Object.assign(song, updateSongDto);
    return await this.songsRepository.update(song);
  }

  async remove(id: number): Promise<void> {
    const song = await this.findOne(id);
    await this.songsRepository.remove(song);
  }

  async search(query: string): Promise<Song[]> {
    return await this.songsRepository.search(query);
  }

  async exists(id: number): Promise<boolean> {
    return await this.songsRepository.exists(id);
  }

  // Private business logic methods
  private validateSongData(songData: CreateSongDto | Partial<CreateSongDto>): void {
    if (
      songData.releaseYear &&
      (songData.releaseYear < 1900 || songData.releaseYear > new Date().getFullYear())
    ) {
      throw new Error('Release year must be between 1900 and current year');
    }

    if (songData.durationSeconds && songData.durationSeconds <= 0) {
      throw new Error('Duration must be positive');
    }
  }
}
