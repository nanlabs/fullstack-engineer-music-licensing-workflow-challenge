import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EmailJobData } from '../services/email.service';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  @Process('licenseStatusChanged')
  async handleLicenseStatusChanged(job: Job<EmailJobData>): Promise<void> {
    const { email, licenseId } = job.data;

    this.logger.log(`Processing email notification for license ${licenseId}`);

    // In production: integrate with SendGrid, AWS SES, or similar email service
    await this.sendEmail(email, job.data);

    this.logger.log(`Email notification sent successfully for license ${licenseId}`);
  }

  private async sendEmail(email: string, data: EmailJobData): Promise<void> {
    // Replace with actual email service (SendGrid, AWS SES, etc.)
    // Example: await this.emailProvider.send(email, subject, template, data);

    this.logger.log(`Email sent to ${email} for license ${data.licenseId}: ${data.oldStatus} -> ${data.newStatus}`);
  }
}