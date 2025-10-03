import { MigrationInterface, QueryRunner } from 'typeorm'

import { LicenseHistory } from '@/src/contexts/license-history/domain/license-history.entity'
import { Licenses } from '@/src/contexts/licenses/domain/licenses.entity'
import { Movies } from '@/src/contexts/movies/domain/movies.entity'
import { Scenes } from '@/src/contexts/scenes/domain/scenes.entity'
import { Tracks } from '@/src/contexts/tracks/domain/tracks.entity'
import { Songs } from '@/src/contexts/songs/domain/songs.entity'
import { LicenseStatus } from '@/src/app/database/types'

export class FullSeedMigration implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const db = queryRunner.connection

    // --- Movies ---
    const movies: Partial<Movies>[] = [
      { name: 'Inception' },
      { name: 'The Matrix' },
    ]
    const savedMovies = await db.getRepository(Movies).save(movies)

    // --- Scenes ---
    const scenes: Partial<Scenes>[] = [
      { name: 'Opening Scene', movieId: savedMovies[0].id },
      { name: 'Lobby Scene', movieId: savedMovies[1].id },
    ]
    const savedScenes = await db.getRepository(Scenes).save(scenes)

    // --- Songs ---
    const songs: Partial<Songs>[] = [
      {
        name: 'Time',
        artistName: 'Hans Zimmer',
        duration: 4 * 60 + 36, // 276 seconds
      },
      {
        name: 'Clubbed to Death',
        artistName: 'Rob Dougan',
        duration: 7 * 60 + 11, // 431 seconds
      },
    ]
    const savedSongs = await db.getRepository(Songs).save(songs)

    // --- Tracks ---
    const tracks: Partial<Tracks>[] = [
      {
        sceneId: savedScenes[0].id,
        songId: savedSongs[0].id,
        startTime: 15, // 15 seconds
        endTime: 90, // 1 minute 30 seconds
      },
      {
        sceneId: savedScenes[1].id,
        songId: savedSongs[1].id,
        startTime: 70, // 1 minute 10 seconds
        endTime: 180, // 3 minutes
      },
    ]
    const savedTracks = await db.getRepository(Tracks).save(tracks)

    // --- Licenses ---
    const licenses: Partial<Licenses>[] = [
      {
        trackId: savedTracks[0].id,
        status: LicenseStatus.APPROVED,
        rightsHolder: 'Warner Bros',
        notes: 'Soundtrack license for cinematic release',
      },
      {
        trackId: savedTracks[1].id,
        status: LicenseStatus.PENDING,
        rightsHolder: 'Village Roadshow',
        notes: 'Expired distribution license',
      },
    ]
    await db.getRepository(Licenses).save(licenses)

    // --- License History ---
    const licenseHistories: Partial<LicenseHistory>[] = [
      {
        licenseId: 1,
        oldStatus: LicenseStatus.PENDING,
        newStatus: LicenseStatus.NEGOCIATING,
      },
      {
        licenseId: 1,
        oldStatus: LicenseStatus.NEGOCIATING,
        newStatus: LicenseStatus.APPROVED,
      },
    ]

    await db.getRepository(LicenseHistory).save(licenseHistories)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM licenses`)
    await queryRunner.query(`DELETE FROM tracks`)
    await queryRunner.query(`DELETE FROM songs`)
    await queryRunner.query(`DELETE FROM scenes`)
    await queryRunner.query(`DELETE FROM movies`)
  }
}
