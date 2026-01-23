import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { env } from '../config/env';

export const useTracksSocket = (onStatusUpdate: (data: any) => void) => {
  useEffect(() => {
    const socket: Socket = io(env.socketUrl, {
      transports: ['websocket'],
    })

    socket.on('statusUpdated', (data) => {
      onStatusUpdate(data)
    })

    socket.on('connect', () => console.log('Connected to tracks socket'))

    return () => {
      socket.disconnect()
    }
  }, [onStatusUpdate])
};