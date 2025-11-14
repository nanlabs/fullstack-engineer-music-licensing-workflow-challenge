import { Track } from 'src/tracks/entities/track.entity';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';

@Entity()
export class Song {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  artist: string;

  @Column({ nullable: true })
  album?: string;

  @Column({ type: 'int', nullable: true })
  durationSeconds?: number;

  @OneToMany(() => Track, (track) => track.song)
  tracks: Track[];
}
