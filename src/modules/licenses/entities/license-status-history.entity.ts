import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { License } from './license.entity';
import { Status } from './status.entity';

@Entity('License_Status_History')
export class LicenseStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  license_id: number;

  @Column({ type: 'int' })
  status_id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => License, (license) => license.licenseStatusHistories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'license_id' })
  license: License;

  @ManyToOne(() => Status, (status) => status.currentStatus)
  @JoinColumn({ name: 'status_id' })
  status: Status;
}
