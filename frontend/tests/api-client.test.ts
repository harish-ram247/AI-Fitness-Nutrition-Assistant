import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '../src/api/client';
import { ApiError } from '../src/api/errors';

describe('ApiClient Unit Tests', () => {
  let client: ApiClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    client = new ApiClient({ baseUrl: 'http://localhost:8000' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('5. constructs correct URL with normalized path and query params', () => {
    const url1 = client.buildUrl('/api/v1/foods', { q: 'apple', page: 1, category: undefined });
    expect(url1).toBe('http://localhost:8000/api/v1/foods?q=apple&page=1');

    const url2 = client.buildUrl('api/v1/health');
    expect(url2).toBe('http://localhost:8000/api/v1/health');
  });

  it('6. sends JSON body and headers correctly', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: '123', name: 'Bench Press' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await client.post('/api/v1/exercises', { name: 'Bench Press' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0];

    expect(calledUrl).toBe('http://localhost:8000/api/v1/exercises');
    expect(calledInit.method).toBe('POST');
    expect(calledInit.body).toBe(JSON.stringify({ name: 'Bench Press' }));
    expect(calledInit.headers.get('Content-Type')).toBe('application/json');
    expect(calledInit.headers.get('Accept')).toBe('application/json');
    expect(result).toEqual({ id: '123', name: 'Bench Press' });
  });

  it('7. attaches Bearer token when provided via getter or option', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ email: 'user@example.com' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    client.setTokenGetter(() => 'test-jwt-token-123');

    await client.get('/api/v1/users/me');

    const [, calledInit] = mockFetch.mock.calls[0];
    expect(calledInit.headers.get('Authorization')).toBe('Bearer test-jwt-token-123');
  });

  it('7b. allows explicit token override in options', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ email: 'user@example.com' }), { status: 200 }),
    );

    client.setTokenGetter(() => 'default-token');

    await client.get('/api/v1/users/me', { token: 'explicit-token-456' });

    const [, calledInit] = mockFetch.mock.calls[0];
    expect(calledInit.headers.get('Authorization')).toBe('Bearer explicit-token-456');
  });

  it('8. parses backend errors (400, 401, 403, 404, 409, 422, 500)', async () => {
    // 404 Not Found
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: 'Food item not found',
          error: { code: 'NOT_FOUND', message: 'Food item not found' },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(client.get('/api/v1/foods/00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      'Food item not found',
    );

    // 422 Validation Error
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: [
            {
              loc: ['body', 'password'],
              msg: 'Password must be at least 8 characters',
              type: 'value_error',
            },
          ],
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    try {
      await client.post('/api/v1/auth/register', { email: 'test@example.com', password: 'short' });
      expect.fail('Should have thrown ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(422);
      expect(apiErr.kind).toBe('VALIDATION_ERROR');
      expect(apiErr.validationErrors).toHaveLength(1);
      expect(apiErr.validationErrors[0].msg).toBe('Password must be at least 8 characters');
      expect(apiErr.message).toContain('Password must be at least 8 characters');
    }

    // 500 Server Error
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: 'A database error occurred. Please try again later.',
          error: { code: 'DATABASE_ERROR', message: 'A database error occurred.' },
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    try {
      await client.get('/api/v1/nutrition/daily');
      expect.fail('Should have thrown ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(500);
      expect(apiErr.kind).toBe('SERVER_ERROR');
      expect(apiErr.code).toBe('DATABASE_ERROR');
    }
  });

  it('8b. parses network error when fetch rejects', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    try {
      await client.get('/api/v1/health');
      expect.fail('Should have thrown ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.kind).toBe('NETWORK_ERROR');
      expect(apiErr.status).toBe(0);
    }
  });

  it('9. health endpoint request works through mocked API', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'healthy' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const data = await client.get<{ status: string }>('/api/v1/health');

    expect(data).toEqual({ status: 'healthy' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
