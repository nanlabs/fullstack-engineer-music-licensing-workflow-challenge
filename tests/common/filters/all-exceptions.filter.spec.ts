import { AllExceptionsFilter } from '../../src/../../src/common/filters/all-exceptions.filter';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockArgumentsHost: Partial<ArgumentsHost>;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockRequest = {
      method: 'POST',
      url: '/api/test',
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
    delete process.env.NODE_ENV;
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should handle HttpException', () => {
    const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
    const loggerSpy = jest.spyOn(filter['logger'], 'error').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Test error',
      }),
    );
    expect(loggerSpy).toHaveBeenCalled();
  });

  it('should handle generic Error', () => {
    const exception = new Error('Generic error');
    const loggerSpy = jest.spyOn(filter['logger'], 'error').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      }),
    );
    expect(loggerSpy).toHaveBeenCalled();
  });

  it('should include stack trace in development mode', () => {
    process.env.NODE_ENV = 'development';
    const exception = new Error('Test error');
    jest.spyOn(filter['logger'], 'error').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(callArgs).toHaveProperty('stack');
    expect(callArgs.stack).toBeDefined();
  });

  it('should not include stack trace in production mode', () => {
    process.env.NODE_ENV = 'production';
    const exception = new Error('Test error');
    jest.spyOn(filter['logger'], 'error').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('stack');
  });

  it('should handle non-Error exceptions', () => {
    const exception = 'String error';
    const loggerSpy = jest.spyOn(filter['logger'], 'error').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(loggerSpy).toHaveBeenCalled();
  });

  it('should handle HttpException with object response', () => {
    const exception = new HttpException(
      { message: 'Validation failed' },
      HttpStatus.BAD_REQUEST,
    );
    jest.spyOn(filter['logger'], 'error').mockImplementation();

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(callArgs.message).toBe('Validation failed');
  });
});
