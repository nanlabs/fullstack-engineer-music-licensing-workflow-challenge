import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Scene } from '../../scenes/entities/scene.entity';
import { Exclude } from 'class-transformer';

@Entity('Movie')
export class Movie {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Exclude()
  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;

  @OneToMany(() => Scene, (scene) => scene.movie)
  scenes: Scene[];
}
