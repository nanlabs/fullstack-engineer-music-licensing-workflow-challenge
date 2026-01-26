import { Test, TestingModule } from '@nestjs/testing';
import { ScenesController } from '../../src/scenes/scenes.controller';
import { ScenesService } from '../../src/scenes/scenes.service';
import { CreateSceneDto } from '../../src/scenes/dto/create-scene.dto';

describe('ScenesController', () => {
  let controller: ScenesController;
  let service: ScenesService;

  const mockScene = {
    id: '1',
    movieId: 'movie-1',
    title: 'Test Scene',
    description: 'Test Description',
    sceneNumber: 1,
    startTime: 0,
    endTime: 180,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockScenesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByMovie: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScenesController],
      providers: [
        {
          provide: ScenesService,
          useValue: mockScenesService,
        },
      ],
    }).compile();

    controller = module.get<ScenesController>(ScenesController);
    service = module.get<ScenesService>(ScenesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a scene', async () => {
      const createDto: CreateSceneDto = {
        movieId: 'movie-1',
        title: 'Test Scene',
        description: 'Test Description',
        sceneNumber: 1,
        startTime: 0,
        endTime: 180,
      };

      mockScenesService.create.mockResolvedValue(mockScene);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockScene);
    });
  });

  describe('findAll', () => {
    it('should return all scenes when no movieId query param', async () => {
      const paginatedResult = {
        data: [mockScene],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      mockScenesService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(undefined, '1', '10');

      expect(service.findAll).toHaveBeenCalledWith(1, 10);
      expect(service.findByMovie).not.toHaveBeenCalled();
      expect(result).toEqual(paginatedResult);
    });

    it('should return all scenes with default pagination when page/limit not provided', async () => {
      const paginatedResult = {
        data: [mockScene],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      mockScenesService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(undefined, undefined, undefined);

      expect(service.findAll).toHaveBeenCalledWith(undefined, undefined);
      expect(service.findByMovie).not.toHaveBeenCalled();
      expect(result).toEqual(paginatedResult);
    });

    it('should return scenes by movie when movieId query param provided', async () => {
      mockScenesService.findByMovie.mockResolvedValue([mockScene]);

      const result = await controller.findAll('movie-1', undefined, undefined);

      expect(service.findByMovie).toHaveBeenCalledWith('movie-1');
      expect(service.findAll).not.toHaveBeenCalled();
      expect(result).toEqual([mockScene]);
    });
  });

  describe('findOne', () => {
    it('should return a scene by id', async () => {
      mockScenesService.findOne.mockResolvedValue(mockScene);

      const result = await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockScene);
    });
  });

  describe('update', () => {
    it('should update a scene', async () => {
      const updateDto = { title: 'Updated Title' };
      const updatedScene = { ...mockScene, ...updateDto };

      mockScenesService.update.mockResolvedValue(updatedScene);

      const result = await controller.update('1', updateDto);

      expect(service.update).toHaveBeenCalledWith('1', updateDto);
      expect(result).toEqual(updatedScene);
    });
  });

  describe('remove', () => {
    it('should delete a scene', async () => {
      mockScenesService.remove.mockResolvedValue(undefined);

      await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith('1');
    });
  });
});
