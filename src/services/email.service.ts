import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface EmailJobData {
  email: string;
  licenseId: string;
  trackId: string;
  oldStatus: string;
  newStatus: string;
  trackName: string;
  songTitle: string;
  songArtist: string;
  movieTitle: string;
  sceneName: string;
  contactPerson?: string;
}

@Injectable()
export class EmailService {
  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {}

  async sendLicenseStatusChangeNotification(data: EmailJobData): Promise<void> {
    await this.emailQueue.add('licenseStatusChanged', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      delay: 1000, // 1 second delay
    });
  }

  async sendBulkNotifications(notifications: EmailJobData[]): Promise<void> {
    const jobs = notifications.map(data => ({
      name: 'licenseStatusChanged',
      data,
      opts: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }));

    await this.emailQueue.addBulk(jobs);
  }
}