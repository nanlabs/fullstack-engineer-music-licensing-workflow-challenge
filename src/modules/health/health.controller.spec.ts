import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('healthCheck', () => {
    it('should return status ok', () => {
      const result = controller.healthCheck();

      expect(result).toEqual({ status: 'ok' });
    });

    it('should return an object with status property', () => {
      const result = controller.healthCheck();

      expect(result).toBeInstanceOf(Object);
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('ok');
    });

    it('should always return the same response', () => {
      const result1 = controller.healthCheck();
      const result2 = controller.healthCheck();
      const result3 = controller.healthCheck();

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
      expect(result1).toEqual({ status: 'ok' });
    });

    it('should return status as a string', () => {
      const result = controller.healthCheck();

      expect(typeof result.status).toBe('string');
      expect(result.status).toBe('ok');
    });

    it('should not return additional properties', () => {
      const result = controller.healthCheck();

      expect(Object.keys(result)).toEqual(['status']);
    });
  });
});
