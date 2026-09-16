import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SecurityService } from '../security/security.service';

describe('AdminController', () => {
  let controller: AdminController;
  let service: any;

  beforeEach(async () => {
    service = {
      listUsers: jest.fn(),
      getStats: jest.fn(),
      getAuditLogs: jest.fn(),
      exportAuditLogsCsv: jest.fn(),
      setUserPlan: jest.fn(),
      impersonate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: service },
        // AdminController carries @UseGuards(AdminIpGuard); Nest's testing
        // module resolves guard dependencies even for direct method calls
        // that never trigger an HTTP request (see rate-limit.guard lesson).
        { provide: SecurityService, useValue: { isAllowedIP: jest.fn().mockReturnValue(true) } },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should export the CSV with the right headers', async () => {
    service.exportAuditLogsCsv.mockResolvedValue('When,User,Action,Resource,IP Address\n');
    const res = { setHeader: jest.fn(), send: jest.fn() };

    await controller.exportAuditLogs(res as any);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('attachment'),
    );
    expect(res.send).toHaveBeenCalledWith('When,User,Action,Resource,IP Address\n');
  });

  it('should pass the acting admin id and target id to setUserPlan', async () => {
    service.setUserPlan.mockResolvedValue({ success: true });
    await controller.setUserPlan({ user: { id: 'admin1' } }, 'user1', { planId: 'plan1' });
    expect(service.setUserPlan).toHaveBeenCalledWith('admin1', 'user1', 'plan1');
  });

  it('should pass the acting admin id and target id to impersonate', async () => {
    service.impersonate.mockResolvedValue({ accessToken: 'tok' });
    await controller.impersonate({ user: { id: 'admin1' } }, 'user1');
    expect(service.impersonate).toHaveBeenCalledWith('admin1', 'user1');
  });
});
