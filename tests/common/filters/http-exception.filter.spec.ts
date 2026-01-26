import { HttpExceptionFilter } from 'src/common/filters/http-exception.filter';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockArgumentsHost: Partial<ArgumentsHost>;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockRequest = {
      method: 'GET',
      url: '/test',
      headers: { 'x-request-id': 'test-request-id' },
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should handle HttpException with string message', () => {
    const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
    const loggerSpy = jest.spyOn(filter['logger'], 'warn').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Test error',
        path: '/test',
        method: 'GET',
      }),
    );
    expect(loggerSpy).toHaveBeenCalled();
  });

  it('should handle HttpException with object response', () => {
    const exception = new HttpException(
      { message: 'Validation failed', error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );
    const loggerSpy = jest.spyOn(filter['logger'], 'warn').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        error: 'Bad Request',
      }),
    );
    expect(loggerSpy).toHaveBeenCalled();
  });

  it('should include timestamp in error response', () => {
    const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
    jest.spyOn(filter['logger'], 'warn').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(callArgs).toHaveProperty('timestamp');
    expect(new Date(callArgs.timestamp).getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
  });

  it('should handle HttpException with non-string, non-object response', () => {
    const exception = new HttpException(
      { custom: 'data' },
      HttpStatus.BAD_REQUEST,
    );
    const loggerSpy = jest.spyOn(filter['logger'], 'warn').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(loggerSpy).toHaveBeenCalled();
  });

  it('should log 5xx errors as error level', () => {
    const exception = new HttpException(
      'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    const loggerSpy = jest.spyOn(filter['logger'], 'error').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    expect(loggerSpy).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('500'),
      expect.anything(),
    );
  });

  it('should log 404 errors as debug level', () => {
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);
    const loggerSpy = jest.spyOn(filter['logger'], 'debug').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    expect(loggerSpy).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('404'),
    );
  });

  it('should log other 4xx errors as warn level', () => {
    const exception = new HttpException(
      'Unauthorized',
      HttpStatus.UNAUTHORIZED,
    );
    const loggerSpy = jest.spyOn(filter['logger'], 'warn').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    expect(loggerSpy).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('401'),
    );
  });

  it('should handle HttpException with array message', () => {
    const exception = new HttpException(
      { message: ['Error 1', 'Error 2'], error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );
    jest.spyOn(filter['logger'], 'warn').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(callArgs.message).toBe('Error 1, Error 2');
  });

  it('should use request ID from headers', () => {
    const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
    jest.spyOn(filter['logger'], 'warn').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(callArgs.requestId).toBe('test-request-id');
  });

  it('should use N/A as request ID when header is missing', () => {
    mockRequest.headers = {};
    const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
    jest.spyOn(filter['logger'], 'warn').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(callArgs.requestId).toBe('N/A');
  });
});
