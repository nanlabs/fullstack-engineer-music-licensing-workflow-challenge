import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Scene } from '../../scenes/entities/scene.entity';

@ObjectType()
@Entity('movies')
export class Movie {
  @Field(() => ID)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  director: string;

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  releaseYear: number;

  @Field()
  @Column({ type: 'varchar', length: 50, default: 'development' })
  status: string; // development, pre-production, production, post-production, released

  @Field(() => [Scene], { nullable: true })
  @OneToMany(() => Scene, (scene) => scene.movie, { cascade: true })
  scenes: Scene[];

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
