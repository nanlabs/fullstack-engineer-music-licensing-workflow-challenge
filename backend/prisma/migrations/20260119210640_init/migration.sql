/*
  Warnings:

  - You are about to drop the column `createdAt` on the `movies` table. All the data in the column will be lost.
  - You are about to drop the column `releaseDate` on the `movies` table. All the data in the column will be lost.
  - You are about to drop the column `movieId` on the `scenes` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `scenes` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `tracks` table. All the data in the column will be lost.
  - You are about to drop the column `endInScene` on the `tracks` table. All the data in the column will be lost.
  - You are about to drop the column `sceneId` on the `tracks` table. All the data in the column will be lost.
  - You are about to drop the column `songId` on the `tracks` table. All the data in the column will be lost.
  - You are about to drop the column `startInScene` on the `tracks` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `tracks` table. All the data in the column will be lost.
  - Added the required column `release_date` to the `movies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `movie_id` to the `scenes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_time` to the `scenes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `end_in_scene` to the `tracks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scene_id` to the `tracks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `song_id` to the `tracks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_in_scene` to the `tracks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `tracks` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "scenes" DROP CONSTRAINT "scenes_movieId_fkey";

-- DropForeignKey
ALTER TABLE "tracks" DROP CONSTRAINT "tracks_sceneId_fkey";

-- DropForeignKey
ALTER TABLE "tracks" DROP CONSTRAINT "tracks_songId_fkey";

-- AlterTable
ALTER TABLE "movies" DROP COLUMN "createdAt",
DROP COLUMN "releaseDate",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "release_date" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "scenes" DROP COLUMN "movieId",
DROP COLUMN "startTime",
ADD COLUMN     "movie_id" TEXT NOT NULL,
ADD COLUMN     "start_time" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "tracks" DROP COLUMN "createdAt",
DROP COLUMN "endInScene",
DROP COLUMN "sceneId",
DROP COLUMN "songId",
DROP COLUMN "startInScene",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "end_in_scene" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "scene_id" TEXT NOT NULL,
ADD COLUMN     "song_id" TEXT NOT NULL,
ADD COLUMN     "start_in_scene" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
