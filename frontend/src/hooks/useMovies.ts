import { useEffect, useState } from 'react';
import { getMovies } from '@/services/movieService';

type Movie = {
  id: number;
  title: string;
  description: string;
};

export function useMovies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getMovies();
        setMovies(data);
      } catch (error) {
        console.error('Error fetching movies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { movies, loading };
}
