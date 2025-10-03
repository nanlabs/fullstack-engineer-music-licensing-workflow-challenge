import { JoinColumn, OneToMany, OneToOne, Column, Entity } from 'typeorm'

import { BaseEntity } from '@/src/app/database/entities/base.entity'
import { LicenseStatus } from '@/src/app/database/types'

import { LicenseHistory } from '../../license-history/domain/license-history.entity'
import { Tracks } from '../../tracks/domain/tracks.entity'

@Entity('licenses')
export class Licenses extends BaseEntity {
  @Column({ type: 'int', unsigned: true, name: 'track_id' })
  trackId: number

  @Column({
    type: 'enum',
    enum: LicenseStatus,
  })
  status: LicenseStatus

  @Column({ type: 'varchar', length: 255, name: 'rights_holder' })
  rightsHolder: string

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes?: string | null

  @OneToOne(() => Tracks)
  @JoinColumn({ name: 'track_id' })
  track: Tracks

  @OneToMany(() => LicenseHistory, lh => lh.license)
  licenseHistory: LicenseHistory[]
}
