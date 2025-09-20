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
import { Scene } from '../../scenes/entities/scene.entity';
import { Song } from '../../songs/entities/song.entity';
import { LicenseStatus } from '../../licenses/entities/license-status.entity';

@Entity('tracks')
export class Track {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  startTimeSeconds: number;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  endTimeSeconds: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => Scene, (scene) => scene.tracks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scene_id' })
  scene: Scene;

  //current License Status
  @ManyToOne(() => LicenseStatus, (licenseStatus) => licenseStatus.track, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'current_license_status_id' })
  currentLicenseStatus: LicenseStatus;

  @ManyToOne(() => Song, (song) => song.tracks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'song_id' })
  song: Song;

  @OneToMany(() => LicenseStatus, (licenseStatus) => licenseStatus.track, { cascade: true })
  licenseStatusesHistory: LicenseStatus[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
