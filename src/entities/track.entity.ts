import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Scene } from './scene.entity';
import { Song } from './song.entity';
import { License } from './license.entity';

@Entity('tracks')
export class Track {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ManyToOne(() => Scene, (scene) => scene.tracks, { onDelete: 'CASCADE' })
  scene: Scene;

  @Column({ type: 'uuid' })
  sceneId: string;

  @ManyToOne(() => Song, (song) => song.tracks)
  song: Song;

  @Column({ type: 'uuid' })
  songId: string;

  @OneToOne(() => License, (license) => license.track, { cascade: true })
  license: License;

  @Column({ type: 'int' })
  startTimeSeconds: number;

  @Column({ type: 'int' })
  endTimeSeconds: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
