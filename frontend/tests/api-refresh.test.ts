import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '../src/api/client';
import { ApiError } from '../src/api/errors';

describe('ApiClient 401 Refresh & Concurrency Tests', () => {
  let client: ApiClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    localStorage.clear();
    client = new ApiClient({ baseUrl: 'http://localhost:8000' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('9. attaches Bearer token when provided', async () => {
    client.setTokenGetter(() => 'valid-access-token');

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: '1', email: 'test@example.com' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const user = await client.get<{ id: string; email: string }>('/api/v1/users/me');

    expect(user.email).toBe('test@example.com');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.get('Authorization')).toBe('Bearer valid-access-token');
  });

  it('10 & 11. 401 triggers refresh and retries original request with new token', async () => {
    let currentToken = 'expired-token';
    client.setTokenGetter(() => currentToken);

    // Mock refresh handler that exchanges token
    const refreshHandler = vi.fn().mockImplementation(async () => {
      currentToken = 'fresh-new-token';
      return currentToken;
    });
    client.setOnUnauthorized(refreshHandler);

    // 1st call fails with 401
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Token expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    // 2nd call (retry) succeeds with 200
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: '123', email: 'user@example.com' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await client.get<{ id: string; email: string }>('/api/v1/users/me');

    expect(refreshHandler).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // First call had expired token
    const [, firstInit] = mockFetch.mock.calls[0];
    expect(firstInit.headers.get('Authorization')).toBe('Bearer expired-token');

    // Second call had fresh token
    const [, secondInit] = mockFetch.mock.calls[1];
    expect(secondInit.headers.get('Authorization')).toBe('Bearer fresh-new-token');

    expect(result).toEqual({ id: '123', email: 'user@example.com' });
  });

  it('12. concurrent 401s trigger only ONE refresh request and retry all requests', async () => {
    let currentToken = 'expired-token';
    client.setTokenGetter(() => currentToken);

    let refreshCallCount = 0;
    const refreshHandler = vi.fn().mockImplementation(async () => {
      refreshCallCount++;
      // Simulate slight network delay during refresh
      await new Promise((resolve) => setTimeout(resolve, 30));
      currentToken = 'new-shared-token';
      return currentToken;
    });
    client.setOnUnauthorized(refreshHandler);

    // 3 parallel requests receive 401 initially
    mockFetch
      // Request 1 initial failure
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Token expired' }), { status: 401 }),
      )
      // Request 2 initial failure
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Token expired' }), { status: 401 }),
      )
      // Request 3 initial failure
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Token expired' }), { status: 401 }),
      )
      // Request 1 retry success
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ item: 'data-1' }), { status: 200 }),
      )
      // Request 2 retry success
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ item: 'data-2' }), { status: 200 }),
      )
      // Request 3 retry success
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ item: 'data-3' }), { status: 200 }),
      );

    // Launch 3 requests concurrently
    const [res1, res2, res3] = await Promise.all([
      client.get<{ item: string }>('/api/v1/profile'),
      client.get<{ item: string }>('/api/v1/goals'),
      client.get<{ item: string }>('/api/v1/progress/weight'),
    ]);

    // Crucial requirement: only ONE refresh execution occurred
    expect(refreshHandler).toHaveBeenCalledTimes(1);
    expect(refreshCallCount).toBe(1);

    // All three requests resolved successfully
    expect(res1).toEqual({ item: 'data-1' });
    expect(res2).toEqual({ item: 'data-2' });
    expect(res3).toEqual({ item: 'data-3' });

    // Total 6 fetch calls: 3 failed + 3 retried
    expect(mockFetch).toHaveBeenCalledTimes(6);
    expect(mockFetch.mock.calls[3][1].headers.get('Authorization')).toBe('Bearer new-shared-token');
    expect(mockFetch.mock.calls[4][1].headers.get('Authorization')).toBe('Bearer new-shared-token');
    expect(mockFetch.mock.calls[5][1].headers.get('Authorization')).toBe('Bearer new-shared-token');
  });

  it('13. refresh failure calls onAuthExpired, clears tokens, and rejects pending requests', async () => {
    client.setTokenGetter(() => 'bad-token');
    localStorage.setItem('fitness_access_token', 'bad-token');
    localStorage.setItem('fitness_refresh_token', 'bad-refresh');

    const authExpiredHandler = vi.fn();
    client.setOnAuthExpired(authExpiredHandler);

    // Refresh handler rejects (e.g., refresh token expired)
    const refreshHandler = vi.fn().mockRejectedValue(new ApiError(401, { detail: 'Refresh token expired' }));
    client.setOnUnauthorized(refreshHandler);

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Token expired' }), { status: 401 }),
    );

    await expect(client.get('/api/v1/users/me')).rejects.toThrow();

    expect(refreshHandler).toHaveBeenCalledTimes(1);
    expect(authExpiredHandler).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('fitness_access_token')).toBeNull();
    expect(localStorage.getItem('fitness_refresh_token')).toBeNull();
  });

  it('14. refresh endpoint does NOT recursively trigger refresh when it returns 401', async () => {
    const refreshHandler = vi.fn().mockResolvedValue('token');
    client.setOnUnauthorized(refreshHandler);

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Invalid refresh token' }), { status: 401 }),
    );

    await expect(client.post('/api/v1/auth/refresh', { refresh_token: 'invalid' })).rejects.toThrow(
      'Invalid refresh token',
    );

    // Refresh handler must NOT have been called
    expect(refreshHandler).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('14b. retried request that returns 401 does NOT trigger another refresh (infinite loop prevention)', async () => {
    const refreshHandler = vi.fn().mockResolvedValue('token-that-also-fails');
    client.setOnUnauthorized(refreshHandler);

    // First request returns 401
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Unauthorized' }), { status: 401 }),
    );

    // Retried request also returns 401
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Still unauthorized' }), { status: 401 }),
    );

    await expect(client.get('/api/v1/workouts')).rejects.toThrow('Still unauthorized');

    // Only one refresh attempted; did not enter recursive loop
    expect(refreshHandler).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
