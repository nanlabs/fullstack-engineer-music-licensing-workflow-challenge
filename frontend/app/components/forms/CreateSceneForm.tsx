'use client';

import { useState } from 'react';
import type { Movie, CreateMovieSceneDto } from '../../types';

interface CreateSceneFormProps {
  movies: Movie[];
  onSubmit: (data: CreateMovieSceneDto) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CreateSceneForm({
  movies,
  onSubmit,
  onCancel,
  isLoading,
}: CreateSceneFormProps) {
  const [formData, setFormData] = useState<CreateMovieSceneDto>({
    name: '',
    movieId: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Please enter a scene name');
      return;
    }
    if (!formData.movieId) {
      setError('Please select a movie');
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scene');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Movie</label>
        <select
          value={formData.movieId}
          onChange={(e) => setFormData({ ...formData, movieId: Number(e.target.value) })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        >
          <option value={0}>Select a movie...</option>
          {movies.map((movie) => (
            <option key={movie.id} value={movie.id}>
              {movie.title} ({movie.releaseDate})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Scene Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Opening credits, Car chase, Final battle"
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? 'Creating...' : 'Create Scene'}
        </button>
      </div>
    </form>
  );
}
