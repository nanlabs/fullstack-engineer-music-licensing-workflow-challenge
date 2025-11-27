import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class LicensingGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject('REDIS_SUBSCRIBER') private readonly redisSubscriber: Redis,
  ) {}

  async afterInit() {
    await this.redisSubscriber.subscribe('track_updates');
    
    this.redisSubscriber.on('message', (channel, message) => {
      if (channel === 'track_updates') {
        const { trackId, status } = JSON.parse(message);
        this.notifyTrackUpdate(trackId, status);
      }
    });
  }

  notifyTrackUpdate(trackId: string, status: string) {
    this.server.emit('trackUpdated', { trackId, status });
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(@MessageBody() room: string) {
    // Logic for joining rooms if needed
  }
}
