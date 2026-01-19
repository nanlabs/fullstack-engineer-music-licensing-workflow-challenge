import { Test, TestingModule } from '@nestjs/testing';
import { SongController } from './song.controller';
import { SongService } from './song.service';

describe('SongController', () => {
  let songController: SongController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [SongController],
      providers: [SongService],
    }).compile();

    songController = app.get<SongController>(SongController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(songController.getHello()).toBe('Hello World!');
    });
  });
});
