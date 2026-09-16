import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: any;

  beforeEach(async () => {
    healthService = {
      check: jest.fn(),
      detailedCheck: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return health status', async () => {
      const expectedResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'anchor-api',
        version: '1.0.0',
      };

      healthService.check.mockResolvedValue(expectedResponse);

      const result = await controller.check();

      expect(result).toEqual(expectedResponse);
      expect(healthService.check).toHaveBeenCalled();
    });
  });

  describe('detailedCheck', () => {
    it('should return detailed health status', async () => {
      const expectedResponse = {
        status: 'healthy',
        checks: {
          database: true,
          memory: true,
          uptime: 3600,
          timestamp: new Date().toISOString(),
        },
        service: 'anchor-api',
        version: '1.0.0',
      };

      healthService.detailedCheck.mockResolvedValue(expectedResponse);

      const result = await controller.detailedCheck();

      expect(result).toEqual(expectedResponse);
      expect(healthService.detailedCheck).toHaveBeenCalled();
    });
  });
});
