import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Scene } from 'src/scenes/entities/scene.entity';

@Entity()
export class Movie {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  releaseYear?: number;

  @OneToMany(() => Scene, (scene) => scene.movie)
  scenes: Scene[];
}
