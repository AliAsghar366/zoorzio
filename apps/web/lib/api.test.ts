/**
 * @jest-environment jsdom
 */
import {
  apiFetch,
  ApiError,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  isAuthenticated,
  setTokens,
} from './api';

function mockFetchOnce(response: Partial<Response> & { jsonBody?: unknown }) {
  const { jsonBody, ...rest } = response;
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => jsonBody,
    ...rest,
  });
}

describe('token storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts unauthenticated with no tokens stored', () => {
    expect(isAuthenticated()).toBe(false);
    expect(getAccessToken()).toBeNull();
  });

  it('persists tokens after setTokens and reports authenticated', () => {
    setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });

    expect(getAccessToken()).toBe('access-1');
    expect(getRefreshToken()).toBe('refresh-1');
    expect(isAuthenticated()).toBe(true);
  });

  it('clears both tokens on clearTokens', () => {
    setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    clearTokens();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });
});

describe('apiFetch', () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = jest.fn();
  });

  it('attaches the Authorization header when a token is present', async () => {
    setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    mockFetchOnce({ jsonBody: { ok: true } });

    await apiFetch('/memory');

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer access-1');
  });

  it('does not attach Authorization when unauthenticated', async () => {
    mockFetchOnce({ jsonBody: { ok: true } });

    await apiFetch('/health');

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('unwraps the { success, data } envelope from the API TransformInterceptor', async () => {
    mockFetchOnce({ jsonBody: { success: true, data: { id: 'mem1' }, timestamp: 't', path: '/memory' } });

    const result = await apiFetch('/memory');

    expect(result).toEqual({ id: 'mem1' });
  });

  it('throws ApiError with the server message on non-2xx responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'Email already registered' }),
    });

    await expect(apiFetch('/auth/register', { method: 'POST' })).rejects.toMatchObject({
      status: 400,
      message: 'Email already registered',
    });
  });

  it('joins array-style validation messages into one string', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: ['email must be an email', 'password too short'] }),
    });

    await expect(apiFetch('/auth/register', { method: 'POST' })).rejects.toMatchObject({
      message: 'email must be an email, password too short',
    });
  });

  it('refreshes the access token once on 401 and retries the original request', async () => {
    setTokens({ accessToken: 'expired', refreshToken: 'refresh-1' });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: { accessToken: 'fresh', refreshToken: 'refresh-2' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: { memories: [] } }),
      });

    const result = await apiFetch('/memory');

    expect(result).toEqual({ memories: [] });
    expect(getAccessToken()).toBe('fresh');
    // 1) the failed request, 2) the refresh call, 3) the retried request
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('clears tokens and gives up when the refresh call itself fails', async () => {
    setTokens({ accessToken: 'expired', refreshToken: 'bad-refresh' });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 401, headers: new Headers() })
      .mockResolvedValueOnce({ ok: false, status: 401, headers: new Headers() });

    await expect(apiFetch('/memory')).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken()).toBeNull();
  });
});
