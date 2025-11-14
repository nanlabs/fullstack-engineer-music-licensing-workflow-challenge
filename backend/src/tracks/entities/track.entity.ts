import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Scene } from '../../scenes/entities/scene.entity';
import { Song } from '../../songs/entities/song.entity';
import { LicensingStatus } from '../enums/licensing-status.enum';
@Entity()
@Index(['scene', 'song', 'startTime', 'endTime'], { unique: true })
export class Track {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Scene, (scene) => scene.tracks, { onDelete: 'CASCADE' })
  scene: Scene;

  @ManyToOne(() => Song, (song) => song.tracks, {
    eager: true,
  })
  song: Song;

  @Column({ type: 'numeric' })
  startTime: number;

  @Column({ type: 'numeric' })
  endTime: number;

  @Column({
    type: 'enum',
    enum: LicensingStatus,
    default: LicensingStatus.PENDING,
  })
  licensingStatus: LicensingStatus;

  @Column({ nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
