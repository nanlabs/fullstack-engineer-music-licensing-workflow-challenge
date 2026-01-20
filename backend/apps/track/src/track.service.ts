import {
  forwardRef,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ClientRMQ, ClientTCP, RpcException } from '@nestjs/microservices';
import { TypeOrmRepositoryService } from 'libs/database/postgres/repository/service/typeorm-repository.service';
import {
  TrackEntity,
  LicensingEntity,
  LicensingStatus,
  SongEntity,
  INJECTION_TOKENS,
  SONG_PATTERNS,
  MOVIE_SCENE_PATTERNS,
  EVENT_PATTERNS,
  RELATIONS,
} from 'libs/shared';
import type { LicensingStatusUpdate, TrackCreatedEvent } from 'libs/shared';
import type { CreateTrackDto } from 'libs/shared/dto/create-track.dto';
import { lastValueFrom, timeout, catchError } from 'rxjs';

@Injectable()
export class TrackService {
  private readonly logger = new Logger(TrackService.name);

  constructor(
    @Inject(forwardRef(() => INJECTION_TOKENS.SONG_SERVICE))
    private readonly songServiceClient: ClientRMQ,
    @Inject(forwardRef(() => INJECTION_TOKENS.MOVIE_SERVICE))
    private readonly movieServiceClient: ClientRMQ,
    @Inject(INJECTION_TOKENS.API_GATEWAY_MICROSERVICE_CLIENT)
    private readonly apiGatewayClient: ClientTCP,
    private readonly typeOrmRepositoryService: TypeOrmRepositoryService,
  ) {}

  async findAll() {
    return this.typeOrmRepositoryService.trackRepository.findAll([
      ...RELATIONS.TRACK.ALL,
    ]);
  }

  async findById(id: number) {
    return this.typeOrmRepositoryService.trackRepository.findById(id, [
      ...RELATIONS.TRACK.ALL,
    ]);
  }

  async create(createTrackPayload: CreateTrackDto) {
    // Validate startTime < endTime
    if (createTrackPayload.startTime >= createTrackPayload.endTime) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'startTime must be less than endTime',
      });
    }

    // Validate that the song exists
    const song = await this.fetchSong(createTrackPayload.songId);

    if (!song) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Song with id ${createTrackPayload.songId} not found`,
      });
    }

    // Validate track timing against song duration
    const { startTime: trackStartTime, endTime: trackEndTime } = createTrackPayload;
    const { seconds: songSeconds } = song;

    if (trackStartTime > songSeconds || trackEndTime > songSeconds) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Track timing (${trackStartTime}s - ${trackEndTime}s) exceeds song duration (${songSeconds}s)`,
      });
    }

    // Validate that the movie scene exists
    const movieScene = await this.fetchMovieScene(createTrackPayload.movieSceneId);

    if (!movieScene) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Movie scene with id ${createTrackPayload.movieSceneId} not found`,
      });
    }

    // Create licensing record with default UNLICENSED status
    const savedLicensing = await this.createLicensingRecord();

    // Create the track
    const newTrack = new TrackEntity();
    newTrack.startTime = trackStartTime;
    newTrack.endTime = trackEndTime;
    newTrack.song = song;
    newTrack.movieScene = movieScene;
    newTrack.licensing = savedLicensing;

    const savedTrack =
      await this.typeOrmRepositoryService.trackRepository.createOne(newTrack);

    // Emit track.created event
    this.emitTrackCreatedEvent(savedTrack, song, movieScene, savedLicensing);

    return savedTrack;
  }

  async updateLicensingStatus(trackId: number, status: LicensingStatus) {
    const track = await this.typeOrmRepositoryService.trackRepository.findById(
      trackId,
      [RELATIONS.TRACK.LICENSING],
    );

    if (!track) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Track with id ${trackId} not found`,
      });
    }

    if (!track.licensing?.id) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Licensing record for track ${trackId} not found`,
      });
    }

    const previousStatus = track.licensing.status;

    const updatedLicensing =
      await this.typeOrmRepositoryService.licensingRepository.updateOne(
        track.licensing.id,
        { status } as Partial<LicensingEntity>,
      );

    // Emit licensing.status.updated event
    this.emitLicensingStatusUpdatedEvent(trackId, previousStatus, status);

    return updatedLicensing;
  }

  private async fetchSong(songId: number): Promise<SongEntity | null> {
    return lastValueFrom(
      this.songServiceClient
        .send<SongEntity>(SONG_PATTERNS.FETCH_BY_ID, { id: songId })
        .pipe(
          timeout(5000),
          catchError(() => {
            throw new RpcException({
              statusCode: HttpStatus.SERVICE_UNAVAILABLE,
              message: 'Song service unavailable',
            });
          }),
        ),
    );
  }

  private async fetchMovieScene(movieSceneId: number) {
    return lastValueFrom(
      this.movieServiceClient
        .send(MOVIE_SCENE_PATTERNS.FETCH_BY_ID, { id: movieSceneId })
        .pipe(
          timeout(5000),
          catchError(() => {
            throw new RpcException({
              statusCode: HttpStatus.SERVICE_UNAVAILABLE,
              message: 'Movie service unavailable',
            });
          }),
        ),
    );
  }

  private async createLicensingRecord(): Promise<LicensingEntity> {
    const newLicensing = new LicensingEntity();
    newLicensing.status = LicensingStatus.UNLICENSED;
    return this.typeOrmRepositoryService.licensingRepository.createOne(newLicensing);
  }

  private emitTrackCreatedEvent(
    savedTrack: TrackEntity,
    song: SongEntity,
    movieScene: any,
    savedLicensing: LicensingEntity,
  ): void {
    const trackCreatedEvent: TrackCreatedEvent = {
      trackId: savedTrack.id,
      songId: song.id,
      movieSceneId: movieScene.id,
      licensingStatus: savedLicensing.status,
      createdAt: new Date(),
    };
    this.logger.log(`Emitting ${EVENT_PATTERNS.TRACK_CREATED} event: ${JSON.stringify(trackCreatedEvent)}`);
    this.apiGatewayClient.emit(EVENT_PATTERNS.TRACK_CREATED, trackCreatedEvent);
  }

  private emitLicensingStatusUpdatedEvent(
    trackId: number,
    previousStatus: string,
    newStatus: LicensingStatus,
  ): void {
    const licensingStatusUpdate: LicensingStatusUpdate = {
      trackId,
      previousStatus,
      newStatus,
      updatedAt: new Date(),
    };
    this.logger.log(`Emitting ${EVENT_PATTERNS.LICENSING_STATUS_UPDATED} event: ${JSON.stringify(licensingStatusUpdate)}`);
    this.apiGatewayClient.emit(EVENT_PATTERNS.LICENSING_STATUS_UPDATED, licensingStatusUpdate);
  }
}
