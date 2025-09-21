import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class LicenseUpdateGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('LicenseUpdateGateway');

  afterInit(_server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Emit license status update to all connected clients
  emitLicenseStatusUpdate(data: { songId: number; newStatus: any; updatedBy?: string }) {
    try {
      if (!this.server) {
        this.logger.warn('WebSocket server not initialized, skipping emission');
        return;
      }
      this.server.emit('licenseStatusUpdate', data);
      this.logger.log(`Emitted license status update for song ${data.songId}`);
    } catch (error) {
      this.logger.error('Error emitting license status update:', error);
    }
  }

  // Emit track creation to all connected clients
  emitTrackCreated(data: { track: any; sceneId: string; movieId: string }) {
    if (!this.server) {
      this.logger.warn('WebSocket server not initialized, skipping emission');
      return;
    }
    this.server.emit('trackCreated', data);
    this.logger.log(`Emitted track created for scene ${data.sceneId}`);
  }

  // Emit movie statistics update
  emitMovieStatisticsUpdate(data: { movieId: string; statistics: any }) {
    if (!this.server) {
      this.logger.warn('WebSocket server not initialized, skipping emission');
      return;
    }
    this.server.emit('movieStatisticsUpdate', data);
    this.logger.log(`Emitted statistics update for movie ${data.movieId}`);
  }

  // Join a specific movie room for targeted updates
  joinMovieRoom(client: Socket, movieId: string) {
    client.join(`movie-${movieId}`);
    this.logger.log(`Client ${client.id} joined movie room: ${movieId}`);
  }

  // Leave a specific movie room
  leaveMovieRoom(client: Socket, movieId: string) {
    client.leave(`movie-${movieId}`);
    this.logger.log(`Client ${client.id} left movie room: ${movieId}`);
  }

  // Emit to specific movie room
  emitToMovieRoom(movieId: string, event: string, data: any) {
    if (!this.server) {
      this.logger.warn('WebSocket server not initialized, skipping emission');
      return;
    }
    this.server.to(`movie-${movieId}`).emit(event, data);
    this.logger.log(`Emitted ${event} to movie room: ${movieId}`);
  }
}
