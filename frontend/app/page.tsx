"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "./components/Header";
import { StatsCards } from "./components/StatsCards";
import { TrackList } from "./components/TrackList";
import { TrackFilters } from "./components/TrackFilters";
import { LiveUpdates } from "./components/LiveUpdates";
import { QuickActions } from "./components/QuickActions";
import { MoviesView } from "./components/MoviesView";
import { Modal } from "./components/Modal";
import { CreateTrackForm } from "./components/forms/CreateTrackForm";
import { CreateSongForm } from "./components/forms/CreateSongForm";
import { CreateMovieForm } from "./components/forms/CreateMovieForm";
import { CreateSceneForm } from "./components/forms/CreateSceneForm";
import { useSSE } from "./hooks/useSSE";
import { tracksApi, songsApi, moviesApi } from "./lib/api";
import type {
  Track,
  Song,
  Movie,
  MovieScene,
  LicensingStatus,
  LicensingStatusUpdate,
} from "./types";

type ModalType = "track" | "song" | "movie" | "scene" | null;
type TabType = "dashboard" | "movies" | "songs" | "tracks";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [scenes, setScenes] = useState<MovieScene[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);

  const fetchTracks = useCallback(async () => {
    try {
      const data = await tracksApi.fetchAll();
      setTracks(data);
    } catch (error) {
      console.error("Failed to fetch tracks:", error);
    }
  }, []);

  // SSE callbacks - memoized to avoid unnecessary re-renders
  const handleSSELicensingUpdate = useCallback(
    (update: LicensingStatusUpdate) => {
      setTracks((prev) =>
        prev.map((track) =>
          track.id === update.trackId
            ? {
                ...track,
                licensing: {
                  ...track.licensing!,
                  status: update.newStatus as LicensingStatus,
                },
              }
            : track,
        ),
      );
    },
    [],
  );

  const handleSSETrackCreated = useCallback(() => {
    fetchTracks();
  }, [fetchTracks]);

  const { isConnected, notifications, clearNotifications } = useSSE({
    onLicensingStatusUpdate: handleSSELicensingUpdate,
    onTrackCreated: handleSSETrackCreated,
  });

  const filteredTracks = useMemo(() => {
    let result = tracks;

    if (selectedSceneId) {
      result = result.filter(
        (track) => track.movieScene?.id === selectedSceneId,
      );
    } else if (selectedMovieId) {
      const movieSceneIds = scenes
        .filter((scene) => scene.movie?.id === selectedMovieId)
        .map((scene) => scene.id);
      result = result.filter((track) =>
        movieSceneIds.includes(track.movieScene?.id || 0),
      );
    }

    return result;
  }, [tracks, scenes, selectedMovieId, selectedSceneId]);

  const fetchSongs = useCallback(async () => {
    try {
      const data = await songsApi.fetchAll();
      setSongs(data);
    } catch (error) {
      console.error("Failed to fetch songs:", error);
    }
  }, []);

  const fetchMovies = useCallback(async () => {
    try {
      const data = await moviesApi.fetchAll();
      setMovies(data);
    } catch (error) {
      console.error("Failed to fetch movies:", error);
    }
  }, []);

  const fetchScenes = useCallback(async () => {
    try {
      const data = await moviesApi.fetchScenes();
      setScenes(data);
    } catch (error) {
      console.error("Failed to fetch scenes:", error);
    }
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchTracks(),
        fetchSongs(),
        fetchMovies(),
        fetchScenes(),
      ]);
      setIsLoading(false);
    };
    fetchAllData();
  }, [fetchTracks, fetchSongs, fetchMovies, fetchScenes]);

  const handleUpdateLicensingStatus = async (
    trackId: number,
    status: LicensingStatus,
  ) => {
    try {
      await tracksApi.updateLicensingStatus(trackId, status);
      setTracks((prev) =>
        prev.map((track) =>
          track.id === trackId
            ? { ...track, licensing: { ...track.licensing!, status } }
            : track,
        ),
      );
    } catch (error) {
      console.error("Failed to update licensing status:", error);
      fetchTracks();
    }
  };

  const handleCreateTrack = async (
    data: Parameters<typeof tracksApi.create>[0],
  ) => {
    setIsSubmitting(true);
    try {
      await tracksApi.create(data);
      setActiveModal(null);
      await fetchTracks();
    } catch (error) {
      setIsSubmitting(false);
      throw error; // Re-throw so the form can display the error
    }
    setIsSubmitting(false);
  };

  const handleCreateSong = async (
    data: Parameters<typeof songsApi.create>[0],
  ) => {
    setIsSubmitting(true);
    try {
      await songsApi.create(data);
      setActiveModal(null);
      await fetchSongs();
    } catch (error) {
      setIsSubmitting(false);
      throw error;
    }
    setIsSubmitting(false);
  };

  const handleCreateMovie = async (
    data: Parameters<typeof moviesApi.create>[0],
  ) => {
    setIsSubmitting(true);
    try {
      await moviesApi.create(data);
      setActiveModal(null);
      await fetchMovies();
    } catch (error) {
      setIsSubmitting(false);
      throw error;
    }
    setIsSubmitting(false);
  };

  const handleCreateScene = async (
    data: Parameters<typeof moviesApi.createScene>[0],
  ) => {
    setIsSubmitting(true);
    try {
      await moviesApi.createScene(data);
      setActiveModal(null);
      await fetchScenes();
    } catch (error) {
      setIsSubmitting(false);
      throw error;
    }
    setIsSubmitting(false);
  };

  // Get filter description for display
  const getFilterDescription = () => {
    if (selectedSceneId) {
      const scene = scenes.find((s) => s.id === selectedSceneId);
      return scene
        ? `${scene.movie?.title || "Unknown"} - ${scene.name}`
        : null;
    }
    if (selectedMovieId) {
      const movie = movies.find((m) => m.id === selectedMovieId);
      return movie ? movie.title : null;
    }
    return null;
  };

  /*
   * This component is for the sake of having an spa
   */
  const renderContent = () => {
    switch (activeTab) {
      case "movies":
        return (
          <MoviesView
            movies={movies}
            scenes={scenes}
            tracks={tracks}
            onAddMovie={() => setActiveModal("movie")}
            onAddScene={() => setActiveModal("scene")}
            onAddTrack={() => setActiveModal("track")}
            onUpdateStatus={handleUpdateLicensingStatus}
          />
        );

      case "songs":
        return (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">Songs Library</h2>
              <button
                onClick={() => setActiveModal("song")}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                + Add Song
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {songs.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-500">
                  No songs yet. Add your first song to get started.
                </div>
              ) : (
                songs.map((song) => (
                  <div key={song.id} className="px-5 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {song.title}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {song.releaseDate} • {Math.floor(song.seconds / 60)}:
                          {(song.seconds % 60).toString().padStart(2, "0")}
                        </p>
                      </div>
                      <span className="text-sm text-gray-400">
                        {tracks.filter((t) => t.song?.id === song.id).length}{" "}
                        track(s)
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case "tracks":
      case "dashboard":
      default:
        const filterDesc = getFilterDescription();
        return (
          <>
            <StatsCards
              tracks={activeTab === "tracks" ? filteredTracks : tracks}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {activeTab === "tracks" && (
                  <TrackFilters
                    movies={movies}
                    scenes={scenes}
                    selectedMovieId={selectedMovieId}
                    selectedSceneId={selectedSceneId}
                    onMovieChange={setSelectedMovieId}
                    onSceneChange={setSelectedSceneId}
                  />
                )}

                {filterDesc && activeTab === "tracks" && (
                  <div className="mb-4 text-sm text-gray-600">
                    Showing tracks for:{" "}
                    <span className="font-medium">{filterDesc}</span>
                    <span className="ml-2 text-gray-400">
                      ({filteredTracks.length} track
                      {filteredTracks.length !== 1 ? "s" : ""})
                    </span>
                  </div>
                )}

                <TrackList
                  tracks={activeTab === "tracks" ? filteredTracks : tracks}
                  onAddTrack={() => setActiveModal("track")}
                  onUpdateStatus={handleUpdateLicensingStatus}
                  isLoading={isLoading}
                />
              </div>

              <div className="space-y-6">
                <LiveUpdates
                  isConnected={isConnected}
                  notifications={notifications}
                  onClear={clearNotifications}
                />
                <QuickActions
                  onAddMovie={() => setActiveModal("movie")}
                  onAddSong={() => setActiveModal("song")}
                  onAddScene={() => setActiveModal("scene")}
                />
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <>
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {activeTab === "movies" && "Movies & Scenes"}
            {activeTab === "songs" && "Songs Library"}
            {activeTab === "tracks" && "All Tracks"}
            {activeTab === "dashboard" && "Music Licensing Dashboard"}
          </h1>
          <p className="text-gray-500 mt-1">
            {activeTab === "movies" &&
              "View movies with their scenes and associated tracks"}
            {activeTab === "songs" && "Manage your songs library"}
            {activeTab === "tracks" &&
              "Filter and view all tracks by movie or scene"}
            {activeTab === "dashboard" &&
              "Manage tracks and licensing for your movie scenes"}
          </p>
        </div>

        {renderContent()}
      </main>

      {/* Modals */}
      {/* TODO: Optimize this */}
      <Modal
        isOpen={activeModal === "track"}
        onClose={() => setActiveModal(null)}
        title="Add New Track"
      >
        <CreateTrackForm
          songs={songs}
          scenes={scenes}
          onSubmit={handleCreateTrack}
          onCancel={() => setActiveModal(null)}
          isLoading={isSubmitting}
        />
      </Modal>

      <Modal
        isOpen={activeModal === "song"}
        onClose={() => setActiveModal(null)}
        title="Add New Song"
      >
        <CreateSongForm
          onSubmit={handleCreateSong}
          onCancel={() => setActiveModal(null)}
          isLoading={isSubmitting}
        />
      </Modal>

      <Modal
        isOpen={activeModal === "movie"}
        onClose={() => setActiveModal(null)}
        title="Add New Movie"
      >
        <CreateMovieForm
          onSubmit={handleCreateMovie}
          onCancel={() => setActiveModal(null)}
          isLoading={isSubmitting}
        />
      </Modal>

      <Modal
        isOpen={activeModal === "scene"}
        onClose={() => setActiveModal(null)}
        title="Add Movie Scene"
      >
        <CreateSceneForm
          movies={movies}
          onSubmit={handleCreateScene}
          onCancel={() => setActiveModal(null)}
          isLoading={isSubmitting}
        />
      </Modal>
    </>
  );
}
