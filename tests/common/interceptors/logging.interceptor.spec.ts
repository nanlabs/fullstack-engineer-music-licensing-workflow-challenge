import { LoggingInterceptor } from '../../src/../../src/common/interceptors/logging.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { Request, Response } from 'express';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let mockExecutionContext: Partial<ExecutionContext>;
  let mockCallHandler: Partial<CallHandler>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    mockRequest = {
      method: 'GET',
      url: '/test',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      headers: {
        'x-request-id': 'test-request-id',
      },
    };
    mockResponse = {
      statusCode: 200,
    };
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    };
    mockCallHandler = {
      handle: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should log request and response', (done) => {
    const loggerSpy = jest.spyOn(interceptor['logger'], 'log').mockImplementation();
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of({ data: 'test' }));

    interceptor
      .intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      )
      .subscribe({
        next: () => {
          expect(loggerSpy).toHaveBeenCalledWith(
            expect.stringContaining('→ GET /test'),
          );
          expect(loggerSpy).toHaveBeenCalledWith(
            expect.stringContaining('← GET /test 200'),
          );
          done();
        },
      });
  });

  it('should log error responses', (done) => {
    const loggerSpy = jest
      .spyOn(interceptor['logger'], 'error')
      .mockImplementation();
    const error = { status: 500, message: 'Internal error' };
    (mockCallHandler.handle as jest.Mock).mockReturnValue(
      throwError(() => error),
    );

    interceptor
      .intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      )
      .subscribe({
        error: () => {
          expect(loggerSpy).toHaveBeenCalledWith(
            expect.stringContaining('✗ GET /test 500'),
          );
          done();
        },
      });
  });

  it('should include request ID in logs', (done) => {
    const loggerSpy = jest.spyOn(interceptor['logger'], 'log').mockImplementation();
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of({ data: 'test' }));

    interceptor
      .intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      )
      .subscribe({
        next: () => {
          expect(loggerSpy).toHaveBeenCalledWith(
            expect.stringContaining('[test-request-id]'),
          );
          done();
        },
      });
  });

  it('should handle missing request ID', (done) => {
    mockRequest.headers = {};
    const loggerSpy = jest.spyOn(interceptor['logger'], 'log').mockImplementation();
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of({ data: 'test' }));

    interceptor
      .intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      )
      .subscribe({
        next: () => {
          expect(loggerSpy).toHaveBeenCalledWith(
            expect.stringContaining('[N/A]'),
          );
          done();
        },
      });
  });

  it('should log response time', (done) => {
    const loggerSpy = jest.spyOn(interceptor['logger'], 'log').mockImplementation();
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of({ data: 'test' }));

    interceptor
      .intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      )
      .subscribe({
        next: () => {
          const logCalls = loggerSpy.mock.calls;
          const responseLog = logCalls.find((call) =>
            call[0].includes('←'),
          )?.[0];
          expect(responseLog).toMatch(/\d+ms/);
          done();
        },
      });
  });
});
