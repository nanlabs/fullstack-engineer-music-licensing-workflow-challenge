import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LicenseStatusEnum } from '../../../common/enums/license-status.enum';
import { Song } from '../../songs/entities/song.entity';

@ObjectType()
@Entity('license_statuses')
export class LicenseStatus {
  @Field(() => ID)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => LicenseStatusEnum)
  @Column({
    type: 'enum',
    enum: LicenseStatusEnum,
    default: LicenseStatusEnum.PENDING,
  })
  status: LicenseStatusEnum;

  //song id
  @Field(() => ID)
  @Column({ type: 'int', name: 'song_id' })
  songId: number;

  @Field(() => Song)
  @ManyToOne(() => Song, (song) => song.licenseStatusesHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'song_id', foreignKeyConstraintName: 'fk_license_statuses_song_id' })
  song: Song;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
