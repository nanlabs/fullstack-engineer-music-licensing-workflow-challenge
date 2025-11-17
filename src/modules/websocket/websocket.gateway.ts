import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway()
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitLicenseStatusUpdate(
    licenseId: number,
    statusId: number,
    statusName: string,
    trackId?: number,
  ) {
    const update = {
      licenseId,
      statusId,
      statusName,
      trackId,
      timestamp: new Date(),
    };

    this.logger.log(
      `Emitting license status update: License ${licenseId} -> ${statusName}`,
    );
    this.server.emit('licenseStatusUpdate', update);
  }
}
