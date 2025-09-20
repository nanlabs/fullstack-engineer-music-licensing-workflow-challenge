import { Scene } from '../../scenes/entities/scene.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('movies')
export class Movie {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  director: string;

  @Column({ type: 'int', nullable: true })
  releaseYear: number;

  @Column({ type: 'varchar', length: 50, default: 'development' })
  status: string; // development, pre-production, production, post-production, released

  @OneToMany(() => Scene, (scene) => scene.movie, { cascade: true })
  scenes: Scene[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
