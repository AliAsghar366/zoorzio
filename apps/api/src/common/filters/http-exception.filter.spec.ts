import { Test, TestingModule } from '@nestjs/testing';
import { AllExceptionsFilter } from './http-exception.filter';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AllExceptionsFilter],
    }).compile();

    filter = module.get<AllExceptionsFilter>(AllExceptionsFilter);
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('catch', () => {
    it('should handle HttpException', () => {
      const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
      const response = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const request = {
        method: 'GET',
        url: '/api/test',
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test' },
        user: null,
      };
      const host = {
        switchToHttp: () => ({
          getResponse: () => response,
          getRequest: () => request,
        }),
      };

      filter.catch(exception, host as any);

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalled();
    });

    it('should handle generic Error', () => {
      const exception = new Error('Something went wrong');
      const response = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const request = {
        method: 'POST',
        url: '/api/test',
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test' },
        user: { id: 'user123' },
      };
      const host = {
        switchToHttp: () => ({
          getResponse: () => response,
          getRequest: () => request,
        }),
      };

      filter.catch(exception, host as any);

      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalled();
      // A raw, unhandled Error's own .message (e.g. a Prisma exception's
      // internal query text and file paths) must never reach the client -
      // only the logged server-side record should see it.
      const body = response.json.mock.calls[0][0];
      expect(body.message).toBe('Internal server error');
      expect(body.message).not.toContain('Something went wrong');
    });
  });
});
