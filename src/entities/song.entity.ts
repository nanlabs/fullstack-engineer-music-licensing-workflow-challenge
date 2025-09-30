import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Track } from './track.entity';

@Entity('songs')
export class Song extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255 })
  artist: string;

  @Column({ type: 'int', nullable: true })
  duration?: number; // in seconds

  @Column({ type: 'varchar', length: 255, nullable: true })
  rightsHolder?: string;

  @OneToMany(() => Track, (track) => track.song)
  tracks: Track[];
}