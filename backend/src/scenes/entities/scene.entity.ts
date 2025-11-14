import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Movie } from '../../movies/entities/movie.entity';
import { Track } from 'src/tracks/entities/track.entity';

@Entity()
export class Scene {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'int', nullable: true })
  order?: number;

  @ManyToOne(() => Movie, (movie) => movie.scenes, { onDelete: 'CASCADE' })
  movie: Movie;

  @OneToMany(() => Track, (track) => track.scene)
  tracks: Track[];
}
