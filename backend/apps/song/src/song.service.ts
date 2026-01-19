import { Injectable } from '@nestjs/common';

@Injectable()
export class SongService {
  getHello(): string {
    return 'Hello World!';
  }
}
