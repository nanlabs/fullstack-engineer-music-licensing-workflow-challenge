import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Movie } from './movie.entity';
import { Track } from './track.entity';

@Entity()
export class Scene {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => Movie, (movie) => movie.scenes)
  movie: Movie;

  @OneToMany(() => Track, (track) => track.scene)
  tracks: Track[];
}
