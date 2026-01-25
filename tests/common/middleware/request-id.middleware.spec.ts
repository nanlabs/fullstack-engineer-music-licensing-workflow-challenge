import { RequestIdMiddleware } from '../../src/../../src/common/middleware/request-id.middleware';
import { Request, Response, NextFunction } from 'express';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      setHeader: jest.fn(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should generate request ID if not present', () => {
    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(mockRequest.headers).toBeDefined();
    expect(mockRequest.headers!['x-request-id']).toBeDefined();
    expect(typeof mockRequest.headers!['x-request-id']).toBe('string');
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      mockRequest.headers!['x-request-id'],
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should use existing request ID if present', () => {
    const existingId = 'existing-request-id';
    mockRequest.headers = {
      'x-request-id': existingId,
    };

    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(mockRequest.headers['x-request-id']).toBe(existingId);
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      existingId,
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should set response header with request ID', () => {
    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      expect.any(String),
    );
  });

  it('should call next function', () => {
    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(mockNext).toHaveBeenCalledTimes(1);
  });
});
