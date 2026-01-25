import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TimeoutMiddleware } from '../../src/common/middleware/timeout.middleware';
import { Request, Response, NextFunction } from 'express';

describe('TimeoutMiddleware', () => {
  let middleware: TimeoutMiddleware;
  let configService: ConfigService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        'app.requestTimeout': 5000,
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeoutMiddleware,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    middleware = module.get<TimeoutMiddleware>(TimeoutMiddleware);
    configService = module.get<ConfigService>(ConfigService);

    mockRequest = {
      method: 'GET',
      url: '/api/test',
    };

    mockResponse = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      on: jest.fn(),
    };

    nextFunction = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should set timeout and call next', () => {
    jest.useFakeTimers();
    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.on).toHaveBeenCalledWith('finish', expect.any(Function));
    expect(mockResponse.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockResponse.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('should send timeout response if request takes too long', () => {
    jest.useFakeTimers();
    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    // Fast-forward time past timeout
    jest.advanceTimersByTime(5000);

    expect(mockResponse.status).toHaveBeenCalledWith(408);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 408,
        message: 'Request timeout',
      }),
    );
  });

  it('should not send timeout if headers already sent', () => {
    jest.useFakeTimers();
    mockResponse.headersSent = true;

    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    jest.advanceTimersByTime(5000);

    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should clear timeout on response finish', () => {
    jest.useFakeTimers();
    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    // Get the finish handler
    const finishHandler = (mockResponse.on as jest.Mock).mock.calls.find(
      (call) => call[0] === 'finish',
    )?.[1];

    if (finishHandler) {
      finishHandler();
    }

    // Advance time - timeout should not fire
    jest.advanceTimersByTime(5000);

    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should clear timeout on response error', () => {
    jest.useFakeTimers();
    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    // Get the error handler
    const errorHandler = (mockResponse.on as jest.Mock).mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];

    if (errorHandler) {
      errorHandler();
    }

    // Advance time - timeout should not fire
    jest.advanceTimersByTime(5000);

    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should use default timeout if config not provided', () => {
    mockConfigService.get.mockReturnValue(undefined);
    jest.useFakeTimers();

    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    jest.advanceTimersByTime(30000); // Default timeout

    expect(mockResponse.status).toHaveBeenCalledWith(408);
  });
});
