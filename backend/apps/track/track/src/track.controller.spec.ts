import { Test, TestingModule } from '@nestjs/testing';
import { TrackController } from './track.controller';
import { TrackService } from './track.service';

describe('TrackController', () => {
  let trackController: TrackController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [TrackController],
      providers: [TrackService],
    }).compile();

    trackController = app.get<TrackController>(TrackController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(trackController.getHello()).toBe('Hello World!');
    });
  });
});
