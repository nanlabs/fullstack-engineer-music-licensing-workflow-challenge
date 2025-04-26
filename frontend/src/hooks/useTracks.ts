import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

type Track = {
  id: number;
  startTime: string;
  endTime: string;
  song: {
    title: string;
    artist: string;
  };
  licenseStatus: {
    id: number;
    status: 'PENDING' | 'NEGOTIATION' | 'APPROVED' | 'REJECTED';
  };
};

type LicenseStatus = {
  id: number;
  status: 'PENDING' | 'NEGOTIATION' | 'APPROVED' | 'REJECTED';
  updatedAt: string;
};

export function useTracks(sceneId: string | number | undefined) {
  const socketRef = useRef<Socket | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sceneId) return;

    const fetchTracks = async () => {
      try {
        const res = await axios.get(`http://localhost:3000/track?sceneId=${sceneId}`);
        setTracks(res.data);
      } catch (error) {
        console.error('Error fetching tracks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTracks();

    socketRef.current = io('http://localhost:3000');

    socketRef.current.on('licenseStatusUpdated', (updatedStatus: LicenseStatus) => {
      setTracks((prev) =>
        prev.map((track) =>
          track.licenseStatus.id === updatedStatus.id
            ? { ...track, licenseStatus: updatedStatus }
            : track
        )
      );
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [sceneId]);

  return { tracks, loading, setTracks };
}
