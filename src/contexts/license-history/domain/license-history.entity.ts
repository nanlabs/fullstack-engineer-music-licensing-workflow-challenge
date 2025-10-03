import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  JoinColumn,
  ManyToOne,
  Column,
  Entity,
  Check,
} from 'typeorm'

import { LicenseStatus } from '@/src/app/database/types'

import { Licenses } from '../../licenses/domain/licenses.entity'

@Entity('license_history')
@Check(`old_status::text <> new_status::text`)
export class LicenseHistory {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number

  @Column({ type: 'int', unsigned: true, name: 'license_id' })
  licenseId: number

  @Column({
    type: 'enum',
    enum: LicenseStatus,
    name: 'old_status',
  })
  oldStatus: LicenseStatus

  @Column({
    type: 'enum',
    enum: LicenseStatus,
    name: 'new_status',
  })
  newStatus: LicenseStatus

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @ManyToOne(() => Licenses)
  @JoinColumn({ name: 'license_id' })
  license: Licenses
}
