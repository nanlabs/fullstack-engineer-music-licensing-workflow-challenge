import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Track } from './track.entity';
import { LicensingStatus } from './enums/licensing-status.enum';

@Entity('licenses')
export class License extends BaseEntity {
  @Column({
    type: 'enum',
    enum: LicensingStatus,
    default: LicensingStatus.PENDING,
  })
  status: LicensingStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  licenseFee?: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({ type: 'date', nullable: true })
  licenseStartDate?: Date;

  @Column({ type: 'date', nullable: true })
  licenseEndDate?: Date;

  @Column({ type: 'text', nullable: true })
  terms?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactPerson?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contactPhone?: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastStatusChange?: Date;

  @Column({ type: 'uuid' })
  trackId: string;

  @OneToOne(() => Track, (track) => track.license, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trackId' })
  track: Track;
}