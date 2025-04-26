import { Entity, PrimaryGeneratedColumn, Column, OneToOne } from 'typeorm';
import { Track } from './track.entity';

@Entity()
export class Song {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  artist: string;

  @Column({ type: 'int' })
  duration: number;

  @OneToOne(() => Track, (track) => track.song)
  track: Track;
}
