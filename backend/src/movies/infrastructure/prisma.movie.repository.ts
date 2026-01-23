import { Injectable } from '@nestjs/common';
import { Movie, MovieRepository } from '../domain/movie.interface';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class PrismaMovieRepository implements MovieRepository {

    constructor(private readonly prisma : PrismaService ) {}
    
    async create(movie: Omit<Movie, 'id' | 'scenes'>): Promise<Movie> {
        return this.prisma.movie.create({
            data: movie,
        })
    }

    async findAll(): Promise<Movie[]> {
        return this.prisma.movie.findMany({
            include: {
                scenes: {
                    include: {
                        tracks: {
                            include: { song: true }
                        }
                    }
                }
            },
        })
    }

    async findOne(id: string): Promise<Movie | null> {
        return this.prisma.movie.findUnique({
            where: { id },
            include: {
                scenes: {
                    include: {
                        tracks: {
                            include: { song: true }
                        }
                    }
                }
            },
        })
    }

    async update(id: string, movie: Partial<Omit<Movie, 'id' | 'scenes'>>): Promise<Movie | null> {
        return this.prisma.movie.update({
            where: { id },
            data: movie,
        })
    }

    async remove(id: string): Promise<void> {
        await this.prisma.movie.delete({
            where: { id },
        })
    }
}