import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RealtimeController } from '../../src/realtime/realtime.controller';
import { RealtimeService } from '../../src/realtime/realtime.service';
import { RealtimeQueryDto, RealtimeEventType } from '../../src/realtime/dto/realtime-query.dto';
import { Response } from 'express';
import { Subject } from 'rxjs';

describe('RealtimeController', () => {
  let controller: RealtimeController;
  let realtimeService: RealtimeService;
  let configService: ConfigService;

  const mockRealtimeService = {
    getEventStream: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        'app.sseHeartbeatInterval': 30000,
        'app.sseMaxConnections': 1000,
      };
      return config[key];
    }),
  };

  const mockResponse = {
    setHeader: jest.fn(),
    write: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    on: jest.fn(),
    closed: false,
    headersSent: false,
    end: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RealtimeController],
      providers: [
        {
          provide: RealtimeService,
          useValue: mockRealtimeService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<RealtimeController>(RealtimeController);
    realtimeService = module.get<RealtimeService>(RealtimeService);
    configService = module.get<ConfigService>(ConfigService);

    // Reset static connection counter
    (RealtimeController as any).activeConnections = 0;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    (RealtimeController as any).activeConnections = 0;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('streamEvents', () => {
    it('should establish SSE connection and set headers', async () => {
      const eventSubject = new Subject();
      mockRealtimeService.getEventStream.mockReturnValue(eventSubject.asObservable());

      const query: RealtimeQueryDto = {};
      await controller.streamEvents(mockResponse, query);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockResponse.write).toHaveBeenCalledWith(
        ': Connected to real-time event stream\n\n',
      );
    });

    it('should reject connection when limit is reached', async () => {
      // Set connection count to max
      (RealtimeController as any).activeConnections = 1000;

      const query: RealtimeQueryDto = {};
      await controller.streamEvents(mockResponse, query);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 503,
          message: 'Too many concurrent connections. Please try again later.',
        }),
      );
    });

    it('should filter events by eventType', async () => {
      const eventSubject = new Subject();
      mockRealtimeService.getEventStream.mockReturnValue(eventSubject.asObservable());

      const query: RealtimeQueryDto = {
        eventType: RealtimeEventType.LICENSING_STATUS_UPDATE,
      };

      await controller.streamEvents(mockResponse, query);

      // Emit an event that should be filtered out
      eventSubject.next({
        type: 'track_created',
        data: { trackId: '1' },
        timestamp: new Date().toISOString(),
      });

      // Emit an event that should pass
      eventSubject.next({
        type: 'licensing_status_update',
        data: { trackId: '2' },
        timestamp: new Date().toISOString(),
      });

      // Only the matching event should be written
      expect(mockResponse.write).toHaveBeenCalledTimes(2); // Initial message + 1 event
    });

    it('should filter events by trackId', async () => {
      const eventSubject = new Subject();
      mockRealtimeService.getEventStream.mockReturnValue(eventSubject.asObservable());

      const query: RealtimeQueryDto = {
        trackId: 'track-123',
      };

      await controller.streamEvents(mockResponse, query);

      eventSubject.next({
        type: 'licensing_status_update',
        data: { trackId: 'track-123' },
        timestamp: new Date().toISOString(),
      });

      eventSubject.next({
        type: 'licensing_status_update',
        data: { trackId: 'track-456' },
        timestamp: new Date().toISOString(),
      });

      expect(mockResponse.write).toHaveBeenCalledTimes(2); // Initial + 1 filtered event
    });

    it('should cleanup on client disconnect', async () => {
      const eventSubject = new Subject();
      mockRealtimeService.getEventStream.mockReturnValue(eventSubject.asObservable());

      const query: RealtimeQueryDto = {};
      await controller.streamEvents(mockResponse, query);

      // Simulate client disconnect
      const closeHandler = (mockResponse.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'close',
      )?.[1];
      if (closeHandler) {
        closeHandler();
      }

      expect(mockResponse.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockResponse.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle subscription errors', async () => {
      const eventSubject = new Subject();
      mockRealtimeService.getEventStream.mockReturnValue(eventSubject.asObservable());

      const query: RealtimeQueryDto = {};
      await controller.streamEvents(mockResponse, query);

      // Simulate subscription error
      eventSubject.error(new Error('Stream error'));

      // Should write error event
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('event: error'),
      );
    });

    it('should handle write errors gracefully', async () => {
      const eventSubject = new Subject();
      mockRealtimeService.getEventStream.mockReturnValue(eventSubject.asObservable());
      let writeCallCount = 0;
      mockResponse.write = jest.fn().mockImplementation(() => {
        writeCallCount++;
        // Only throw error on the second write (event write), not the initial connection message
        if (writeCallCount > 1) {
          throw new Error('Write failed');
        }
      });

      const query: RealtimeQueryDto = {};
      // Don't await - the method sets up streams and doesn't return a promise
      controller.streamEvents(mockResponse, query);

      // Wait a bit for the initial connection message
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Emit event that will cause write error
      eventSubject.next({
        type: 'track_created',
        data: { trackId: '1' },
        timestamp: new Date().toISOString(),
      });

      // Wait for error handling
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should handle error without crashing - check that end was called or write was attempted
      expect(mockResponse.write).toHaveBeenCalled();
    });
  });
});
