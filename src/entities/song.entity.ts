import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Track } from './track.entity';

@Entity('songs')
export class Song {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 255 })
  artist!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  album?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  genre?: string;

  @Column({ type: 'int', nullable: true })
  duration?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  rightsHolder?: string;

  @OneToMany(() => Track, (track) => track.song)
  tracks!: Track[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
