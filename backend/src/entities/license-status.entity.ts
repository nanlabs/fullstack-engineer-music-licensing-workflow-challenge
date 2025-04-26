import { Entity, PrimaryGeneratedColumn, Column, OneToOne } from 'typeorm';
import { Track } from './track.entity';

export enum Status {
  PENDING = 'PENDING',
  NEGOTIATION = 'NEGOTIATION',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity()
export class LicenseStatus {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: Status,
  })
  status: Status;

  @Column({ nullable: true })
  updatedAt: Date;

  @OneToOne(() => Track, (track) => track.licenseStatus)
  track: Track;
}
