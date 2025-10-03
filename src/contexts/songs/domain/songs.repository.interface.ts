import { CreateSongRequestDto } from '../infrastructure/controllers/dtos/create-song.request.dto'
import { Songs } from './songs.entity'

export abstract class SongsRepository {
  abstract findById(id: number): Promise<Songs | null>
  abstract insert(song: CreateSongRequestDto): Promise<Songs>
  abstract findByName(name: string): Promise<Songs | null>
}
