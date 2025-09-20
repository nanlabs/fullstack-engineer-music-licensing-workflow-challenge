import { Track } from '../../tracks/entities/track.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('songs')
export class Song {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255 })
  artist: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  album: string;

  @Column({ type: 'int', nullable: true })
  releaseYear: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  genre: string;

  @Column({ type: 'int', nullable: true })
  durationSeconds: number;

  @OneToMany(() => Track, (track) => track.song)
  tracks: Track[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
