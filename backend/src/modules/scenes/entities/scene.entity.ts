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
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
@Entity('scenes')
export class Scene {
  @Field(() => ID)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string;

  @Field(() => Int)
  @Column({ type: 'int' })
  sceneNumber: number;

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  durationSeconds: number;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string;

  //movie id
  @Field(() => ID)
  @Column({ type: 'int', name: 'movie_id' })
  movieId: number;

  @Field(() => Movie)
  @ManyToOne(() => Movie, (movie) => movie.scenes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'movie_id', foreignKeyConstraintName: 'fk_scenes_movie_id' })
  movie: Movie;

  @Field(() => [Track], { nullable: true })
  @OneToMany(() => Track, (track) => track.scene)
  tracks: Track[];

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
