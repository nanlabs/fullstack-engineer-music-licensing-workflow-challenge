import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Track, LicensingState } from './track.entity';

@Entity('licensing_statuses')
export class LicensingStatus {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  trackId!: string;

  @ManyToOne(() => Track, (track) => track.licensingStatusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trackId' })
  track!: Track;

  @Column({
    type: 'enum',
    enum: LicensingState,
    enumName: 'licensing_state_enum',
  })
  status!: LicensingState;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updatedBy?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
