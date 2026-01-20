'use client';

import { useState } from 'react';
import type { CreateSongDto } from '../../types';

interface CreateSongFormProps {
  onSubmit: (data: CreateSongDto) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CreateSongForm({ onSubmit, onCancel, isLoading }: CreateSongFormProps) {
  const [formData, setFormData] = useState<CreateSongDto>({
    title: '',
    releaseDate: new Date().getFullYear(),
    seconds: 180,
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Please enter a song title');
      return;
    }
    if (formData.seconds <= 0) {
      setError('Duration must be greater than 0');
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create song');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Enter song title"
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Release Year</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={formData.releaseDate}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '' || /^\d+$/.test(val)) {
              setFormData({ ...formData, releaseDate: val === '' ? 0 : parseInt(val, 10) });
            }
          }}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Duration (seconds)
        </label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={formData.seconds}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '' || /^\d+$/.test(val)) {
              setFormData({ ...formData, seconds: val === '' ? 0 : parseInt(val, 10) });
            }
          }}
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
          {isLoading ? 'Creating...' : 'Create Song'}
        </button>
      </div>
    </form>
  );
}
