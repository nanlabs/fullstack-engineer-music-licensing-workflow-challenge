import { Controller, forwardRef, Inject, HttpStatus } from '@nestjs/common';
import { TrackService } from './track.service';
import {
  ClientRMQ,
  ClientTCP,
  MessagePattern,
  Payload,
  RpcException,
} from '@nestjs/microservices';
import { TypeOrmRepositoryService } from 'libs/database/postgres/repository/service/typeorm-repository.service';
import {
  TrackEntity,
  LicensingEntity,
  LicensingStatus,
  SongEntity,
} from 'libs/shared';
import type { LicensingStatusUpdate, TrackCreatedEvent } from 'libs/shared';
import type { CreateTrackDto } from 'libs/shared/dto/create-track.dto';
import { lastValueFrom, timeout, catchError } from 'rxjs';

@Controller()
export class TrackController {
  constructor(
    @Inject(forwardRef(() => 'TRACK_SERVICE'))
    private readonly trackServiceClient: ClientRMQ,
    @Inject(forwardRef(() => 'SONG_SERVICE'))
    private readonly songServiceClient: ClientRMQ,
    @Inject(forwardRef(() => 'MOVIE_SERVICE'))
    private readonly movieServiceClient: ClientRMQ,
    @Inject('API_GATEWAY_MICROSERVICE_CLIENT')
    private readonly apiGatewayMicroserviceClient: ClientTCP,
    private typeOrmRepositoryService: TypeOrmRepositoryService,
  ) {}

  @MessagePattern('track.fetch.all')
  async fetchAllTracks() {
    return this.typeOrmRepositoryService.trackRepository.findAll([
      'song',
      'movieScene',
      'licensing',
    ]);
  }

  @MessagePattern('track.fetch.byId')
  async fetchTrackById(@Payload() payload: { id: number }) {
    return this.typeOrmRepositoryService.trackRepository.findById(payload.id, [
      'song',
      'movieScene',
      'licensing',
    ]);
  }

  @MessagePattern('track.create.one')
  async createOne(@Payload() createTrackPayload: CreateTrackDto) {
    // Validate startTime < endTime
    if (createTrackPayload.startTime >= createTrackPayload.endTime) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'startTime must be less than endTime',
      });
    }

    // Validate that the song exists by calling the song microservice
    const song = await lastValueFrom(
      this.songServiceClient
        .send<SongEntity>('song.fetch.byId', { id: createTrackPayload.songId })
        .pipe(
          timeout(5000),
          catchError((err) => {
            throw new RpcException({
              statusCode: HttpStatus.SERVICE_UNAVAILABLE,
              message: 'Song service unavailable',
            });
          }),
        ),
    );

    if (!song) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Song with id ${createTrackPayload.songId} not found`,
      });
    }

    const { startTime: trackStartTime, endTime: trackEndTime } =
      createTrackPayload;
    const { seconds: songSeconds } = song;

    const isTrackTimeInvalid =
      trackStartTime > songSeconds || trackEndTime > songSeconds;

    if (isTrackTimeInvalid) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Track timing (${trackStartTime}s - ${trackEndTime}s) exceeds song duration (${songSeconds}s)`,
      });
    }

    // Validate that the movie scene exists by calling the movie microservice
    const movieScene = await lastValueFrom(
      this.movieServiceClient
        .send('movie-scene.fetch.byId', {
          id: createTrackPayload.movieSceneId,
        })
        .pipe(
          timeout(5000),
          catchError((err) => {
            throw new RpcException({
              statusCode: HttpStatus.SERVICE_UNAVAILABLE,
              message: 'Movie service unavailable',
            });
          }),
        ),
    );

    if (!movieScene) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Movie scene with id ${createTrackPayload.movieSceneId} not found`,
      });
    }

    // Create a new licensing record with default UNLICENSED status
    const newLicensing = new LicensingEntity();
    newLicensing.status = LicensingStatus.UNLICENSED;
    const savedLicensing =
      await this.typeOrmRepositoryService.licensingRepository.createOne(
        newLicensing,
      );

    // Create the track with the validated references
    const newTrack = new TrackEntity();
    newTrack.startTime = trackStartTime;
    newTrack.endTime = trackEndTime;
    newTrack.song = song;
    newTrack.movieScene = movieScene;
    newTrack.licensing = savedLicensing;

    const savedTrack =
      await this.typeOrmRepositoryService.trackRepository.createOne(newTrack);

    // Emit track.created event for real-time notifications
    const trackCreatedEvent: TrackCreatedEvent = {
      trackId: savedTrack.id,
      songId: song.id,
      movieSceneId: movieScene.id,
      licensingStatus: savedLicensing.status,
      createdAt: new Date(),
    };
    this.apiGatewayMicroserviceClient.emit('track.created', trackCreatedEvent);

    return savedTrack;
  }

  @MessagePattern('track.update.licensing')
  async updateLicensingStatus(
    @Payload() payload: { trackId: number; status: LicensingStatus },
  ) {
    const track = await this.typeOrmRepositoryService.trackRepository.findById(
      payload.trackId,
      ['licensing'],
    );

    if (!track) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Track with id ${payload.trackId} not found`,
      });
    }

    if (!track.licensing?.id) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Licensing record for track ${payload.trackId} not found`,
      });
    }

    const previousStatus = track.licensing.status;

    // Update the licensing status
    const updatedLicensing =
      await this.typeOrmRepositoryService.licensingRepository.updateOne(
        track.licensing.id,
        { status: payload.status } as Partial<LicensingEntity>,
      );

    // Emit licensing.status.updated event for real-time notifications
    const licensingStatusUpdate: LicensingStatusUpdate = {
      trackId: payload.trackId,
      previousStatus: previousStatus,
      newStatus: payload.status,
      updatedAt: new Date(),
    };
    this.apiGatewayMicroserviceClient.emit(
      'licensing.status.updated',
      licensingStatusUpdate,
    );

    return updatedLicensing;
  }
}
