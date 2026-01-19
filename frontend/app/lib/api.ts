import type {
  Track,
  Song,
  Movie,
  MovieScene,
  Licensing,
  CreateTrackDto,
  CreateSongDto,
  CreateMovieDto,
  CreateMovieSceneDto,
  LicensingStatus,
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// Tracks API
export const tracksApi = {
  fetchAll: async (): Promise<Track[]> => {
    const response = await fetch(`${API_BASE_URL}/tracks`);
    return handleResponse<Track[]>(response);
  },

  fetchById: async (id: number): Promise<Track> => {
    const response = await fetch(`${API_BASE_URL}/tracks/${id}`);
    return handleResponse<Track>(response);
  },

  create: async (data: CreateTrackDto): Promise<Track> => {
    const response = await fetch(`${API_BASE_URL}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Track>(response);
  },

  updateLicensingStatus: async (id: number, status: LicensingStatus): Promise<Licensing> => {
    const response = await fetch(`${API_BASE_URL}/tracks/${id}/licensing`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return handleResponse<Licensing>(response);
  },
};

// Songs API
export const songsApi = {
  fetchAll: async (): Promise<Song[]> => {
    const response = await fetch(`${API_BASE_URL}/songs`);
    return handleResponse<Song[]>(response);
  },

  create: async (data: CreateSongDto): Promise<Song> => {
    const response = await fetch(`${API_BASE_URL}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Song>(response);
  },
};

// Movies API
export const moviesApi = {
  fetchAll: async (): Promise<Movie[]> => {
    const response = await fetch(`${API_BASE_URL}/movies`);
    return handleResponse<Movie[]>(response);
  },

  create: async (data: CreateMovieDto): Promise<Movie> => {
    const response = await fetch(`${API_BASE_URL}/movies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Movie>(response);
  },

  fetchScenes: async (): Promise<MovieScene[]> => {
    const response = await fetch(`${API_BASE_URL}/movies/scenes`);
    return handleResponse<MovieScene[]>(response);
  },

  createScene: async (data: CreateMovieSceneDto): Promise<MovieScene> => {
    const response = await fetch(`${API_BASE_URL}/movies/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<MovieScene>(response);
  },
};
