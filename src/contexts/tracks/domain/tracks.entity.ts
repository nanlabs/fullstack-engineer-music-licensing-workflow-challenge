import { JoinColumn, ManyToOne, OneToOne, Column, Entity, Check } from 'typeorm'

import { BaseEntity } from '@/src/app/database/entities/base.entity'

import { Licenses } from '../../licenses/domain/licenses.entity'
import { Scenes } from '../../scenes/domain/scenes.entity'
import { Songs } from '../../songs/domain/songs.entity'

@Entity('tracks')
@Check(`"end_time" > "start_time"`)
@Check(`"start_time" >= 0`)
export class Tracks extends BaseEntity {
  @Column({ type: 'int', unsigned: true, name: 'scene_id' })
  sceneId: number

  @Column({ type: 'int', unsigned: true, name: 'song_id' })
  songId: number

  @Column({
    type: 'int',
    name: 'start_time',
  })
  startTime: number

  @Column({
    type: 'int',
    name: 'end_time',
  })
  endTime: number

  @ManyToOne(() => Scenes)
  @JoinColumn({ name: 'scene_id' })
  scene: Scenes

  @ManyToOne(() => Songs)
  @JoinColumn({ name: 'song_id' })
  song: Songs

  @OneToOne(() => Licenses, license => license.track)
  license: Licenses
}
