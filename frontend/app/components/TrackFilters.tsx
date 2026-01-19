'use client';

import type { Movie, MovieScene } from '../types';

interface TrackFiltersProps {
  movies: Movie[];
  scenes: MovieScene[];
  selectedMovieId: number | null;
  selectedSceneId: number | null;
  onMovieChange: (movieId: number | null) => void;
  onSceneChange: (sceneId: number | null) => void;
}

export function TrackFilters({
  movies,
  scenes,
  selectedMovieId,
  selectedSceneId,
  onMovieChange,
  onSceneChange,
}: TrackFiltersProps) {
  // Filter scenes based on selected movie
  const filteredScenes = selectedMovieId
    ? scenes.filter((scene) => scene.movie?.id === selectedMovieId)
    : scenes;

  const handleMovieChange = (movieId: number | null) => {
    onMovieChange(movieId);
    // Reset scene selection when movie changes
    onSceneChange(null);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Filter by:</label>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Movie:</label>
          <select
            value={selectedMovieId ?? ''}
            onChange={(e) => handleMovieChange(e.target.value ? Number(e.target.value) : null)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Movies</option>
            {movies.map((movie) => (
              <option key={movie.id} value={movie.id}>
                {movie.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Scene:</label>
          <select
            value={selectedSceneId ?? ''}
            onChange={(e) => onSceneChange(e.target.value ? Number(e.target.value) : null)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Scenes</option>
            {filteredScenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                {scene.movie?.title ? `${scene.movie.title} - ` : ''}{scene.name}
              </option>
            ))}
          </select>
        </div>

        {(selectedMovieId || selectedSceneId) && (
          <button
            onClick={() => {
              onMovieChange(null);
              onSceneChange(null);
            }}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
