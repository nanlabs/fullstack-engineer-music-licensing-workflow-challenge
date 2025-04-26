import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { LicenseStatus } from '../entities/license-status.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class LicenseStatusGateway {
  @WebSocketServer()
  server: Server;

  notifyStatusUpdate(licenseStatus: LicenseStatus) {
    this.server.emit('licenseStatusUpdated', licenseStatus);
  }
}
