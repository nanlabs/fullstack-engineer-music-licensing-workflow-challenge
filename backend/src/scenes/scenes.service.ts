import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateSceneDto } from './dto/create-scene.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scene } from './entities/scene.entity';
import { Movie } from 'src/movies/entities/movie.entity';
import { SceneIdDto } from './dto/scene-id.dto';
import { MovieIdDto } from 'src/movies/dto/movie-id.dto';

const logger = new Logger('ScenesService');

@Injectable()
export class ScenesService {
  constructor(
    @InjectRepository(Scene)
    private readonly sceneRepo: Repository<Scene>,
    @InjectRepository(Movie)
    private readonly movieRepo: Repository<Movie>,
  ) {}

  async create(createSceneDto: CreateSceneDto) {
    try {
      const { movieId, ...sceneData } = createSceneDto;
      const movie = await this.movieRepo.findOne({
        where: { id: movieId },
      });
      if (!movie) {
        logger.warn(`Movie not found with id: ${movieId}`);
        throw new NotFoundException(`Movie not found with id: ${movieId}`);
      }
      const scene = this.sceneRepo.create({
        ...sceneData,
        movie,
      });
      await this.sceneRepo.save(scene);
      logger.log(`Scene created: ${scene.id}`);
      return scene;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      logger.error(`Error creating scene: ${error}`);
      throw new InternalServerErrorException(error);
    }
  }

  async findAllByMovie(movieIdDto: MovieIdDto) {
    try {
      const movieId = movieIdDto.movieId;
      const scenes = await this.sceneRepo.find({
        where: { movie: { id: movieId } },
        relations: ['movie'],
      });
      if (scenes.length === 0) {
        logger.warn(`No scenes found for movie with id: ${movieId}`);
        return [];
      }
      return scenes;
    } catch (error) {
      logger.error(`Error finding scenes: ${error}`);
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(sceneIdDto: SceneIdDto) {
    const sceneId = sceneIdDto.sceneId;
    try {
      const scene = await this.sceneRepo.findOne({
        where: { id: sceneId },
        relations: ['movie'],
      });
      if (!scene) {
        logger.warn(`Scene not found with id: ${sceneId}`);
        throw new NotFoundException(`Scene not found with id: ${sceneId}`);
      }
      return scene;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      logger.error(`Error finding scene: ${error}`);
      throw new InternalServerErrorException(error);
    }
  }
}
