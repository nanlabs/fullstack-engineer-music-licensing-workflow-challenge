import { PrismaClient, LicensingStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
    adapter,
});

async function main() {
  await prisma.track.deleteMany({})
  await prisma.scene.deleteMany({})
  await prisma.movie.deleteMany({})
  await prisma.song.deleteMany({})

  const movie = await prisma.movie.create({
    data: {
      title: 'The ACME Chronicles',
      releaseDate: new Date('2026-05-20'),
      scenes: {
        create: [
          { description: 'Opening Credits', startTime: 0 },
          { description: 'Desert Chase', startTime: 600 }, // 10 minutes
        ],
      },
    },
    include: { scenes: true },
  })

  const song1 = await prisma.song.create({
    data: { title: 'Fast Beats', artist: 'The Runners', label: 'ACME Records' },
  })

  await prisma.track.create({
    data: {
      sceneId: movie.scenes[1].id,
      songId: song1.id,
      startInScene: 600, // 10.0 minutes into the scene
      endInScene: 800, // 13.20 minutes into the scene
      status: LicensingStatus.NEGOTIATING,
    },
  })

  console.log('Seed completed! 🎸')
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect())