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
  private isReady = false;

  afterInit(server: Server) {
    this.server = server;

    // Small delay to ensure complete initialization
    setTimeout(() => {
      this.isReady = true;
      this.logger.log('WebSocket Gateway fully initialized and ready');
    }, 100);
  }

  handleConnection(client: Socket) {
    this.logger.log(
      `Client connected: ${client.id}. Total clients: ${this.server?.engine?.clientsCount || 0}`,
    );
  }

  handleDisconnect(client: Socket) {
    this.logger.log(
      `Client disconnected: ${client.id}. Total clients: ${this.server?.engine?.clientsCount || 0}`,
    );
  }

  async emitLicenseStatusUpdate(data: { songId: number; newStatus: any; updatedBy?: string }) {
    try {
      // If not ready, wait a bit
      if (!this.isReady || !this.server) {
        this.logger.warn('WebSocket server not ready yet, waiting...');
        await this.waitForReady();
      }

      if (!this.server) {
        this.logger.error('WebSocket server still not available after waiting');
        return;
      }

      const clientCount = this.server.engine.clientsCount || 0;
      this.server.emit('licenseStatusUpdate', data);

      this.logger.log(
        `Emitted license status update for song ${data.songId} to ${clientCount} clients`,
      );

      if (clientCount === 0) {
        this.logger.warn('No clients connected to receive the update');
      }
    } catch (error) {
      this.logger.error('Error emitting license status update:', error);
    }
  }

  private async waitForReady(maxWait = 5000): Promise<void> {
    const startTime = Date.now();

    while (!this.isReady && Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!this.isReady) {
      throw new Error('WebSocket server failed to initialize within timeout');
    }
  }

  // Rest of your methods...
  emitTrackCreated(data: { track: any; sceneId: string; movieId: string }) {
    if (!this.isReady || !this.server) {
      this.logger.warn('WebSocket server not ready, skipping track creation emission');
      return;
    }
    this.server.emit('trackCreated', data);
    this.logger.log(`Emitted track created for scene ${data.sceneId}`);
  }

  joinMovieRoom(client: Socket, movieId: string) {
    client.join(`movie-${movieId}`);
    this.logger.log(`Client ${client.id} joined movie room: ${movieId}`);
  }

  leaveMovieRoom(client: Socket, movieId: string) {
    client.leave(`movie-${movieId}`);
    this.logger.log(`Client ${client.id} left movie room: ${movieId}`);
  }

  emitToMovieRoom(movieId: string, event: string, data: any) {
    if (!this.isReady || !this.server) {
      this.logger.warn('WebSocket server not ready, skipping room emission');
      return;
    }
    this.server.to(`movie-${movieId}`).emit(event, data);
    this.logger.log(`Emitted ${event} to movie room: ${movieId}`);
  }
}
