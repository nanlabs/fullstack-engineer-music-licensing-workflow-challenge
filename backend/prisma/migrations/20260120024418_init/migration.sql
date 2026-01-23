/*
  Warnings:

  - You are about to alter the column `start_time` on the `scenes` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `end_in_scene` on the `tracks` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `start_in_scene` on the `tracks` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.

*/
-- AlterTable
ALTER TABLE "scenes" ALTER COLUMN "start_time" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "tracks" ALTER COLUMN "end_in_scene" SET DATA TYPE INTEGER,
ALTER COLUMN "start_in_scene" SET DATA TYPE INTEGER;
