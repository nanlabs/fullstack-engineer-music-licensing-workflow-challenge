import { NestMiddleware, Injectable, Logger } from '@nestjs/common'
import { FastifyRequest, FastifyReply } from 'fastify'

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP')

  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    res.raw.on('finish', () => {
      this.logger.log(`${req.method} ${req.url} ${res.raw.statusCode}`)
    })
    next()
  }
}
