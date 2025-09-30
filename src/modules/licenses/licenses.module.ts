import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { License } from '../../entities/license.entity';
import { Track } from '../../entities/track.entity';
import { LicensesController } from './licenses.controller';
import { LicensesService } from './licenses.service';
import { LicensesResolver } from './licenses.resolver';
import { EmailService } from '../../services/email.service';
import { EmailProcessor } from '../../processors/email.processor';
import { CacheService } from '../../services/cache.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([License, Track]),
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  controllers: [LicensesController],
  providers: [LicensesService, LicensesResolver, EmailService, EmailProcessor, CacheService],
  exports: [LicensesService],
})
export class LicensesModule {}