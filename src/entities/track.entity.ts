import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Scene } from './scene.entity';
import { Song } from './song.entity';
import { LicensingStatus } from './licensing-status.entity';

export enum LicensingState {
  PENDING = 'pending',
  NEGOTIATING = 'negotiating',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Entity('tracks')
export class Track {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  sceneId!: string;

  @ManyToOne(() => Scene, scene => scene.tracks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sceneId' })
  scene!: Scene;

  @Column({ type: 'uuid' })
  songId!: string;

  @ManyToOne(() => Song, song => song.tracks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'songId' })
  song!: Song;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  startTime!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  endTime!: number;

  @Column({
    type: 'enum',
    enum: LicensingState,
    enumName: 'licensing_state_enum',
    default: LicensingState.PENDING,
  })
  currentLicensingStatus!: LicensingState;

  @OneToMany(() => LicensingStatus, status => status.track)
  licensingStatusHistory!: LicensingStatus[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
