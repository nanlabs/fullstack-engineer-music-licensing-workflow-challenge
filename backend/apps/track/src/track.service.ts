import { Injectable } from '@nestjs/common';

@Injectable()
export class TrackService {
  getHello(): string {
    return 'Hello World!';
  }
}
