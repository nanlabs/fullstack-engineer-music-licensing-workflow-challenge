import { Injectable } from '@nestjs/common';
import { TypeOrmRepositoryService } from 'libs/database/postgres/repository/service/typeorm-repository.service';
import { SongEntity } from 'libs/shared';
import { CreateSongDto } from 'libs/shared/dto/create-song.dto';

@Injectable()
export class SongService {
  constructor(
    private readonly typeOrmRepositoryService: TypeOrmRepositoryService,
  ) {}

  async findAll() {
    return this.typeOrmRepositoryService.songRepository.findAll();
  }

  async findById(id: number) {
    return this.typeOrmRepositoryService.songRepository.findById(id);
  }

  async create(createSongPayload: CreateSongDto) {
    const newSong = new SongEntity();
    newSong.releaseDate = createSongPayload.releaseDate;
    newSong.title = createSongPayload.title;
    newSong.seconds = createSongPayload.seconds;

    return this.typeOrmRepositoryService.songRepository.createOne(newSong);
  }
}
