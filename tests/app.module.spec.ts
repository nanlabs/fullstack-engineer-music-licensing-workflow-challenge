import { MiddlewareConsumer } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';
import { TimeoutMiddleware } from '../src/common/middleware/timeout.middleware';

describe('AppModule', () => {
  let appModule: AppModule;

  beforeEach(() => {
    appModule = new AppModule();
  });

  it('should be defined', () => {
    expect(appModule).toBeDefined();
  });

  it('should configure middleware', () => {
    const mockForRoutes = jest.fn().mockReturnThis();
    const mockApply = jest.fn().mockReturnValue({
      forRoutes: mockForRoutes,
    });

    const mockConsumer = {
      apply: mockApply,
    } as unknown as MiddlewareConsumer;

    appModule.configure(mockConsumer);

    expect(mockApply).toHaveBeenCalledWith(
      RequestIdMiddleware,
      TimeoutMiddleware,
    );
    expect(mockForRoutes).toHaveBeenCalledWith('*');
  });
});
