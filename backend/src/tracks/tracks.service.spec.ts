import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TracksService } from './tracks.service';
import { Track } from './entities/track.entity';
import { Scene } from '../scenes/entities/scene.entity';
import { Song } from '../songs/entities/song.entity';
import { ObjectLiteral, Repository } from 'typeorm';
import { LicensingStatus } from './enums/licensing-status.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LicensingGateway } from '../realtime/licensing.gateway';
import { TrackIdDto } from './dto/track-id.dto';
import { UpdateTrackStatusDto } from './dto/update-tracks.dto';

type MockRepo<T extends ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createRepoMock = <T extends ObjectLiteral>(): MockRepo<T> => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  clear: jest.fn(),
});

const createGatewayMock = () => ({
  notifyTrackStatusUpdated: jest.fn(),
});

const buildTrackIdDto = (trackId: string): TrackIdDto => ({ trackId });

const buildUpdateStatusDto = (
  status: LicensingStatus,
): UpdateTrackStatusDto => ({
  status,
});

describe('TracksService', () => {
  let service: TracksService;
  let trackRepo: MockRepo<Track>;
  let gateway: ReturnType<typeof createGatewayMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TracksService,
        { provide: getRepositoryToken(Track), useValue: createRepoMock() },
        { provide: getRepositoryToken(Scene), useValue: createRepoMock() },
        { provide: getRepositoryToken(Song), useValue: createRepoMock() },
        { provide: LicensingGateway, useValue: createGatewayMock() },
      ],
    }).compile();

    service = module.get<TracksService>(TracksService);
    trackRepo = module.get(getRepositoryToken(Track));
    gateway = module.get(LicensingGateway);
  });

  it('should throw NotFoundException if track does not exist on updateStatus', async () => {
    trackRepo.findOne!.mockResolvedValue(null);

    await expect(
      service.updateStatus(
        buildTrackIdDto('non-existing-id'),
        buildUpdateStatusDto(LicensingStatus.APPROVED),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should allow valid status transition and emit websocket event', async () => {
    const track = {
      id: 'track-id',
      licensingStatus: LicensingStatus.PENDING,
      scene: { id: 'scene-id' },
      song: {},
    } as Track;

    trackRepo.findOne!.mockResolvedValue(track);
    trackRepo.save!.mockImplementation((t: Track) => Promise.resolve(t));

    const result = await service.updateStatus(
      buildTrackIdDto('track-id'),
      buildUpdateStatusDto(LicensingStatus.APPROVED),
    );

    expect(result.licensingStatus).toBe(LicensingStatus.APPROVED);
    expect(trackRepo.save).toHaveBeenCalled();
    expect(gateway.notifyTrackStatusUpdated).toHaveBeenCalledWith('scene-id', {
      trackId: 'track-id',
      sceneId: 'scene-id',
      newStatus: LicensingStatus.APPROVED,
    });
  });

  it('should reject invalid status transition', async () => {
    const track = {
      id: 'track-id',
      licensingStatus: LicensingStatus.APPROVED,
      scene: { id: 'scene-id' },
      song: {},
    } as Track;

    trackRepo.findOne!.mockResolvedValue(track);

    await expect(
      service.updateStatus(
        buildTrackIdDto('track-id'),
        buildUpdateStatusDto(LicensingStatus.PENDING),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
