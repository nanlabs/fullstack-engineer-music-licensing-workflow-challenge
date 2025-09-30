import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Scene } from './scene.entity';

@Entity('movies')
export class Movie extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  director?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  producer?: string;

  @Column({ type: 'date', nullable: true })
  releaseDate?: Date;

  @Column({ type: 'varchar', length: 50, default: 'development' })
  status: string;

  @OneToMany(() => Scene, (scene) => scene.movie, { cascade: true })
  scenes: Scene[];
}