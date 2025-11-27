import { Test, TestingModule } from '@nestjs/testing';
import { ScenesService } from './scenes.service';
import { ScenesRepository } from './scenes.repository';

describe('ScenesService', () => {
  let service: ScenesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScenesService,
        {
          provide: ScenesRepository,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ScenesService>(ScenesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
