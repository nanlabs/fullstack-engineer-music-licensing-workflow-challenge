import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Scene } from './scene.entity';

@Entity()
export class Movie {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @OneToMany(() => Scene, (scene) => scene.movie)
  scenes: Scene[];
}
