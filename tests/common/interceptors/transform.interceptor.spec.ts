import { TransformInterceptor } from '../../src/../../src/common/interceptors/transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { Request, Response } from 'express';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;
  let mockConfigService: Partial<ConfigService>;
  let mockExecutionContext: Partial<ExecutionContext>;
  let mockCallHandler: Partial<CallHandler>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };
    interceptor = new TransformInterceptor(
      mockConfigService as ConfigService,
    );
    mockRequest = {
      url: '/api/test',
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

  it('should transform response data', (done) => {
    const testData = { id: '1', name: 'Test' };
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

    interceptor
      .intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      )
      .subscribe({
        next: (result) => {
          expect(result).toEqual({
            success: true,
            data: testData,
            meta: {
              timestamp: expect.any(String),
              requestId: 'test-request-id',
            },
          });
          done();
        },
      });
  });

  it('should skip transformation for health endpoints', (done) => {
    mockRequest.url = '/health';
    const testData = { status: 'ok' };
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

    interceptor
      .intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      )
      .subscribe({
        next: (result) => {
          expect(result).toEqual(testData);
          expect(result).not.toHaveProperty('success');
          done();
        },
      });
  });

  it('should skip transformation for docs endpoints', (done) => {
    mockRequest.url = '/docs';
    const testData = '<html>...</html>';
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

    interceptor
      .intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      )
      .subscribe({
        next: (result) => {
          expect(result).toEqual(testData);
          done();
        },
      });
  });

  it('should skip transformation for 204 No Content responses', (done) => {
    mockResponse.statusCode = 204;
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of(null));

    interceptor
      .intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      )
      .subscribe({
        next: (result) => {
          expect(result).toBeNull();
          done();
        },
      });
  });

  it('should not transform already transformed responses', (done) => {
    const alreadyTransformed = {
      success: true,
      data: { id: '1' },
      meta: {
        timestamp: '2024-01-01T00:00:00Z',
        requestId: 'existing-id',
      },
    };
    (mockCallHandler.handle as jest.Mock).mockReturnValue(
      of(alreadyTransformed),
    );

    interceptor
      .intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      )
      .subscribe({
        next: (result) => {
          expect(result).toEqual(alreadyTransformed);
          done();
        },
      });
  });

  it('should use default request ID if not provided', (done) => {
    mockRequest.headers = {};
    const testData = { id: '1' };
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

    interceptor
      .intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      )
      .subscribe({
        next: (result: any) => {
          expect(result.meta.requestId).toBe('N/A');
          done();
        },
      });
  });

  it('should include timestamp in meta', (done) => {
    const testData = { id: '1' };
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

    interceptor
      .intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      )
      .subscribe({
        next: (result: any) => {
          expect(result.meta.timestamp).toBeDefined();
          expect(new Date(result.meta.timestamp).getTime()).toBeLessThanOrEqual(
            Date.now(),
          );
          done();
        },
      });
  });
});
