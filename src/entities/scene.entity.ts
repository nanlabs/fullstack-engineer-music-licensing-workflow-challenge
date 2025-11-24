import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Movie } from './movie.entity';
import { Track } from './track.entity';

@Entity('scenes')
@Unique(['movieId', 'sceneNumber']) // i think that sceneNumber should be unique per movie. Each movie can contains multiple scenes, but each scene should be unique within that movie.
export class Scene {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int' })
  sceneNumber: number;

  @ManyToOne(() => Movie, (movie) => movie.scenes, { onDelete: 'CASCADE' })
  movie: Movie;

  @Column({ type: 'uuid' })
  movieId: string;

  @OneToMany(() => Track, (track) => track.scene, { cascade: true })
  tracks: Track[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
