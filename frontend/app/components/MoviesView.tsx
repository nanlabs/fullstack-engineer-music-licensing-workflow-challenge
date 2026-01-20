'use client';

import { useState } from 'react';
import type { Movie, MovieScene, Track, LicensingStatus } from '../types';
import { StatusBadge } from './StatusBadge';

interface MoviesViewProps {
  movies: Movie[];
  scenes: MovieScene[];
  tracks: Track[];
  onAddMovie: () => void;
  onAddScene: () => void;
  onAddTrack: () => void;
  onUpdateStatus: (trackId: number, status: LicensingStatus) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function MoviesView({
  movies,
  scenes,
  tracks,
  onAddMovie,
  onAddScene,
  onAddTrack,
  onUpdateStatus,
}: MoviesViewProps) {
  const [expandedMovieId, setExpandedMovieId] = useState<number | null>(null);

  // Get scenes for a movie
  const getScenesForMovie = (movieId: number) =>
    scenes.filter((scene) => scene.movie?.id === movieId);

  // Get tracks for a scene
  const getTracksForScene = (sceneId: number) =>
    tracks.filter((track) => track.movieScene?.id === sceneId);

  // Get licensing stats for a movie
  const getMovieStats = (movieId: number) => {
    const movieScenes = getScenesForMovie(movieId);
    const sceneIds = movieScenes.map((s) => s.id);
    const movieTracks = tracks.filter((t) => sceneIds.includes(t.movieScene?.id || 0));

    return {
      totalScenes: movieScenes.length,
      totalTracks: movieTracks.length,
      licensed: movieTracks.filter((t) => t.licensing?.status === 'LICENSED').length,
      inNegotiation: movieTracks.filter((t) => t.licensing?.status === 'IN_NEGOTIATION').length,
      unlicensed: movieTracks.filter((t) => t.licensing?.status === 'UNLICENSED').length,
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Movies & Scenes</h2>
        <div className="flex gap-2">
          <button
            onClick={onAddScene}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            + Add Scene
          </button>
          <button
            onClick={onAddMovie}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            + Add Movie
          </button>
        </div>
      </div>

      {movies.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No movies yet. Add your first movie to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {movies.map((movie) => {
            const stats = getMovieStats(movie.id);
            const isExpanded = expandedMovieId === movie.id;
            const movieScenes = getScenesForMovie(movie.id);

            return (
              <div
                key={movie.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                {/* Movie Header */}
                <div
                  className="px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedMovieId(isExpanded ? null : movie.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      <div>
                        <h3 className="font-medium text-gray-900">{movie.title}</h3>
                        <p className="text-sm text-gray-500">
                          {movie.releaseDate} • {movie.encodingFormat}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">
                        {stats.totalScenes} scene{stats.totalScenes !== 1 ? 's' : ''}
                      </span>
                      <span className="text-gray-500">
                        {stats.totalTracks} track{stats.totalTracks !== 1 ? 's' : ''}
                      </span>
                      {stats.totalTracks > 0 && (
                        <div className="flex gap-2">
                          {stats.licensed > 0 && (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                              {stats.licensed} licensed
                            </span>
                          )}
                          {stats.inNegotiation > 0 && (
                            <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">
                              {stats.inNegotiation} negotiating
                            </span>
                          )}
                          {stats.unlicensed > 0 && (
                            <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                              {stats.unlicensed} unlicensed
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Scenes and Tracks */}
                {isExpanded && (
                  <div className="border-t border-gray-200">
                    {movieScenes.length === 0 ? (
                      <div className="px-5 py-4 text-sm text-gray-500 bg-gray-50">
                        No scenes yet for this movie.
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddScene();
                          }}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          Add a scene
                        </button>
                      </div>
                    ) : (
                      movieScenes.map((scene) => {
                        const sceneTracks = getTracksForScene(scene.id);

                        return (
                          <div
                            key={scene.id}
                            className="border-b border-gray-100 last:border-b-0"
                          >
                            {/* Scene Header */}
                            <div className="px-5 py-3 bg-gray-50 flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <svg
                                  className="w-4 h-4 text-gray-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 4V2m0 2v2m0-2h10m0 0V2m0 2v2m-6 4h.01M7 16h.01M17 16h.01M7 12h.01M17 12h.01M12 12h.01M12 16h.01"
                                  />
                                </svg>
                                <span className="font-medium text-gray-700">{scene.name}</span>
                                <span className="text-sm text-gray-500">
                                  ({sceneTracks.length} track{sceneTracks.length !== 1 ? 's' : ''})
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddTrack();
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800"
                              >
                                + Add Track
                              </button>
                            </div>

                            {/* Tracks for Scene */}
                            {sceneTracks.length > 0 && (
                              <div className="divide-y divide-gray-100">
                                {sceneTracks.map((track) => (
                                  <div
                                    key={track.id}
                                    className="px-5 py-3 pl-12 flex items-center justify-between hover:bg-gray-50"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-900">
                                          {track.song?.title || `Track #${track.id}`}
                                        </span>
                                        <StatusBadge
                                          status={track.licensing?.status || 'UNLICENSED'}
                                        />
                                      </div>
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        {formatTime(track.startTime)} - {formatTime(track.endTime)}
                                        {track.song && ` • ${track.song.seconds}s total`}
                                      </p>
                                    </div>
                                    <select
                                      value={track.licensing?.status || 'UNLICENSED'}
                                      onChange={(e) =>
                                        onUpdateStatus(track.id, e.target.value as LicensingStatus)
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                      <option value="UNLICENSED">Unlicensed</option>
                                      <option value="IN_NEGOTIATION">In Negotiation</option>
                                      <option value="LICENSED">Licensed</option>
                                    </select>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
