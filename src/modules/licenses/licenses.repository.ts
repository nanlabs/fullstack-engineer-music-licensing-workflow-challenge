import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { License } from '../../entities';
import { CreateLicenseDto, UpdateLicenseStatusDto } from './dto';

@Injectable()
export class LicensesRepository {
  constructor(
    @InjectRepository(License)
    private typeormRepository: Repository<License>,
  ) {}

  async create(createLicenseDto: CreateLicenseDto): Promise<License> {
    const license = this.typeormRepository.create(createLicenseDto);
    return await this.typeormRepository.save(license);
  }

  async findAll(): Promise<License[]> {
    return await this.typeormRepository.find({
      relations: ['track', 'track.song', 'track.scene'],
    });
  }

  async findOne(id: string): Promise<License | null> {
    return await this.typeormRepository.findOne({
      where: { id },
      relations: ['track', 'track.song', 'track.scene'],
    });
  }

  async findByTrackId(trackId: string): Promise<License | null> {
    return await this.typeormRepository.findOne({
      where: { trackId },
      relations: ['track', 'track.song', 'track.scene'],
    });
  }

  async update(
    id: string,
    updateLicenseStatusDto: UpdateLicenseStatusDto,
  ): Promise<void> {
    await this.typeormRepository.update(id, {
      status: updateLicenseStatusDto.status,
      notes: updateLicenseStatusDto.notes,
    });
  }

  async remove(id: string): Promise<void> {
    await this.typeormRepository.delete(id);
  }
}
