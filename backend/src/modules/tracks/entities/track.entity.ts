import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Scene } from '../../scenes/entities/scene.entity';
import { Song } from '../../songs/entities/song.entity';

@ObjectType()
@Entity('tracks')
export class Track {
  @Field(() => ID)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Field(() => Float)
  @Column({ type: 'decimal', precision: 10, scale: 3 })
  startTimeSeconds: number;

  @Field(() => Float)
  @Column({ type: 'decimal', precision: 10, scale: 3 })
  endTimeSeconds: number;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string;

  //scene id
  @Field(() => ID)
  @Column({ type: 'int', name: 'scene_id' })
  sceneId: number;

  @Field(() => Scene)
  @ManyToOne(() => Scene, (scene) => scene.tracks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scene_id', foreignKeyConstraintName: 'fk_tracks_scene_id' })
  scene: Scene;

  //song id
  @Field(() => ID)
  @Column({ type: 'int', name: 'song_id' })
  songId: number;

  @Field(() => Song)
  @ManyToOne(() => Song, (song) => song.tracks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'song_id', foreignKeyConstraintName: 'fk_tracks_song_id' })
  song: Song;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
