import { Test, TestingModule } from '@nestjs/testing';
import { TrackService } from './track.service';
import { TypeOrmRepositoryService } from 'libs/database/postgres/repository/service/typeorm-repository.service';
import { ClientRMQ, ClientTCP, RpcException } from '@nestjs/microservices';
import { HttpStatus } from '@nestjs/common';
import { LicensingStatus } from 'libs/shared';
import { CreateTrackDto } from 'libs/shared/dto/create-track.dto';
import { of, throwError } from 'rxjs';

describe('TrackService (Microservice)', () => {
  let service: TrackService;

  const mockSong = {
    id: 1,
    title: 'Bohemian Rhapsody',
    releaseDate: 1975,
    seconds: 354,
  };

  const mockMovie = {
    id: 1,
    title: 'Wayne\'s World',
    releaseDate: 1992,
    encodingFormat: 'Blu-ray',
  };

  const mockMovieScene = {
    id: 1,
    name: 'Car singing scene',
    movie: mockMovie,
  };

  const mockLicensing = {
    id: 1,
    status: LicensingStatus.UNLICENSED,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockTrack = {
    id: 1,
    startTime: 0,
    endTime: 180,
    song: mockSong,
    movieScene: mockMovieScene,
    licensing: mockLicensing,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockTrackRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    createOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  };

  const mockLicensingRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    createOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  };

  const mockTypeOrmRepositoryService = {
    trackRepository: mockTrackRepository,
    licensingRepository: mockLicensingRepository,
  };

  const mockSongServiceClient = {
    send: jest.fn(),
    emit: jest.fn(),
  };

  const mockMovieServiceClient = {
    send: jest.fn(),
    emit: jest.fn(),
  };

  const mockApiGatewayClient = {
    send: jest.fn(),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackService,
        {
          provide: TypeOrmRepositoryService,
          useValue: mockTypeOrmRepositoryService,
        },
        {
          provide: 'SONG_SERVICE',
          useValue: mockSongServiceClient,
        },
        {
          provide: 'MOVIE_SERVICE',
          useValue: mockMovieServiceClient,
        },
        {
          provide: 'API_GATEWAY_MICROSERVICE_CLIENT',
          useValue: mockApiGatewayClient,
        },
      ],
    }).compile();

    service = module.get<TrackService>(TrackService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of tracks with relations', async () => {
      const tracks = [mockTrack, { ...mockTrack, id: 2 }];
      mockTrackRepository.findAll.mockResolvedValue(tracks);

      const result = await service.findAll();

      expect(result).toEqual(tracks);
      expect(result).toHaveLength(2);
      expect(mockTrackRepository.findAll).toHaveBeenCalledWith([
        'song',
        'movieScene',
        'licensing',
      ]);
    });

    it('should return empty array when no tracks exist', async () => {
      mockTrackRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return a track by id with relations', async () => {
      mockTrackRepository.findById.mockResolvedValue(mockTrack);

      const result = await service.findById(1);

      expect(result).toEqual(mockTrack);
      expect(mockTrackRepository.findById).toHaveBeenCalledWith(1, [
        'song',
        'movieScene',
        'licensing',
      ]);
    });

    it('should return null when track not found', async () => {
      mockTrackRepository.findById.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    const createTrackDto: CreateTrackDto = {
      songId: 1,
      movieSceneId: 1,
      startTime: 0,
      endTime: 180,
    };

    beforeEach(() => {
      mockSongServiceClient.send.mockReturnValue(of(mockSong));
      mockMovieServiceClient.send.mockReturnValue(of(mockMovieScene));
      mockLicensingRepository.createOne.mockResolvedValue(mockLicensing);
      mockTrackRepository.createOne.mockResolvedValue(mockTrack);
    });

    it('should create and return a new track', async () => {
      const result = await service.create(createTrackDto);

      expect(result).toEqual(mockTrack);
      expect(mockSongServiceClient.send).toHaveBeenCalledWith('song.fetch.byId', { id: 1 });
      expect(mockMovieServiceClient.send).toHaveBeenCalledWith('movie-scene.fetch.byId', { id: 1 });
      expect(mockLicensingRepository.createOne).toHaveBeenCalled();
      expect(mockTrackRepository.createOne).toHaveBeenCalled();
      expect(mockApiGatewayClient.emit).toHaveBeenCalledWith(
        'track.created',
        expect.objectContaining({
          trackId: mockTrack.id,
          songId: mockSong.id,
          movieSceneId: mockMovieScene.id,
        }),
      );
    });

    it('should throw RpcException when startTime >= endTime', async () => {
      const invalidDto: CreateTrackDto = {
        ...createTrackDto,
        startTime: 180,
        endTime: 90,
      };

      await expect(service.create(invalidDto)).rejects.toThrow(RpcException);

      try {
        await service.create(invalidDto);
      } catch (error) {
        expect(error.getError()).toEqual({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'startTime must be less than endTime',
        });
      }
    });

    it('should throw RpcException when song not found', async () => {
      mockSongServiceClient.send.mockReturnValue(of(null));

      await expect(service.create(createTrackDto)).rejects.toThrow(RpcException);

      try {
        await service.create(createTrackDto);
      } catch (error) {
        expect(error.getError()).toEqual({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Song with id 1 not found',
        });
      }
    });

    it('should throw RpcException when track timing exceeds song duration', async () => {
      const longTrackDto: CreateTrackDto = {
        ...createTrackDto,
        startTime: 0,
        endTime: 500, // exceeds song duration of 354
      };

      await expect(service.create(longTrackDto)).rejects.toThrow(RpcException);

      try {
        await service.create(longTrackDto);
      } catch (error) {
        expect(error.getError().statusCode).toBe(HttpStatus.BAD_REQUEST);
        expect(error.getError().message).toContain('exceeds song duration');
      }
    });

    it('should throw RpcException when movie scene not found', async () => {
      mockMovieServiceClient.send.mockReturnValue(of(null));

      await expect(service.create(createTrackDto)).rejects.toThrow(RpcException);

      try {
        await service.create(createTrackDto);
      } catch (error) {
        expect(error.getError()).toEqual({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Movie scene with id 1 not found',
        });
      }
    });
  });

  describe('updateLicensingStatus', () => {
    it('should update licensing status to LICENSED', async () => {
      const trackWithLicensing = { ...mockTrack };
      mockTrackRepository.findById.mockResolvedValue(trackWithLicensing);
      const updatedLicensing = { ...mockLicensing, status: LicensingStatus.LICENSED };
      mockLicensingRepository.updateOne.mockResolvedValue(updatedLicensing);

      const result = await service.updateLicensingStatus(1, LicensingStatus.LICENSED);

      expect(result.status).toBe(LicensingStatus.LICENSED);
      expect(mockTrackRepository.findById).toHaveBeenCalledWith(1, ['licensing']);
      expect(mockLicensingRepository.updateOne).toHaveBeenCalledWith(
        mockLicensing.id,
        { status: LicensingStatus.LICENSED },
      );
      expect(mockApiGatewayClient.emit).toHaveBeenCalledWith(
        'licensing.status.updated',
        expect.objectContaining({
          trackId: 1,
          newStatus: LicensingStatus.LICENSED,
        }),
      );
    });

    it('should update licensing status to IN_NEGOTIATION', async () => {
      const trackWithLicensing = { ...mockTrack };
      mockTrackRepository.findById.mockResolvedValue(trackWithLicensing);
      const updatedLicensing = { ...mockLicensing, status: LicensingStatus.IN_NEGOTIATION };
      mockLicensingRepository.updateOne.mockResolvedValue(updatedLicensing);

      const result = await service.updateLicensingStatus(1, LicensingStatus.IN_NEGOTIATION);

      expect(result.status).toBe(LicensingStatus.IN_NEGOTIATION);
    });

    it('should throw RpcException when track not found', async () => {
      mockTrackRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateLicensingStatus(999, LicensingStatus.LICENSED),
      ).rejects.toThrow(RpcException);

      try {
        await service.updateLicensingStatus(999, LicensingStatus.LICENSED);
      } catch (error) {
        expect(error.getError()).toEqual({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Track with id 999 not found',
        });
      }
    });

    it('should throw RpcException when licensing record not found', async () => {
      const trackWithoutLicensing = { ...mockTrack, licensing: null };
      mockTrackRepository.findById.mockResolvedValue(trackWithoutLicensing);

      await expect(
        service.updateLicensingStatus(1, LicensingStatus.LICENSED),
      ).rejects.toThrow(RpcException);

      try {
        await service.updateLicensingStatus(1, LicensingStatus.LICENSED);
      } catch (error) {
        expect(error.getError()).toEqual({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Licensing record for track 1 not found',
        });
      }
    });
  });
});
