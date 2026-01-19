import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum LicensingStatus {
  LICENSED = 'LICENSED',
  IN_NEGOTIATION = 'IN_NEGOTIATION',
  UNLICENSED = 'UNLICENSED',
}

@Entity({ name: 'licensing' })
export class LicensingEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: LicensingStatus,
    default: LicensingStatus.UNLICENSED,
  })
  status: LicensingStatus;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  created_at: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updated_at: Date;
}
