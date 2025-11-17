import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Track } from '../../tracks/entities/track.entity';
import { Exclude } from 'class-transformer';

@Entity('Song')
export class Song {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255 })
  artist: string;

  @Column({ type: 'varchar', length: 255 })
  genre: string;

  @Exclude()
  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Track, (track) => track.song)
  tracks: Track[];
}
