'use client';

import { Track, LicensingStatus } from '../types';
import { StatusBadge } from './StatusBadge';

interface TrackListProps {
  tracks: Track[];
  onAddTrack: () => void;
  onUpdateStatus: (trackId: number, status: LicensingStatus) => void;
  isLoading?: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function TrackList({ tracks, onAddTrack, onUpdateStatus, isLoading }: TrackListProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="font-semibold text-gray-900">Tracks</h2>
        <button
          onClick={onAddTrack}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Add Track
        </button>
      </div>
      <div className="divide-y divide-gray-100">
        {isLoading ? (
          <div className="px-5 py-8 text-center text-gray-500">Loading tracks...</div>
        ) : tracks.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-500">
            No tracks yet. Add your first track to get started.
          </div>
        ) : (
          tracks.map((track) => (
            <div key={track.id} className="px-5 py-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="font-medium text-gray-900">
                      {track.song?.title || `Track #${track.id}`}
                    </h3>
                    <StatusBadge status={track.licensing?.status || LicensingStatus.UNLICENSED} />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {track.movieScene?.movie?.title || 'Unknown Movie'} - {track.movieScene?.name || 'Unknown Scene'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatTime(track.startTime)} - {formatTime(track.endTime)}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={track.licensing?.status || LicensingStatus.UNLICENSED}
                    onChange={(e) => onUpdateStatus(track.id, e.target.value as LicensingStatus)}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={LicensingStatus.UNLICENSED}>Unlicensed</option>
                    <option value={LicensingStatus.IN_NEGOTIATION}>In Negotiation</option>
                    <option value={LicensingStatus.LICENSED}>Licensed</option>
                  </select>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
