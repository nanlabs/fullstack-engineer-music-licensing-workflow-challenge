import { Test, TestingModule } from '@nestjs/testing';
import { LicensesResolver } from './licenses.resolver';
import { LicensesService } from './licenses.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { License } from '../../entities/license.entity';
import { Track } from '../../entities/track.entity';
import { LicensingStatus } from '../../entities/enums/licensing-status.enum';
import { PubSub } from 'graphql-subscriptions';
import { EmailService } from '../../services/email.service';
import { CacheService } from '../../services/cache.service';

describe('LicensesResolver', () => {
  let resolver: LicensesResolver;
  let licensesService: LicensesService;
  let pubSub: PubSub;

  const mockLicenseRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTrackRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicensesResolver,
        LicensesService,
        {
          provide: getRepositoryToken(License),
          useValue: mockLicenseRepository,
        },
        {
          provide: getRepositoryToken(Track),
          useValue: mockTrackRepository,
        },
        {
          provide: EmailService,
          useValue: {
            sendLicenseStatusChangeNotification: jest.fn(),
            sendBulkNotifications: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    resolver = module.get<LicensesResolver>(LicensesResolver);
    licensesService = module.get<LicensesService>(LicensesService);

    // Access the PubSub instance from the resolver
    pubSub = new PubSub();
    jest.clearAllMocks();
  });

  describe('GraphQL Subscriptions', () => {
    it('should create subscription with correct filter keys', async () => {
      const trackId = 'test-track-id';
      const status = LicensingStatus.PENDING;

      const result = resolver.licenseStatusChanged(trackId, null, status);

      // The subscription should return an async iterator
      expect(result).toBeDefined();
      expect(typeof result[Symbol.asyncIterator]).toBe('function');
    });

    it('should build subscription key with trackId filter', () => {
      const trackId = 'test-track-id';

      // Call the private method through reflection for testing
      const buildSubscriptionKey = (resolver as any).buildSubscriptionKey;
      const keys = buildSubscriptionKey.call(resolver, trackId, null, null);

      expect(keys).toContain('LICENSE_STATUS_CHANGED');
      expect(keys).toContain(`LICENSE_STATUS_CHANGED_TRACK_${trackId}`);
    });

    it('should build subscription key with status filter', () => {
      const status = LicensingStatus.APPROVED;

      const buildSubscriptionKey = (resolver as any).buildSubscriptionKey;
      const keys = buildSubscriptionKey.call(resolver, null, null, status);

      expect(keys).toContain('LICENSE_STATUS_CHANGED');
      expect(keys).toContain(`LICENSE_STATUS_CHANGED_STATUS_${status}`);
    });

    it('should build subscription key with multiple filters', () => {
      const trackId = 'test-track-id';
      const status = LicensingStatus.IN_REVIEW;

      const buildSubscriptionKey = (resolver as any).buildSubscriptionKey;
      const keys = buildSubscriptionKey.call(resolver, trackId, null, status);

      expect(keys).toContain('LICENSE_STATUS_CHANGED');
      expect(keys).toContain(`LICENSE_STATUS_CHANGED_TRACK_${trackId}`);
      expect(keys).toContain(`LICENSE_STATUS_CHANGED_STATUS_${status}`);
      expect(keys).toHaveLength(3);
    });

    it('should build default subscription key with no filters', () => {
      const buildSubscriptionKey = (resolver as any).buildSubscriptionKey;
      const keys = buildSubscriptionKey.call(resolver, null, null, null);

      expect(keys).toEqual(['LICENSE_STATUS_CHANGED']);
      expect(keys).toHaveLength(1);
    });
  });

  describe('Static publishLicenseStatusChange', () => {
    it('should handle license status change event publishing', () => {
      const eventData = {
        licenseId: 'license-id',
        trackId: 'track-id',
        oldStatus: LicensingStatus.PENDING,
        newStatus: LicensingStatus.IN_REVIEW,
        notes: 'Status updated',
        changedAt: new Date(),
        trackName: 'Test Track',
        songTitle: 'Test Song',
        songArtist: 'Test Artist',
        movieTitle: 'Test Movie',
        sceneName: 'Test Scene',
      };

      // Test that the method exists and can be called without errors
      expect(() => {
        LicensesResolver.publishLicenseStatusChange(eventData);
      }).not.toThrow();
    });
  });

  describe('hello query', () => {
    it('should return GraphQL availability message', () => {
      const result = resolver.hello();

      expect(result).toBe('Hello! GraphQL subscriptions are available at /graphql');
    });
  });
});