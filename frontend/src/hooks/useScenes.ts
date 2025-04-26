import { useEffect, useState } from 'react';
import axios from 'axios';

type Scene = {
  id: number;
  name: string;
};

export function useScenes(movieId: string | number | undefined) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!movieId) return;

    const fetchScenes = async () => {
      try {
        const res = await axios.get(`http://localhost:3000/scene?movieId=${movieId}`);
        setScenes(res.data);
      } catch (error) {
        console.error('Error fetching scenes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchScenes();
  }, [movieId]);

  return { scenes, loading };
}
