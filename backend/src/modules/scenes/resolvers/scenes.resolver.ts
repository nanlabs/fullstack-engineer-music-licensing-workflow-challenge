import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreateSceneInput } from '../dto/create-scene.input';
import { Scene } from '../entities/scene.entity';
import { ScenesService } from '../services/scenes.service';

@Resolver(() => Scene)
export class ScenesResolver {
  constructor(private readonly scenesService: ScenesService) {}

  @Query(() => [Scene], { name: 'scenes' })
  async findAll(): Promise<Scene[]> {
    return await this.scenesService.findAll();
  }

  @Query(() => Scene, { name: 'scene' })
  async findOne(@Args('id', { type: () => ID }) id: number): Promise<Scene> {
    return await this.scenesService.findOne(id);
  }

  @Query(() => [Scene], { name: 'scenesByMovie' })
  async findByMovie(@Args('movieId', { type: () => Int }) movieId: number): Promise<Scene[]> {
    return await this.scenesService.findByMovie(movieId);
  }

  @Mutation(() => Scene)
  async createScene(@Args('createSceneInput') createSceneInput: CreateSceneInput): Promise<Scene> {
    return await this.scenesService.create(createSceneInput);
  }
}
