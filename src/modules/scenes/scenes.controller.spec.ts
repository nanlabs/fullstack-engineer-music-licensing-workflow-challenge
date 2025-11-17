/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ScenesController } from './scenes.controller';
import { ScenesService } from './scenes.service';
import { CreateSceneDto } from './dto/create-scene.dto';
import { UpdateSceneDto } from './dto/update-scene.dto';
import { FindAllSceneDto } from './dto/findAll-scene.dto';

describe('ScenesController', () => {
  let controller: ScenesController;
  let service: ScenesService;

  const mockScenesService = {
    create: jest.fn(),
    findAllByMovie: jest.fn(),
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
    it('should create a new scene', async () => {
      const createSceneDto: CreateSceneDto = {
        movie_id: 1,
        title: 'Test Scene',
        description: 'Test Description',
      };

      const mockScene = {
        id: 1,
        ...createSceneDto,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockScenesService.create.mockResolvedValue(mockScene);

      const result = await controller.create(createSceneDto);

      expect(service.create).toHaveBeenCalledWith(createSceneDto);
      expect(result).toEqual(mockScene);
    });
  });

  describe('findAllByMovie', () => {
    it('should return paginated scenes for a movie', async () => {
      const movie_id = 1;
      const findAllSceneDto: FindAllSceneDto = {
        page: 1,
        limit: 10,
      };

      const mockResponse = {
        data: [
          {
            id: 1,
            movie_id: 1,
            title: 'Scene 1',
            description: 'Description 1',
            is_deleted: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      mockScenesService.findAllByMovie.mockResolvedValue(mockResponse);

      const result = await controller.findAllByMovie(movie_id, findAllSceneDto);

      expect(service.findAllByMovie).toHaveBeenCalledWith(
        movie_id,
        findAllSceneDto,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle pagination', async () => {
      const movie_id = 1;
      const findAllSceneDto: FindAllSceneDto = {
        page: 2,
        limit: 5,
      };

      const mockResponse = {
        data: [],
        pagination: {
          total: 0,
          page: 2,
          limit: 5,
          totalPages: 0,
        },
      };

      mockScenesService.findAllByMovie.mockResolvedValue(mockResponse);

      const result = await controller.findAllByMovie(movie_id, findAllSceneDto);

      expect(service.findAllByMovie).toHaveBeenCalledWith(
        movie_id,
        findAllSceneDto,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should use ParseIntPipe to convert movie_id', async () => {
      const movie_id = 123;
      const findAllSceneDto: FindAllSceneDto = {};

      const mockResponse = {
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      };

      mockScenesService.findAllByMovie.mockResolvedValue(mockResponse);

      const result = await controller.findAllByMovie(movie_id, findAllSceneDto);

      expect(service.findAllByMovie).toHaveBeenCalledWith(
        movie_id,
        findAllSceneDto,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('findOne', () => {
    it('should return a scene by id', async () => {
      const mockScene = {
        id: 1,
        movie_id: 1,
        title: 'Test Scene',
        description: 'Test Description',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockScenesService.findOne.mockResolvedValue(mockScene);

      const result = await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockScene);
    });

    it('should convert string id to number', async () => {
      const mockScene = {
        id: 123,
        movie_id: 1,
        title: 'Test Scene',
        description: 'Test Description',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockScenesService.findOne.mockResolvedValue(mockScene);

      const result = await controller.findOne('123');

      expect(service.findOne).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockScene);
    });
  });

  describe('update', () => {
    it('should update a scene', async () => {
      const updateSceneDto: UpdateSceneDto = {
        title: 'Updated Title',
      };

      const updatedScene = {
        id: 1,
        movie_id: 1,
        title: 'Updated Title',
        description: 'Test Description',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockScenesService.update.mockResolvedValue(updatedScene);

      const result = await controller.update('1', updateSceneDto);

      expect(service.update).toHaveBeenCalledWith(1, updateSceneDto);
      expect(result).toEqual(updatedScene);
    });

    it('should convert string id to number', async () => {
      const updateSceneDto: UpdateSceneDto = {
        description: 'New Description',
      };

      const updatedScene = {
        id: 456,
        movie_id: 1,
        title: 'Test Scene',
        description: 'New Description',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockScenesService.update.mockResolvedValue(updatedScene);

      const result = await controller.update('456', updateSceneDto);

      expect(service.update).toHaveBeenCalledWith(456, updateSceneDto);
      expect(result).toEqual(updatedScene);
    });

    it('should update multiple fields', async () => {
      const updateSceneDto: UpdateSceneDto = {
        title: 'New Title',
        description: 'New Description',
      };

      const updatedScene = {
        id: 1,
        movie_id: 1,
        title: 'New Title',
        description: 'New Description',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockScenesService.update.mockResolvedValue(updatedScene);

      const result = await controller.update('1', updateSceneDto);

      expect(service.update).toHaveBeenCalledWith(1, updateSceneDto);
      expect(result).toEqual(updatedScene);
    });
  });

  describe('remove', () => {
    it('should remove a scene', async () => {
      const deletedScene = {
        id: 1,
        movie_id: 1,
        title: 'Test Scene',
        description: 'Test Description',
        is_deleted: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockScenesService.remove.mockResolvedValue(deletedScene);

      const result = await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual(deletedScene);
    });

    it('should convert string id to number', async () => {
      const deletedScene = {
        id: 789,
        movie_id: 1,
        title: 'Test Scene',
        description: 'Test Description',
        is_deleted: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockScenesService.remove.mockResolvedValue(deletedScene);

      const result = await controller.remove('789');

      expect(service.remove).toHaveBeenCalledWith(789);
      expect(result).toEqual(deletedScene);
    });
  });
});
