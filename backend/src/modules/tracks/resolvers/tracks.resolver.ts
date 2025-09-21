import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { TracksService } from '../services/tracks.service';
import { Track } from '../entities/track.entity';
import { CreateTrackInput } from '../dto/create-track.input';

@Resolver(() => Track)
export class TracksResolver {
  constructor(private readonly tracksService: TracksService) {}

  @Query(() => [Track], { name: 'tracks' })
  async findAll(
    @Args('sceneId', { type: () => Int, nullable: true }) sceneId?: number,
    @Args('movieId', { type: () => Int, nullable: true }) movieId?: number,
  ): Promise<Track[]> {
    if (sceneId) {
      return await this.tracksService.findByScene(sceneId);
    }
    if (movieId) {
      return await this.tracksService.findByMovie(movieId);
    }
    return await this.tracksService.findAll();
  }

  @Query(() => Track, { name: 'track' })
  async findOne(@Args('id', { type: () => ID }) id: number): Promise<Track> {
    return await this.tracksService.findOne(id);
  }

  @Query(() => [Track], { name: 'tracksByScene' })
  async findByScene(@Args('sceneId', { type: () => Int }) sceneId: number): Promise<Track[]> {
    return await this.tracksService.findByScene(sceneId);
  }

  @Query(() => [Track], { name: 'tracksByMovie' })
  async findByMovie(@Args('movieId', { type: () => Int }) movieId: number): Promise<Track[]> {
    return await this.tracksService.findByMovie(movieId);
  }

  @Mutation(() => Track)
  async createTrack(@Args('createTrackInput') createTrackInput: CreateTrackInput): Promise<Track> {
    return await this.tracksService.create(createTrackInput);
  }

  @Mutation(() => Boolean)
  async removeTrack(@Args('id', { type: () => ID }) id: number): Promise<boolean> {
    await this.tracksService.remove(id);
    return true;
  }
}
