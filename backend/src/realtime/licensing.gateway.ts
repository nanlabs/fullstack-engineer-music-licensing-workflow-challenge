import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'licensing' })
export class LicensingGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('joinScene')
  handleJoinScene(
    @MessageBody() sceneId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(sceneId);
    return { event: 'joined', sceneId };
  }

  notifyTrackStatusUpdated(sceneId: string, payload: any) {
    this.server.to(sceneId).emit('trackStatusUpdated', payload);
  }
}
