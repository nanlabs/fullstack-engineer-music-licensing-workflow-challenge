import { Scenes } from './scenes.entity'

export abstract class ScenesRepository {
  abstract findById(id: number): Promise<Scenes | null>
  abstract save(
    input: Omit<
      Scenes,
      'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'movie' | 'tracks'
    >,
  ): Promise<Scenes>
}
