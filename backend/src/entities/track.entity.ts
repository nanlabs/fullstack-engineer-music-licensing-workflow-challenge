import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Scene } from './scene.entity';
import { Song } from './song.entity';
import { LicenseStatus } from './license-status.entity';

@Entity()
export class Track {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  startTime: string;

  @Column()
  endTime: string;

  @ManyToOne(() => LicenseStatus)
  licenseStatus: LicenseStatus;

  /* @OneToOne(() => Song)
  @JoinColumn()
  song: Song; */

  @ManyToOne(() => Song)
  song: Song;

  @ManyToOne(() => Scene)
  scene: Scene;
}
