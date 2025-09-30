import { Resolver, Query, Subscription, Args, ID } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { Injectable } from '@nestjs/common';
import { LicenseStatusChangedDto } from './dto/license-status-changed.dto';
import { LicensingStatus } from '../../entities/enums/licensing-status.enum';

const pubSub = new PubSub();

@Resolver()
@Injectable()
export class LicensesResolver {

  @Query(() => String)
  hello(): string {
    return 'Hello! GraphQL subscriptions are available at /graphql';
  }
  @Subscription(() => LicenseStatusChangedDto, {
    name: 'licenseStatusChanged',
    description: 'Subscribe to license status changes',
  })
  licenseStatusChanged(
    @Args('trackId', { type: () => ID, nullable: true }) trackId?: string,
    @Args('movieId', { type: () => ID, nullable: true }) movieId?: string,
    @Args('status', { type: () => LicensingStatus, nullable: true }) status?: LicensingStatus,
  ) {
    // Create subscription key based on filters
    const subscriptionKeys = this.buildSubscriptionKey(trackId, movieId, status);

    return (pubSub as any).asyncIterableIterator(subscriptionKeys);
  }

  // Helper method to publish license status changes
  static publishLicenseStatusChange(data: LicenseStatusChangedDto): void {
    // Publish to all relevant subscription keys
    const keys = [
      'LICENSE_STATUS_CHANGED',  // All changes
      `LICENSE_STATUS_CHANGED_TRACK_${data.trackId}`,  // Specific track
      `LICENSE_STATUS_CHANGED_STATUS_${data.newStatus}`,  // Specific status
    ];

    keys.forEach(key => {
      pubSub.publish(key, { licenseStatusChanged: data });
    });
  }

  private buildSubscriptionKey(trackId?: string, movieId?: string, status?: LicensingStatus): string[] {
    const keys = ['LICENSE_STATUS_CHANGED'];

    if (trackId) {
      keys.push(`LICENSE_STATUS_CHANGED_TRACK_${trackId}`);
    }

    if (status) {
      keys.push(`LICENSE_STATUS_CHANGED_STATUS_${status}`);
    }
    
    return keys;
  }
}