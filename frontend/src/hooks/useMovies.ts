import { useEffect, useState } from "react"
import { fetchMovies } from "../services/movies.api"
import type { Movie } from "../types/movie"

export function useMovies() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMovies()
      .then(setMovies)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { movies, loading, error }
}
