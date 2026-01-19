'use client';

interface QuickActionsProps {
  onAddMovie: () => void;
  onAddSong: () => void;
  onAddScene: () => void;
}

export function QuickActions({ onAddMovie, onAddSong, onAddScene }: QuickActionsProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="space-y-2">
        <button
          onClick={onAddMovie}
          className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm transition-colors"
        >
          Add New Movie
        </button>
        <button
          onClick={onAddScene}
          className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm transition-colors"
        >
          Add Movie Scene
        </button>
        <button
          onClick={onAddSong}
          className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm transition-colors"
        >
          Add New Song
        </button>
      </div>
    </div>
  );
}
