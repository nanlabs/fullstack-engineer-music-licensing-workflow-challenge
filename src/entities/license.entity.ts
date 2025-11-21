import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Track } from './track.entity';

export enum LicenseStatus {
  PENDING = 'PENDING',
  NEGOTIATING = 'NEGOTIATING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('licenses')
export class License {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Track, (track) => track.license, { onDelete: 'CASCADE' })
  @JoinColumn()
  track: Track;

  @Column({ type: 'uuid' })
  trackId: string;

  @Column({
    type: 'enum',
    enum: LicenseStatus,
    default: LicenseStatus.PENDING,
  })
  status: LicenseStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
