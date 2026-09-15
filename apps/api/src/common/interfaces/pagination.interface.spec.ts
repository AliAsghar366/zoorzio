import { createPaginatedResponse } from './pagination.interface';

describe('Pagination Interface', () => {
  describe('createPaginatedResponse', () => {
    it('should create paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const total = 10;
      const limit = 3;
      const offset = 0;
      const path = '/api/memory';

      const result = createPaginatedResponse(data, total, limit, offset, path);

      expect(result).toEqual({
        data,
        pagination: {
          total: 10,
          limit: 3,
          offset: 0,
          hasMore: true,
        },
        timestamp: expect.any(String),
        path: '/api/memory',
      });
    });

    it('should set hasMore to false when at end', () => {
      const data = [{ id: 8 }, { id: 9 }, { id: 10 }];
      const total = 10;
      const limit = 3;
      const offset = 7;
      const path = '/api/memory';

      const result = createPaginatedResponse(data, total, limit, offset, path);

      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle empty data', () => {
      const data: any[] = [];
      const total = 0;
      const limit = 20;
      const offset = 0;
      const path = '/api/memory';

      const result = createPaginatedResponse(data, total, limit, offset, path);

      expect(result.data).toEqual([]);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle single item', () => {
      const data = [{ id: 1 }];
      const total = 1;
      const limit = 20;
      const offset = 0;
      const path = '/api/memory';

      const result = createPaginatedResponse(data, total, limit, offset, path);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.hasMore).toBe(false);
    });
  });
});
