import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LicenseStatus } from '../../licenses/entities/license-status.entity';
import { Track } from '../../tracks/entities/track.entity';

@ObjectType()
@Entity('songs')
export class Song {
  @Field(() => ID)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Field()
  @Column({ type: 'varchar', length: 255 })
  artist: string;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  album: string;

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  releaseYear: number;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  genre: string;

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  durationSeconds: number;

  @Field(() => [Track], { nullable: true })
  @OneToMany(() => Track, (track) => track.song)
  tracks: Track[];

  //current license status id
  @Field(() => ID, { nullable: true })
  @Column({ type: 'int', nullable: true, name: 'current_license_status_id' })
  currentLicenseStatusId: number | null;

  //current License Status
  @Field(() => LicenseStatus, { nullable: true })
  @ManyToOne(() => LicenseStatus, (licenseStatus) => licenseStatus.song, { onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'current_license_status_id',
    foreignKeyConstraintName: 'fk_songs_current_license_status_id',
  })
  currentLicenseStatus: LicenseStatus | null;

  @Field(() => [LicenseStatus], { nullable: true })
  @OneToMany(() => LicenseStatus, (licenseStatus) => licenseStatus.song, { cascade: true })
  licenseStatusesHistory: LicenseStatus[];

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
