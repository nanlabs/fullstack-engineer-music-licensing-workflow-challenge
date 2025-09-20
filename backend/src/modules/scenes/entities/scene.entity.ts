import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Movie } from '../../movies/entities/movie.entity';
import { Track } from '../../tracks/entities/track.entity';

@Entity('scenes')
export class Scene {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int' })
  sceneNumber: number;

  @Column({ type: 'int', nullable: true })
  durationSeconds: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => Movie, (movie) => movie.scenes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'movie_id' })
  movie: Movie;

  @OneToMany(() => Track, (track) => track.scene)
  tracks: Track[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
