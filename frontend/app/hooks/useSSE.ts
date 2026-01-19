'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { LicensingStatusUpdate, TrackCreatedEvent, Notification } from '../types';

const SSE_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type SSEChannel = 'licensing-status' | 'track-created';

interface UseSSEOptions {
  onLicensingStatusUpdate?: (data: LicensingStatusUpdate) => void;
  onTrackCreated?: (data: TrackCreatedEvent) => void;
}

export function useSSE(options: UseSSEOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const eventSourcesRef = useRef<Map<SSEChannel, EventSource>>(new Map());

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `${notification.type}-${Date.now()}`,
      timestamp: new Date(),
    };
    setNotifications((prev) => [newNotification, ...prev].slice(0, 50)); // Keep last 50 notifications
  }, []);

  const connectToChannel = useCallback((channel: SSEChannel) => {
    if (eventSourcesRef.current.has(channel)) {
      return; // Already connected
    }

    const url = `${SSE_BASE_URL}/sse/notifications/${channel}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log(`SSE connected to ${channel}`);
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (channel === 'licensing-status') {
          const update = data as LicensingStatusUpdate;
          options.onLicensingStatusUpdate?.(update);
          addNotification({
            type: 'licensing-status',
            message: `Track #${update.trackId} status changed`,
            details: `${update.previousStatus} → ${update.newStatus}`,
          });
        } else if (channel === 'track-created') {
          const created = data as TrackCreatedEvent;
          options.onTrackCreated?.(created);
          addNotification({
            type: 'track-created',
            message: 'New track created',
            details: `Track #${created.trackId} with status ${created.licensingStatus}`,
          });
        }
      } catch (error) {
        console.error(`Error parsing SSE message from ${channel}:`, error);
      }
    };

    eventSource.onerror = (error) => {
      console.error(`SSE error on ${channel}:`, error);
      setIsConnected(false);
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        eventSourcesRef.current.delete(channel);
        connectToChannel(channel);
      }, 5000);
    };

    eventSourcesRef.current.set(channel, eventSource);
  }, [options, addNotification]);

  const disconnect = useCallback(() => {
    eventSourcesRef.current.forEach((eventSource, channel) => {
      eventSource.close();
      console.log(`SSE disconnected from ${channel}`);
    });
    eventSourcesRef.current.clear();
    setIsConnected(false);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    // Connect to both channels on mount
    connectToChannel('licensing-status');
    connectToChannel('track-created');

    return () => {
      disconnect();
    };
  }, [connectToChannel, disconnect]);

  return {
    isConnected,
    notifications,
    clearNotifications,
    disconnect,
  };
}
