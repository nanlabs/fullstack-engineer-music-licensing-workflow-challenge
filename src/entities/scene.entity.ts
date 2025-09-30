import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Movie } from './movie.entity';
import { Track } from './track.entity';

@Entity('scenes')
export class Scene extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'int' })
  sceneNumber: number;

  @Column({ type: 'int', nullable: true })
  startTimestamp?: number; // in seconds

  @Column({ type: 'int', nullable: true })
  endTimestamp?: number; // in seconds

  @Column({ type: 'uuid' })
  movieId: string;

  @ManyToOne(() => Movie, (movie) => movie.scenes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'movieId' })
  movie: Movie;

  @OneToMany(() => Track, (track) => track.scene, { cascade: true })
  tracks: Track[];
}