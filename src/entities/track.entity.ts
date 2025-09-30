import { Entity, Column, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Scene } from './scene.entity';
import { Song } from './song.entity';
import { License } from './license.entity';

@Entity('tracks')
export class Track extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'int' })
  startTime: number; // in seconds, relative to scene start

  @Column({ type: 'int' })
  endTime: number; // in seconds, relative to scene start

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  volume: number; // 0.0 to 1.0

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'uuid' })
  sceneId: string;

  @Column({ type: 'uuid' })
  songId: string;

  @ManyToOne(() => Scene, (scene) => scene.tracks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sceneId' })
  scene: Scene;

  @ManyToOne(() => Song, (song) => song.tracks, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'songId' })
  song: Song;

  @OneToOne(() => License, (license) => license.track, { cascade: true })
  license: License;
}