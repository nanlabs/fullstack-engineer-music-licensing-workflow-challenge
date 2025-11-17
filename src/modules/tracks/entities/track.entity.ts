import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Scene } from '../../scenes/entities/scene.entity';
import { Song } from '../../songs/entities/song.entity';
import { License } from '../../licenses/entities/license.entity';
import { Exclude } from 'class-transformer';

@Entity('Track')
export class Track {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  scene_id: number;

  @Column({ type: 'int' })
  song_id: number;

  @Column({ type: 'int' })
  start_time_seconds: number;

  @Column({ type: 'int' })
  end_time_seconds: number;

  @Exclude()
  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Scene, (scene) => scene.tracks)
  @JoinColumn({ name: 'scene_id' })
  scene: Scene;

  @ManyToOne(() => Song, (song) => song.tracks)
  @JoinColumn({ name: 'song_id' })
  song: Song;

  @OneToOne(() => License, (license) => license.track)
  license: License;
}
