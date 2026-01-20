'use client';

import { useState } from 'react';
import type { Song, MovieScene, CreateTrackDto } from '../../types';

interface CreateTrackFormProps {
  songs: Song[];
  scenes: MovieScene[];
  onSubmit: (data: CreateTrackDto) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CreateTrackForm({
  songs,
  scenes,
  onSubmit,
  onCancel,
  isLoading,
}: CreateTrackFormProps) {
  const [formData, setFormData] = useState<CreateTrackDto>({
    songId: 0,
    movieSceneId: 0,
    startTime: 0,
    endTime: 60,
  });
  const [error, setError] = useState<string | null>(null);

  const selectedSong = songs.find((s) => s.id === formData.songId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.songId) {
      setError('Please select a song');
      return;
    }
    if (!formData.movieSceneId) {
      setError('Please select a movie scene');
      return;
    }
    if (formData.startTime >= formData.endTime) {
      setError('Start time must be less than end time');
      return;
    }
    if (selectedSong && formData.endTime > selectedSong.seconds) {
      setError(`End time cannot exceed song duration (${selectedSong.seconds}s)`);
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create track');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Song</label>
        <select
          value={formData.songId}
          onChange={(e) => setFormData({ ...formData, songId: Number(e.target.value) })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        >
          <option value={0}>Select a song...</option>
          {songs.map((song) => (
            <option key={song.id} value={song.id}>
              {song.title} ({song.seconds}s)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Movie Scene</label>
        <select
          value={formData.movieSceneId}
          onChange={(e) => setFormData({ ...formData, movieSceneId: Number(e.target.value) })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        >
          <option value={0}>Select a scene...</option>
          {scenes.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.movie?.title || 'Unknown'} - {scene.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Time (seconds)
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={formData.startTime}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || /^\d+$/.test(val)) {
                setFormData({ ...formData, startTime: val === '' ? 0 : parseInt(val, 10) });
              }
            }}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Time (seconds)
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={formData.endTime}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || /^\d+$/.test(val)) {
                setFormData({ ...formData, endTime: val === '' ? 0 : parseInt(val, 10) });
              }
            }}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>
      </div>

      {selectedSong && (
        <p className="text-xs text-gray-500">
          Song duration: {selectedSong.seconds} seconds
        </p>
      )}

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
          {isLoading ? 'Creating...' : 'Create Track'}
        </button>
      </div>
    </form>
  );
}
