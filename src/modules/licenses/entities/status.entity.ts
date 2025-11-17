import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { License } from './license.entity';
import { LicenseStatusHistory } from './license-status-history.entity';

@Entity('Status')
export class Status {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @OneToMany(() => License, (license) => license.status)
  licenses: License[];

  @OneToMany(
    () => LicenseStatusHistory,
    (licenseStatusHistory) => licenseStatusHistory.status,
  )
  currentStatus: LicenseStatusHistory[];
}
