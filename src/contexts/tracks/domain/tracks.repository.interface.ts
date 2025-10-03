import { Tracks } from './tracks.entity'

export abstract class TracksRepository {
  abstract insert(
    track: Pick<Tracks, 'sceneId' | 'songId' | 'startTime' | 'endTime'>,
  ): Promise<Tracks>
  abstract findOneByIdOrFail(id: number): Promise<Tracks>
  abstract findOneById(id: number): Promise<Tracks | null>
}
