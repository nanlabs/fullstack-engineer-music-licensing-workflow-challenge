import { useEffect, useState } from "react"
import { fetchMovie } from "../services/movies.api"
import type { Movie } from "../types/movie"

export function useMovieDetail(id: string) {
  const [movie, setMovie] = useState<Movie | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMovie(id)
      .then(setMovie)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])
  
  return { movie, loading, error }
}