import { Injectable } from '@nestjs/common';
import { ScenesRepository } from './scenes.repository';
import { Prisma } from '@prisma/client';
import { CreateSceneDto } from './dto/scene.dto';

@Injectable()
export class ScenesService {
  constructor(private readonly scenesRepository: ScenesRepository) {}

  create(createSceneDto: CreateSceneDto) {
    const { movieId, ...sceneData } = createSceneDto;
    return this.scenesRepository.create({
      ...sceneData,
      movie: { connect: { id: movieId } },
    });
  }

  findAll() {
    return this.scenesRepository.findAll();
  }

  findOne(id: string) {
    return this.scenesRepository.findOne(id);
  }

  update(id: string, updateSceneDto: Prisma.SceneUpdateInput) {
    return this.scenesRepository.update(id, updateSceneDto);
  }

  remove(id: string) {
    return this.scenesRepository.remove(id);
  }
}
