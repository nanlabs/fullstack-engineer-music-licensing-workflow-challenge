import { HttpExceptionFilter } from '../../src/../../src/common/filters/http-exception.filter';
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
    const loggerSpy = jest.spyOn(filter['logger'], 'error').mockImplementation();

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
    const loggerSpy = jest.spyOn(filter['logger'], 'error').mockImplementation();

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
    jest.spyOn(filter['logger'], 'error').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(callArgs).toHaveProperty('timestamp');
    expect(new Date(callArgs.timestamp).getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
  });
});
