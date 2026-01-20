import { ClientProvider, Transport } from '@nestjs/microservices';
import { RmqEnvConfigService } from './rmq-env-config.service';

export function rmqEnvConfigFactory(queueName: string) {
  return (rmqEnvConfigService: RmqEnvConfigService): ClientProvider => ({
    transport: Transport.RMQ,
    options: {
      urls: [`amqp://${rmqEnvConfigService.host}:${rmqEnvConfigService.port}`],
      queue: queueName,
      queueOptions: {
        durable: false,
      },
    },
  });
}
