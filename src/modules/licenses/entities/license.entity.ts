import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Track } from '../../tracks/entities/track.entity';
import { Status } from './status.entity';
import { LicenseStatusHistory } from './license-status-history.entity';

@Entity('License')
export class License {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  track_id: number;

  @Column({ type: 'int' })
  status_id: number;

  @OneToOne(() => Track, (track) => track.license)
  @JoinColumn({ name: 'track_id' })
  track: Track;

  @ManyToOne(() => Status, (status) => status.licenses)
  @JoinColumn({ name: 'status_id' })
  status: Status;

  @OneToMany(
    () => LicenseStatusHistory,
    (licenseStatusHistory) => licenseStatusHistory.license,
  )
  licenseStatusHistories: LicenseStatusHistory[];
}
