import { env } from "../config/env"
import type { Movie } from "../types/movie"

export async function fetchMovies(): Promise<Movie[]> {
  const res = await fetch(`${env.apiBaseUrl}/movies`)
  if (!res.ok) {
    throw new Error("Failed to fetch movies")
  }
  return res.json()
}

export async function fetchMovie(id: string): Promise<Movie> {
  const res = await fetch(`${env.apiBaseUrl}/movies/${id}`)
  if (!res.ok) {
    throw new Error("Failed to fetch movie detail")
  }
  return res.json()
}