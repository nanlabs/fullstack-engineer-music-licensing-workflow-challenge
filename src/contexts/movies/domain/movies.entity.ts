import { OneToMany, Column, Entity } from 'typeorm'

import { BaseEntity } from '@/src/app/database/entities/base.entity'

import { Scenes } from '../../scenes/domain/scenes.entity'

@Entity('movies')
export class Movies extends BaseEntity {
  @Column({ type: 'varchar', name: 'name', length: 255 })
  name: string

  @OneToMany(() => Scenes, scene => scene.movie)
  scenes: Scenes[]
}
