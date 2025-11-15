// src/realtime/redis-io.adapter.ts
import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Logger } from '@nestjs/common';
import { envs } from 'config/envs';
import type { Server, ServerOptions } from 'socket.io';

const logger = new Logger('RedisIoAdapter');

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis() {
    const url = `redis://${envs.redisHost}:${envs.redisPort}`;

    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();

    await pubClient.connect();
    await subClient.connect();

    this.adapterConstructor = createAdapter(pubClient, subClient);
    logger.log(`RedisIoAdapter connected to ${url}`);
  }

  createIOServer(port: number, options: Partial<ServerOptions> = {}): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        ...(options.cors ?? {}),
      },
    }) as Server;

    if (!this.adapterConstructor) {
      throw new Error(
        'Redis adapter not initialized, call connectToRedis() first',
      );
    }

    server.adapter(this.adapterConstructor);
    return server;
  }
}
