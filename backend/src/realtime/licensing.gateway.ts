// src/realtime/licensing.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

const logger = new Logger('LicensingGateway');

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'licensing',
})
export class LicensingGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('joinScene')
  async handleJoinScene(
    @MessageBody() sceneId: string,
    @ConnectedSocket() client: Socket,
  ) {
    logger.log(
      `Client ${client.id} joined scene room: ${sceneId} (namespace licensing)`,
    );
    await client.join(sceneId);
    return { event: 'joined', sceneId };
  }

  notifyTrackStatusUpdated(sceneId: string, payload: any) {
    logger.log(
      `Emitting trackStatusUpdated to scene ${sceneId} with payload`,
      payload,
    );
    this.server.to(sceneId).emit('trackStatusUpdated', payload);
  }
}
