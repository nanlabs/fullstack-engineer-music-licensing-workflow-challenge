import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Track } from '../../tracks/entities/track.entity';
import { LicenseStatusEnum } from '../../../common/enums/license-status.enum';

@Entity('license_statuses')
export class LicenseStatus {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: LicenseStatusEnum,
    default: LicenseStatusEnum.PENDING,
  })
  status: LicenseStatusEnum;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => Track, (track) => track.licenseStatusesHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trackId' })
  track: Track;

  @CreateDateColumn()
  createdAt: Date;
}
