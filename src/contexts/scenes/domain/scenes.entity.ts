import { JoinColumn, ManyToOne, OneToMany, Column, Entity } from 'typeorm'

import { BaseEntity } from '@/src/app/database/entities/base.entity'

import { Movies } from '../../movies/domain/movies.entity'
import { Tracks } from '../../tracks/domain/tracks.entity'

@Entity('scenes')
export class Scenes extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'int', unsigned: true, name: 'movie_id' })
  movieId: number

  @ManyToOne(() => Movies)
  @JoinColumn({ name: 'movie_id' })
  movie: Movies

  @OneToMany(() => Tracks, track => track.scene)
  tracks: Tracks[]
}
