jest.mock('./StorageService', () => ({
  __esModule: true,
  default: {
    getAccessToken: jest.fn(),
    setAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    setRefreshToken: jest.fn(),
    clearAuthTokens: jest.fn(),
  },
}));

import StorageService from './StorageService';
import ApiService from './ApiService';

const mockedStorage = StorageService as jest.Mocked<typeof StorageService>;

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
  });
}

describe('ApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('login', () => {
    it('stores the returned tokens on success', async () => {
      mockedStorage.getAccessToken.mockResolvedValue(null);
      mockFetchOnce({
        user: { id: 'u1', email: 'a@b.com' },
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
      });

      const result = await ApiService.login('a@b.com', 'password123');

      expect(result.accessToken).toBe('access-1');
      expect(mockedStorage.setAccessToken).toHaveBeenCalledWith('access-1');
      expect(mockedStorage.setRefreshToken).toHaveBeenCalledWith('refresh-1');
    });

    it('throws with the server message on invalid credentials', async () => {
      mockedStorage.getAccessToken.mockResolvedValue(null);
      mockFetchOnce({ message: 'Invalid credentials' }, false, 401);
      mockedStorage.getRefreshToken.mockResolvedValue(null);

      await expect(ApiService.login('a@b.com', 'wrong')).rejects.toThrow('Session expired');
    });
  });

  describe('request retry on 401', () => {
    it('refreshes the token once and retries the original request', async () => {
      mockedStorage.getAccessToken.mockResolvedValue('expired-token');
      mockedStorage.getRefreshToken.mockResolvedValue('refresh-1');

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ accessToken: 'fresh', refreshToken: 'refresh-2' }),
        })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 'mem1' }] });

      const result = await ApiService.getMemories();

      expect(result).toEqual([{ id: 'mem1' }]);
      expect(mockedStorage.setAccessToken).toHaveBeenCalledWith('fresh');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('logs out when the refresh itself fails', async () => {
      mockedStorage.getAccessToken.mockResolvedValue('expired-token');
      mockedStorage.getRefreshToken.mockResolvedValue('bad-refresh');

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

      await expect(ApiService.getMemories()).rejects.toThrow('Session expired');
      expect(mockedStorage.clearAuthTokens).toHaveBeenCalled();
    });
  });
});
