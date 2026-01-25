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
import { Movie } from './movie.entity';
import { Track } from './track.entity';

@Entity('scenes')
export class Scene {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  movieId!: string;

  @ManyToOne(() => Movie, (movie) => movie.scenes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'movieId' })
  movie!: Movie;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'int', nullable: true })
  sceneNumber?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  startTime?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  endTime?: number;

  @OneToMany(() => Track, (track) => track.scene)
  tracks!: Track[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
