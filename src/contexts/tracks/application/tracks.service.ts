import { Transactional } from 'typeorm-transactional'
import { Injectable, Inject } from '@nestjs/common'

import {
  hhmmssToSeconds,
  secondsToHHMMSS,
} from '@/src/shared/utils/time-transforms'
import { APPLICATION_ERRORS } from '@/src/app/common/response-normalizer/errors'
import { throwError } from '@/src/shared/utils/throw-error'
import { LicenseStatus } from '@/src/app/database/types'

import { CreateTrackRequestDto } from '../infrastructure/controllers/dtos/requests/create-track.request.dto'
import { LicensesRepository } from '../../licenses/domain/licenses.repository.interface'
import { ScenesRepository } from '../../scenes/domain/scenes.repository.interface'
import { SongsRepository } from '../../songs/domain/songs.repository.interface'
import { TracksRepository } from '../domain/tracks.repository.interface'
import { Tracks } from '../domain/tracks.entity'

@Injectable()
export class TracksService {
  constructor(
    @Inject(TracksRepository)
    private readonly tracksRepository: TracksRepository,
    @Inject(SongsRepository)
    private readonly songsRepository: SongsRepository,
    @Inject(ScenesRepository)
    private readonly scenesRepository: ScenesRepository,
    @Inject(LicensesRepository)
    private readonly licensesRepository: LicensesRepository,
  ) {}

  @Transactional()
  async create(input: CreateTrackRequestDto): Promise<Tracks> {
    const song = await this.songsRepository.findById(input.songId)
    if (!song) {
      throwError(APPLICATION_ERRORS.SONGS.NOT_FOUND_ERROR)
    }

    const scene = await this.scenesRepository.findById(input.sceneId)
    if (!scene) {
      throwError(APPLICATION_ERRORS.SCENES.NOT_FOUND_ERROR)
    }

    this.validateTrackWithinSong(
      input.startTime,
      input.endTime,
      secondsToHHMMSS(song.duration),
    )

    const newTrack = await this.tracksRepository.insert({
      ...input,
      startTime: hhmmssToSeconds(input.startTime),
      endTime: hhmmssToSeconds(input.endTime),
    })

    await this.licensesRepository.create({
      trackId: newTrack.id,
      status: LicenseStatus.PENDING,
      rightsHolder: input.rightsHolder,
      notes: input.notes,
    })

    return await this.tracksRepository.findOneByIdOrFail(newTrack.id)
  }

  async getTrackById(id: number): Promise<Tracks> {
    const track = await this.tracksRepository.findOneById(id)

    if (!track) {
      throwError(APPLICATION_ERRORS.TRACKS.NOT_FOUND_ERROR)
    }

    return track
  }

  /**
   * Validates whether a track's start and end times fit within a song's duration.
   *
   * @param start - Track start time as `HH:MM:SS`.
   * @param end - Track end time as `HH:MM:SS`.
   * @param songDuration - Total duration of the song as `HH:MM:SS`.
   * @returns `true` if the track fits within the song duration.
   * @throws Will throw an error if:
   * - The end time is not greater or equal than the start time.
   * - The track exceeds the song duration.
   *
   * @example
   * validateTrackWithinSong("00:00:10", "00:01:30", "00:04:00") // true
   */
  private validateTrackWithinSong(
    start: string,
    end: string,
    songDuration: string,
  ): boolean {
    const startSec = hhmmssToSeconds(start)
    const endSec = hhmmssToSeconds(end)
    const durationSec = hhmmssToSeconds(songDuration)

    if (endSec < startSec) {
      throwError(APPLICATION_ERRORS.TRACKS.INVALID_TRACK_TIMES)
    }

    if (endSec > durationSec) {
      throwError(APPLICATION_ERRORS.TRACKS.TRACK_EXCEEDS_SONG_DURATION)
    }

    return true
  }
}
