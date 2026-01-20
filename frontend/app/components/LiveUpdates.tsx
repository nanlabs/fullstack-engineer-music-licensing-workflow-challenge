"use client";

import { Notification } from "../types";

interface LiveUpdatesProps {
  isConnected: boolean;
  notifications: Notification[];
  onClear: () => void;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export function LiveUpdates({
  isConnected,
  notifications,
  onClear,
}: LiveUpdatesProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`}
          />
          <h2 className="font-semibold text-gray-900">Live Updates</h2>
        </div>
        {notifications.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>
      <div className="p-5 space-y-3 max-h-64 overflow-y-auto">
        {!isConnected ? (
          <div className="text-sm text-gray-500 text-center py-4">
            Connecting to server...
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            No updates yet. Changes will appear here in real-time.
          </div>
        ) : (
          notifications.map((notification) => (
            <div key={notification.id} className="text-sm">
              <p className="text-gray-900">{notification.message}</p>
              <p className="text-gray-500 text-xs">{notification.details}</p>
              <p className="text-gray-400 text-xs mt-1">
                {formatTimeAgo(notification.timestamp)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
