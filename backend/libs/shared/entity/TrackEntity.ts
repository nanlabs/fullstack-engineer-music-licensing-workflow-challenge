import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MovieSceneEntity } from './MovieSceneEntity';
import { SongEntity } from './SongEntity';
import { LicensingEntity } from './LicensingEntity';

@Entity({ name: 'track' })
export class TrackEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  startTime: number;

  @Column()
  endTime: number;

  @ManyToOne((type) => MovieSceneEntity)
  movieScene: MovieSceneEntity;

  @ManyToOne(() => SongEntity)
  song: SongEntity;

  @OneToOne(() => LicensingEntity)
  @JoinColumn()
  licensing: LicensingEntity;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  created_at?: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updated_at?: Date;
}
