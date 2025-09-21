import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { SongsService } from '../services/songs.service';
import { Song } from '../entities/song.entity';
import { CreateSongInput } from '../dto/create-song.input';

@Resolver(() => Song)
export class SongsResolver {
  constructor(private readonly songsService: SongsService) {}

  @Query(() => [Song], { name: 'songs' })
  async findAll(): Promise<Song[]> {
    return await this.songsService.findAll();
  }

  @Query(() => Song, { name: 'song' })
  async findOne(@Args('id', { type: () => ID }) id: number): Promise<Song> {
    return await this.songsService.findOne(id);
  }

  @Mutation(() => Song)
  async createSong(@Args('createSongInput') createSongInput: CreateSongInput): Promise<Song> {
    return await this.songsService.create(createSongInput);
  }

  @Mutation(() => Boolean)
  async removeSong(@Args('id', { type: () => ID }) id: number): Promise<boolean> {
    await this.songsService.remove(id);
    return true;
  }
}
