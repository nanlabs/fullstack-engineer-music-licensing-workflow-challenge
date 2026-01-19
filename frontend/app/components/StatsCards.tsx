'use client';

import { Track, LicensingStatus } from '../types';

interface StatsCardsProps {
  tracks: Track[];
}

export function StatsCards({ tracks }: StatsCardsProps) {
  const stats = {
    total: tracks.length,
    licensed: tracks.filter((t) => t.licensing?.status === LicensingStatus.LICENSED).length,
    inNegotiation: tracks.filter((t) => t.licensing?.status === LicensingStatus.IN_NEGOTIATION).length,
    unlicensed: tracks.filter((t) => t.licensing?.status === LicensingStatus.UNLICENSED).length,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <p className="text-sm text-gray-500">Total Tracks</p>
        <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.total}</p>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <p className="text-sm text-gray-500">Licensed</p>
        <p className="text-2xl font-semibold text-green-600 mt-1">{stats.licensed}</p>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <p className="text-sm text-gray-500">In Negotiation</p>
        <p className="text-2xl font-semibold text-yellow-600 mt-1">{stats.inNegotiation}</p>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <p className="text-sm text-gray-500">Unlicensed</p>
        <p className="text-2xl font-semibold text-red-600 mt-1">{stats.unlicensed}</p>
      </div>
    </div>
  );
}
