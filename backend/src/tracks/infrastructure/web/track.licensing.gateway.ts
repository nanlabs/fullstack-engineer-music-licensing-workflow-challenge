import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' }, // Remove or adjust in production
  namespace: 'licensing',
})
export class TrackLicensingGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  handleConnection(client: any) {
    console.log(`Client connected: ${client.id}`)
  }

  sendUpdate(trackId: string, status: string) {
    this.server.emit('statusUpdated', { trackId, status })
  }
}